#!/usr/bin/env node
/**
 * R2-5: Bulk migration of existing b2:-backed photos to Cloudflare R2.
 *
 * Strategy (per phase spec):
 *  - Source of truth = ORIGINAL LOCAL JPEG files (E:/Old Files/Foto).
 *  - NEVER download from B2. NEVER delete/modify B2 (rollback storage).
 *  - Deterministic key: each R2 object key == the existing B2 object key
 *    (b2:<key> -> r2:<key>); only the provider prefix changes.
 *  - Reads 1,866 b2: DB rows, matches each to exactly one local file by the
 *    SAME content-hash + sanitize convention the importer uses.
 *  - Uploads each local file to R2 (raw key), verifies size, then flips that
 *    DB row b2:<key> -> r2:<key> (only rows still b2:; idempotent/resumable).
 *
 * SECURITY / SCOPE:
 *  - Runs only on the developer machine (never Vercel / browser).
 *  - Writes as the REAL admin user (session token) so is_admin() RLS applies.
 *    NO service-role key, NO policy/schema changes.
 *  - Never logs secrets, keys (full), or signed URLs.
 *
 * IDEMPOTENCY / RESUMABILITY:
 *  - R2 object skipped if it already exists with matching size (re-upload safe).
 *  - DB update is conditional: only flips storage_path when still 'b2:<key>'.
 *  - Re-running resumes: already-migrated rows/objects are no-ops.
 *
 * USAGE:
 *   node --env-file=.env.local scripts/migrate-b2-to-r2.mjs --dry-run
 *   node --env-file=.env.local scripts/migrate-b2-to-r2.mjs --execute [--concurrency 3]
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const ARGS = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--dry-run" || a === "--execute") ARGS.set(a, true);
  else if (a === "--concurrency") ARGS.set("concurrency", parseInt(process.argv[++i], 10));
  else if (a === "--limit") ARGS.set("limit", parseInt(process.argv[++i], 10));
  else if (a === "--root") ARGS.set("root", process.argv[++i]);
}
const DRY_RUN = ARGS.has("--dry-run") || !ARGS.has("--execute");
const EXECUTE = ARGS.has("--execute");
const CONCURRENCY = Math.max(1, Math.min(8, ARGS.get("concurrency") || 3));
const ROOT = ARGS.get("root") || "E:/Old Files/Foto";

// ---------------------------------------------------------------------------
// R2 client (mirrors src/lib/r2/client.ts env contract)
// ---------------------------------------------------------------------------
function getR2Env() {
  const endpoint = process.env.R2_ENDPOINT;
  const region = process.env.R2_REGION;
  const bucketName = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const missing = [];
  if (!endpoint) missing.push("R2_ENDPOINT");
  if (!region) missing.push("R2_REGION");
  if (!bucketName) missing.push("R2_BUCKET_NAME");
  if (!accessKeyId) missing.push("R2_ACCESS_KEY_ID");
  if (!secretAccessKey) missing.push("R2_SECRET_ACCESS_KEY");
  if (missing.length) throw new Error(`R2 env missing: ${missing.join(", ")}`);
  return { endpoint, region: region === "auto" ? "auto" : "auto", bucketName, accessKeyId, secretAccessKey };
}
const r2 = getR2Env();
const r2Client = new S3Client({
  endpoint: r2.endpoint,
  region: r2.region,
  forcePathStyle: true,
  credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
});

async function r2ExistsWithSize(key) {
  try {
    const res = await r2Client.send(new HeadObjectCommand({ Bucket: r2.bucketName, Key: key }));
    return { exists: true, size: res.ContentLength, contentType: res.ContentType };
  } catch (e) {
    if (e.name === "NotFound" || e.name === "NoSuchKey") return { exists: false };
    throw e;
  }
}
async function r2Upload(key, body, size) {
  // PutObject with Content-Type image/jpeg and a SHA-256 checksum header so R2
  // verifies integrity server-side (no re-download needed for verification).
  const hash = crypto.createHash("sha256").update(body).digest("base64");
  await r2Client.send(
    new PutObjectCommand({
      Bucket: r2.bucketName,
      Key: key,
      Body: body,
      ContentType: "image/jpeg",
      ChecksumSHA256: hash,
    })
  );
}

// ---------------------------------------------------------------------------
// Supabase (admin session, same as importer)
// ---------------------------------------------------------------------------
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!SB_URL || !SB_ANON) throw new Error("Supabase env missing");
const sb = createClient(SB_URL, SB_ANON, { auth: { persistSession: false, autoRefreshToken: false } });

async function authAdmin() {
  const email = process.env.SUPABASE_ADMIN_EMAIL;
  const password = process.env.SUPABASE_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("SUPABASE_ADMIN_EMAIL/PASSWORD required for --execute");
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Supabase auth failed: invalid admin credentials");
  const { data: isAdmin, error: rpcError } = await sb.rpc("is_admin");
  if (rpcError) throw new Error(`Admin verification failed: ${rpcError.message}`);
  if (!isAdmin) throw new Error("Authenticated user is not an admin");
}

// ---------------------------------------------------------------------------
// Helpers (verbatim algorithm from importer / actions.ts)
// ---------------------------------------------------------------------------
function sanitizePhotoFilename(name) {
  const dot = name.lastIndexOf(".");
  const rawExt = dot >= 0 ? name.slice(dot).toLowerCase() : "";
  const ext = /^.(jpe?g|png|webp)$/.test(rawExt) ? rawExt : "";
  const base = (dot >= 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "foto"}${ext}`;
}
function isJpeg(buf) {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}
function contentHashPrefix(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 12);
}

const TARGET_YEARS = {
  "Foto 17 Agustus'23": 2023,
  "Foto 17 Agustus'24": 2024,
  "Foto 17 Agustus'25": 2025,
  "Foto 17 Agustus'26": 2026,
};
const EVENTS = ["Lomba", "Pawai", "Tasyakuran"];
const IMG_EXT = new Set([".jpg", ".jpeg"]);

// ---------------------------------------------------------------------------
// Build local source index keyed by deterministic key
// ---------------------------------------------------------------------------
function buildLocalIndex() {
  const byKey = new Map(); // key -> { filePath, originalName, year, eventName, size }
  const yearEventToId = new Map(); // "year|eventName" -> eventId (filled from DB later)
  // First pass: enumerate files (no reads yet)
  const files = [];
  for (const [folder, year] of Object.entries(TARGET_YEARS)) {
    const yearDir = path.join(ROOT, folder);
    if (!fs.existsSync(yearDir)) {
      console.log(`[scan] year folder not found: ${folder} (skip)`);
      continue;
    }
    for (const ev of EVENTS) {
      const evDir = path.join(yearDir, ev);
      if (!fs.existsSync(evDir)) continue;
      for (const name of fs.readdirSync(evDir)) {
        const full = path.join(evDir, name);
        if (!fs.statSync(full).isFile()) continue;
        if (!IMG_EXT.has(path.extname(name).toLowerCase())) continue;
        files.push({ year, eventName: ev, originalName: name, filePath: full });
      }
    }
  }
  return { files, yearEventToId };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  const startedAt = Date.now();
  console.log(`\n=== R2-5 MIGRATION (${DRY_RUN ? "DRY RUN" : "EXECUTE"}) ===`);
  console.log(`Root: ${ROOT} | Concurrency: ${CONCURRENCY}`);

  if (EXECUTE) await authAdmin();

  // 1. DB: eventId map (year|name -> id) + 1866 b2: rows
  console.log("[1] reading events + archives for id map...");
  const { data: events } = await sb.from("events").select("id, archive_id, name");
  const { data: archives } = await sb.from("archives").select("id, year");
  const archYear = new Map((archives || []).map((a) => [a.id, a.year]));
  const yearEventToId = new Map();
  for (const e of events || []) {
    const yr = archYear.get(e.archive_id);
    if (yr != null) yearEventToId.set(`${yr}|${e.name}`, e.id);
  }

  console.log("[2] reading b2: photo rows (paginated; Supabase caps 1000/req)...");
  const dbRows = [];
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data: page, error: dbErr } = await sb
      .from("photos")
      .select("id, event_id, filename, storage_path")
      .like("storage_path", "b2:%")
      .order("id")
      .range(from, from + PAGE - 1);
    if (dbErr) throw new Error(`DB read failed: ${dbErr.message}`);
    if (!page || page.length === 0) break;
    dbRows.push(...page);
    if (page.length < PAGE) break;
    from += PAGE;
  }
  // Also read r2: rows so already-migrated keys are recognized (resumable).
  const r2Keys = new Set();
  from = 0;
  for (;;) {
    const { data: page, error: r2Err } = await sb
      .from("photos")
      .select("storage_path")
      .like("storage_path", "r2:%")
      .order("id")
      .range(from, from + PAGE - 1);
    if (r2Err) throw new Error(`DB r2 read failed: ${r2Err.message}`);
    if (!page || page.length === 0) break;
    for (const r of page) if (r.storage_path?.startsWith("r2:")) r2Keys.add(r.storage_path.slice(3));
    if (page.length < PAGE) break;
    from += PAGE;
  }
  console.log(`    DB b2: rows = ${dbRows.length} | DB r2: rows (already migrated) = ${r2Keys.size}`);
  const dbByKey = new Map();
  for (const r of dbRows || []) {
    const key = r.storage_path.startsWith("b2:") ? r.storage_path.slice(3) : r.storage_path;
    dbByKey.set(key, r);
  }
  console.log(`    DB b2: rows = ${dbByKey.size}`);

  // 3. Build local index + compute deterministic keys
  console.log("[3] scanning local source + hashing (deterministic keys)...");
  const { files } = buildLocalIndex();
  console.log(`    local jpg files discovered = ${files.length}`);
  const localByKey = new Map();
  let unmatchedEvent = 0;
  let totalBytes = 0;
  for (const f of files) {
    const eventId = yearEventToId.get(`${f.year}|${f.eventName}`);
    if (!eventId) {
      unmatchedEvent++;
      continue;
    }
    const buf = fs.readFileSync(f.filePath);
    if (buf.length === 0 || !isJpeg(buf)) continue;
    const key = `${f.year}/${eventId}/${contentHashPrefix(buf)}-${sanitizePhotoFilename(f.originalName)}`;
    if (localByKey.has(key)) {
      console.log(`[WARN] duplicate local key: ${key}`);
    }
    localByKey.set(key, { filePath: f.filePath, originalName: f.originalName, year: f.year, eventName: f.eventName, size: buf.length });
    totalBytes += buf.length;
  }
  console.log(`    local distinct keys = ${localByKey.size} | unmatched-event files = ${unmatchedEvent}`);
  console.log(`    local total bytes = ${(totalBytes / 1e9).toFixed(3)} GB`);

  // 4. Match audit (both directions)
  console.log("[4] match audit (retry on transient race)...");
  let missingSource = 0;
  let malformed = 0;
  let alreadyMigrated = 0;
  let toMigrate = [];
  let auditOk = false;
  for (let attempt = 1; attempt <= 3 && !auditOk; attempt++) {
    // Re-read b2: + r2: fresh each attempt (resumable migration may be flipping rows).
    const dbByKey = new Map();
    {
      const rows = [];
      let from = 0; const PAGE = 1000;
      for (;;) {
        const { data: page, error: dbErr } = await sb.from("photos").select("id, event_id, filename, storage_path").like("storage_path", "b2:%").order("id").range(from, from + PAGE - 1);
        if (dbErr) throw new Error(`DB read failed: ${dbErr.message}`);
        if (!page || page.length === 0) break;
        rows.push(...page);
        if (page.length < PAGE) break;
        from += PAGE;
      }
      for (const r of rows) { const key = r.storage_path.startsWith("b2:") ? r.storage_path.slice(3) : r.storage_path; dbByKey.set(key, r); }
    }
    const r2Keys = new Set();
    {
      let from = 0; const PAGE = 1000;
      for (;;) {
        const { data: page, error: r2Err } = await sb.from("photos").select("storage_path").like("storage_path", "r2:%").order("id").range(from, from + PAGE - 1);
        if (r2Err) throw new Error(`DB r2 read failed: ${r2Err.message}`);
        if (!page || page.length === 0) break;
        for (const r of page) if (r.storage_path?.startsWith("r2:")) r2Keys.add(r.storage_path.slice(3));
        if (page.length < PAGE) break;
        from += PAGE;
      }
    }
    missingSource = 0; malformed = 0; alreadyMigrated = 0; toMigrate = [];
    for (const [key, row] of dbByKey) {
      if (!/^\d{4}\/[0-9a-f-]+\//.test(key)) malformed++;
      const local = localByKey.get(key);
      if (!local) { missingSource++; if (missingSource <= 5) console.log(`    [MISMATCH] DB key has no local source: ${key}`); }
      else toMigrate.push({ key, row, local });
    }
    let unmatchedDb = 0;
    for (const key of localByKey.keys()) {
      if (dbByKey.has(key)) continue;
      if (r2Keys.has(key)) { alreadyMigrated++; continue; }
      unmatchedDb++;
      if (unmatchedDb <= 5) console.log(`    [MISMATCH] local key has no DB row: ${key}`);
    }
    console.log(`    attempt ${attempt}: b2:=${dbByKey.size} r2:=${r2Keys.size} toMigrate=${toMigrate.length} alreadyR2=${alreadyMigrated} missingSrc=${missingSource} unmatchedDb=${unmatchedDb} malformed=${malformed}`);
    if (missingSource === 0 && unmatchedDb === 0 && malformed === 0) { auditOk = true; }
    else { console.log(`    [retry] transient/real mismatch detected, re-reading...`); await new Promise((r) => setTimeout(r, 3000)); }
  }
  if (!auditOk) {
    console.log("\n[MATCH AUDIT FAILED] Real mismatch persisted after retries. Stopping — no R2 upload, no DB write.");
    process.exit(2);
  }
  console.log("\n[MATCH AUDIT PASSED] mapping confirmed (toMigrate=" + toMigrate.length + ", already r2:=" + alreadyMigrated + ").");

  const LIMIT = ARGS.get("limit");
  if (LIMIT && LIMIT > 0) {
    console.log(`[LIMIT] executing only first ${LIMIT} of ${toMigrate.length} matched pairs (pilot).`);
    toMigrate.splice(LIMIT);
  }

  if (DRY_RUN) {
    console.log("\n[dry-run] NO R2 UPLOAD. NO DB WRITE. NO LOCAL FILE MODIFIED.");
    process.exit(0);
  }

  // 5. EXECUTE: upload to R2 + flip DB row, resumable/idempotent
  console.log(`\n[5] executing migration (concurrency ${CONCURRENCY})...`);
  const stats = { uploaded: 0, skipped: 0, failed: 0, bytes: 0 };
  const failures = [];
  const alreadyR2 = new Set();
  let counter = 0;
  const total = toMigrate.length;

  const worker = async (item) => {
    counter++;
    const label = `${item.key}`;
    // Skip if DB row already migrated (resume)
    const cur = await sb.from("photos").select("storage_path").eq("id", item.row.id).maybeSingle();
    if (cur?.data?.storage_path?.startsWith("r2:")) {
      stats.skipped++;
      alreadyR2.add(item.row.id);
      return;
    }
    // Verify R2 object (skip if exists with matching size)
    let buf;
    try {
      buf = fs.readFileSync(item.local.filePath);
    } catch (e) {
      stats.failed++;
      failures.push({ key: item.key, reason: `read: ${e.message}` });
      return;
    }
    let meta;
    try {
      meta = await r2ExistsWithSize(item.key);
    } catch (e) {
      stats.failed++;
      failures.push({ key: item.key, reason: `head: ${e.message}` });
      return;
    }
    if (meta.exists) {
      if (meta.size === buf.length) {
        stats.skipped++;
      } else {
        // size mismatch -> re-upload to be safe
      }
    }
    if (!meta.exists || meta.size !== buf.length) {
      // bounded retry
      let ok = false;
      for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
        try {
          await r2Upload(item.key, buf, buf.length);
          ok = true;
        } catch (e) {
          if (attempt === 3) {
            stats.failed++;
            failures.push({ key: item.key, reason: `upload: ${e.message}` });
            return;
          }
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
      if (ok) stats.uploaded++;
    }
    // Verify uploaded object size
    const verify = await r2ExistsWithSize(item.key).catch(() => ({ exists: false }));
    if (!verify.exists || verify.size !== buf.length) {
      stats.failed++;
      failures.push({ key: item.key, reason: "post-upload verify failed" });
      return;
    }
    stats.bytes += buf.length;
    // Flip DB row b2: -> r2: (conditional, idempotent)
    const { error: updErr } = await sb
      .from("photos")
      .update({ storage_path: `r2:${item.key}` })
      .eq("id", item.row.id)
      .eq("storage_path", `b2:${item.key}`);
    if (updErr) {
      stats.failed++;
      failures.push({ key: item.key, reason: `db update: ${updErr.message}` });
      return;
    }
    console.log(`[${counter}/${total}] ${label} — migrated (r2:${item.key})`);
  };

  // bounded concurrency pool
  await (async () => {
    let i = 0;
    let active = 0;
    let done = 0;
    await new Promise((resolve) => {
      const tick = () => {
        while (active < CONCURRENCY && i < toMigrate.length) {
          const item = toMigrate[i++];
          active++;
          Promise.resolve(worker(item)).finally(() => {
            active--;
            done++;
            if (done === toMigrate.length) resolve();
            else tick();
          });
        }
        if (done === toMigrate.length) resolve();
      };
      tick();
    });
  })();

  const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total pairs     : ${total}`);
  console.log(`Uploaded (R2)   : ${stats.uploaded}`);
  console.log(`Skipped (done)  : ${stats.skipped}`);
  console.log(`Failed          : ${stats.failed}`);
  console.log(`Bytes migrated  : ${(stats.bytes / 1e9).toFixed(3)} GB`);
  console.log(`Duration        : ${duration} s`);
  if (failures.length) {
    console.log(`\nFAILURES:`);
    for (const f of failures.slice(0, 30)) console.log(`  - ${f.key}: ${f.reason}`);
    if (failures.length > 30) console.log(`  ... and ${failures.length - 30} more`);
  }
  console.log("\nNO LOCAL FILES MODIFIED. B2 UNTOUCHED. NO REPO CHANGES.");
  process.exit(0);
})().catch((e) => {
  console.error("MIGRATION ERROR:", e.message);
  process.exit(1);
});
