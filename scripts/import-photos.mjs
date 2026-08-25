#!/usr/bin/env node
/**
 * Local, resumable, idempotent bulk photo importer (developer PC only).
 *
 * Uploads eligible JPG/JPEG files from E:\Old Files\Foto directly to Backblaze B2
 * and creates Supabase metadata rows, following the existing hybrid convention:
 *   storage_path = "b2:<year>/<eventId>/<hash>-<sanitized>"
 *
 * SECURITY / SCOPE:
 * - Runs only on the developer's machine (never through Vercel / browser).
 * - Uses the existing server-side B2 env (B2_*) and the existing Supabase project.
 * - Writes as the REAL admin user (session access token) so RLS is_admin() applies.
 *   NO service-role key, NO policy/schema change.
 * - Never logs secrets, keys, or signed URLs.
 *
 * IDEMPOTENCY (no migration, no Date.now() identity):
 * - B2 key uses a content hash prefix -> same file always maps to the same key.
 * - photos.storage_path is UNIQUE -> a second insert for the same key is rejected.
 * - Pre-upload SELECT on storage_path is the resume source of truth.
 * - archives UNIQUE(year) / events UNIQUE(archive_id,name) -> upsert ignoreDuplicates.
 *
 * USAGE:
 *   node --env-file=.env.local scripts/import-photos.mjs --dry-run
 *   node --env-file=.env.local scripts/import-photos.mjs --execute
 *   node --env-file=.env.local scripts/import-photos.mjs --execute --year 2023 --event Lomba --limit 3
 *
 * Requires SUPABASE_ADMIN_EMAIL and SUPABASE_ADMIN_PASSWORD (in .env.local) for --execute.
 * The importer signs in as the admin user via signInWithPassword (same flow as the
 * app login form) and verifies is_admin() — no service-role key, no session token.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const ARGS = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--dry-run" || a === "--execute") ARGS.set(a, true);
  else if (a === "--year") ARGS.set("year", process.argv[++i]);
  else if (a === "--event") ARGS.set("event", process.argv[++i]);
  else if (a === "--limit") ARGS.set("limit", parseInt(process.argv[++i], 10));
  else if (a === "--concurrency") ARGS.set("concurrency", parseInt(process.argv[++i], 10));
  else if (a === "--root") ARGS.set("root", process.argv[++i]);
}

const DRY_RUN = ARGS.has("--dry-run") || !ARGS.has("--execute");
const EXECUTE = ARGS.has("--execute");
const CONCURRENCY = Math.max(1, ARGS.get("concurrency") || 3);
const FILTER_YEAR = ARGS.get("year") ? parseInt(ARGS.get("year"), 10) : null;
const FILTER_EVENT = ARGS.get("event");
const LIMIT = ARGS.get("limit");
const ROOT = ARGS.get("root") || "E:/Old Files/Foto";

// ---------------------------------------------------------------------------
// B2 client (mirrors src/lib/b2/client.ts env contract)
// ---------------------------------------------------------------------------
function getB2Env() {
  const endpoint = process.env.B2_ENDPOINT;
  const region = process.env.B2_REGION;
  const bucketName = process.env.B2_BUCKET_NAME;
  const accessKeyId = process.env.B2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.B2_SECRET_ACCESS_KEY;
  const missing = [];
  if (!endpoint) missing.push("B2_ENDPOINT");
  if (!region) missing.push("B2_REGION");
  if (!bucketName) missing.push("B2_BUCKET_NAME");
  if (!accessKeyId) missing.push("B2_ACCESS_KEY_ID");
  if (!secretAccessKey) missing.push("B2_SECRET_ACCESS_KEY");
  if (missing.length) throw new Error(`B2 env missing: ${missing.join(", ")}`);
  return { endpoint, region, bucketName, accessKeyId, secretAccessKey };
}

const b2 = getB2Env();
const s3 = new S3Client({
  endpoint: b2.endpoint,
  region: b2.region,
  forcePathStyle: true,
  credentials: { accessKeyId: b2.accessKeyId, secretAccessKey: b2.secretAccessKey },
});

async function b2Upload(key, body) {
  await s3.send(new PutObjectCommand({ Bucket: b2.bucketName, Key: key, Body: body, ContentType: "image/jpeg" }));
}
async function b2Delete(key) {
  await s3.send(new DeleteObjectCommand({ Bucket: b2.bucketName, Key: key }));
}
async function b2Exists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: b2.bucketName, Key: key }));
    return true;
  } catch (e) {
    if (e.name === "NotFound" || e.name === "NoSuchKey") return false;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Supabase (admin session)
// ---------------------------------------------------------------------------
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!SB_URL || !SB_ANON) throw new Error("Supabase env missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (or _PUBLISHABLE_KEY)");

const sb = createClient(SB_URL, SB_ANON, { auth: { persistSession: false, autoRefreshToken: false } });

async function authAdmin() {
  const email = process.env.SUPABASE_ADMIN_EMAIL;
  const password = process.env.SUPABASE_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "SUPABASE_ADMIN_EMAIL and SUPABASE_ADMIN_PASSWORD are required in .env.local for --execute."
    );
  }
  // Same authentication flow as the application login form (src/app/admin/login/login-form.tsx).
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    // Never echo the credentials or the underlying error detail that may contain them.
    throw new Error("Supabase authentication failed: invalid admin credentials.");
  }
  if (!data?.session) {
    throw new Error("Supabase authentication failed: no session returned.");
  }
  // Verify the signed-in user is an admin via the project's existing is_admin() RPC.
  const { data: isAdmin, error: rpcError } = await sb.rpc("is_admin");
  if (rpcError) throw new Error(`Admin verification failed: ${rpcError.message}`);
  if (!isAdmin) throw new Error("Authenticated user is not an admin (is_admin() = false).");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sanitizePhotoFilename(name) {
  // Copied verbatim from src/app/admin/(panel)/archives/actions.ts
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

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------
const TARGET_YEARS = {
  "Foto 17 Agustus'23": 2023,
  "Foto 17 Agustus'24": 2024,
  "Foto 17 Agustus'25": 2025,
  "Foto 17 Agustus'26": 2026,
};
const EVENTS = ["Lomba", "Pawai", "Tasyakuran"];
const IMG_EXT = new Set([".jpg", ".jpeg"]);

function discover() {
  const plan = []; // { year, eventName, filePath, originalName }
  for (const [folder, year] of Object.entries(TARGET_YEARS)) {
    if (FILTER_YEAR && FILTER_YEAR !== year) continue;
    const yearDir = path.join(ROOT, folder);
    if (!fs.existsSync(yearDir)) {
      console.log(`[scan] year folder not found: ${folder} (skip)`);
      continue;
    }
    for (const ev of EVENTS) {
      if (FILTER_EVENT && FILTER_EVENT.toLowerCase() !== ev.toLowerCase()) continue;
      const evDir = path.join(yearDir, ev);
      if (!fs.existsSync(evDir)) continue; // missing event folder is normal
      const entries = fs.readdirSync(evDir);
      for (const name of entries) {
        const full = path.join(evDir, name);
        if (!fs.statSync(full).isFile()) continue; // ignore subfolders (only direct children)
        const ext = path.extname(name).toLowerCase();
        if (!IMG_EXT.has(ext)) continue; // only jpg/jpeg
        plan.push({ year, eventName: ev, filePath: full, originalName: name });
      }
    }
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Ensure archive / event (idempotent)
// ---------------------------------------------------------------------------
async function ensureArchive(year) {
  const { data: existing } = await sb.from("archives").select("id").eq("year", year).maybeSingle();
  if (existing) return existing.id;
  const { data: ins, error } = await sb
    .from("archives")
    .upsert({ year, title: `Foto 17 Agustus ${year}` }, { onConflict: "year", ignoreDuplicates: true })
    .select("id")
    .single();
  if (error) throw new Error(`archive upsert ${year}: ${error.message}`);
  // re-select in case ignoreDuplicates returned the pre-existing row
  const { data: again } = await sb.from("archives").select("id").eq("year", year).maybeSingle();
  return (ins && ins.id) || (again && again.id);
}

async function ensureEvent(archiveId, name) {
  const { data: existing } = await sb
    .from("events")
    .select("id, cover_image")
    .eq("archive_id", archiveId)
    .eq("name", name)
    .maybeSingle();
  if (existing) return existing;
  const { error } = await sb
    .from("events")
    .upsert({ archive_id: archiveId, name }, { onConflict: "archive_id,name", ignoreDuplicates: true });
  if (error) throw new Error(`event upsert ${name}: ${error.message}`);
  const { data: again } = await sb
    .from("events")
    .select("id, cover_image")
    .eq("archive_id", archiveId)
    .eq("name", name)
    .maybeSingle();
  return again;
}

// ---------------------------------------------------------------------------
// Worker pool
// ---------------------------------------------------------------------------
function runPool(tasks, worker) {
  return new Promise((resolve) => {
    let i = 0;
    let active = 0;
    let done = 0;
    const tick = () => {
      while (active < CONCURRENCY && i < tasks.length) {
        const task = tasks[i++];
        active++;
        Promise.resolve(worker(task)).finally(() => {
          active--;
          done++;
          if (done === tasks.length) resolve();
          else tick();
        });
      }
      if (done === tasks.length) resolve();
    };
    tick();
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  const startedAt = Date.now();
  const plan = discover();
  if (LIMIT) plan.splice(LIMIT);

  console.log(`\n=== IMPORTER (${DRY_RUN ? "DRY RUN" : "EXECUTE"}) ===`);
  console.log(`Root: ${ROOT}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Eligible files discovered: ${plan.length}`);
  if (FILTER_YEAR) console.log(`Filter: year=${FILTER_YEAR}${FILTER_EVENT ? ` event=${FILTER_EVENT}` : ""}`);

  // Group by year/event for reporting
  const groups = new Map();
  for (const p of plan) {
    const k = `${p.year}/${p.eventName}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  for (const [k, items] of groups) {
    const bytes = items.reduce((s, p) => s + fs.statSync(p.filePath).size, 0);
    console.log(`  ${k}: ${items.length} files, ${(bytes / 1e6).toFixed(1)} MB`);
  }

  if (DRY_RUN) {
    // Verify archive/event existence (read-only)
    console.log("\n[dry-run] verifying archive/event existence (no writes)...");
    for (const [k, items] of groups) {
      const [year, ev] = k.split("/");
      const a = await sb.from("archives").select("id").eq("year", Number(year)).maybeSingle();
      const e = a?.data
        ? await sb.from("events").select("id").eq("archive_id", a.data.id).eq("name", ev).maybeSingle()
        : null;
      console.log(`  ${k}: archive ${a?.data ? "EXISTS" : "will create"}, event ${e?.data ? "EXISTS" : "will create"}`);
    }
    console.log("\n[dry-run] NO uploads / NO DB writes performed.");
    console.log("NO LOCAL FILES MODIFIED. NO B2 UPLOAD. NO SUPABASE INSERT.");
    return;
  }

  // EXECUTE
  await authAdmin();
  const coverSet = new Set(); // "year/event" -> cover already assigned
  const stats = { uploaded: 0, skipped: 0, failed: 0, bytes: 0 };
  const failures = [];
  const orphans = [];

  let counter = 0;
  const total = plan.length;

  // Build tasks: ensure archive+event first (sequential per group), then per-file upload tasks.
  const tasks = [];
  for (const [k, items] of groups) {
    const [yearStr, ev] = k.split("/");
    const year = Number(yearStr);
    const archiveId = await ensureArchive(year);
    const event = await ensureEvent(archiveId, ev);
    for (const p of items) {
      tasks.push({ ...p, year, archiveId, eventId: event.id, eventCover: event.cover_image });
    }
  }

  const worker = async (t) => {
    counter++;
    const label = `${t.year}/${t.eventName}/${t.originalName}`;
    let buf;
    try {
      buf = fs.readFileSync(t.filePath);
    } catch (e) {
      stats.failed++;
      failures.push({ label, reason: `read error: ${e.message}` });
      console.log(`[${counter}/${total}] ${label} — failed: read error`);
      return;
    }
    if (buf.length === 0) {
      stats.failed++;
      failures.push({ label, reason: "empty file" });
      console.log(`[${counter}/${total}] ${label} — failed: empty`);
      return;
    }
    if (!isJpeg(buf)) {
      stats.failed++;
      failures.push({ label, reason: "not a valid JPEG" });
      console.log(`[${counter}/${total}] ${label} — failed: invalid JPEG`);
      return;
    }
    const prefix = contentHashPrefix(buf);
    const key = `${t.year}/${t.eventId}/${prefix}-${sanitizePhotoFilename(t.originalName)}`;
    const storagePath = `b2:${key}`;

    // Resume check: source of truth
    const { data: existing } = await sb.from("photos").select("id").eq("storage_path", storagePath).maybeSingle();
    if (existing) {
      stats.skipped++;
      console.log(`[${counter}/${total}] ${label} — already imported`);
      return;
    }

    // Optional: skip if B2 object already exists but DB row missing (recover partial)
    const b2There = await b2Exists(key).catch(() => false);

    try {
      await b2Upload(key, buf);
    } catch (e) {
      stats.failed++;
      failures.push({ label, reason: `B2 upload failed: ${e.message}` });
      console.log(`[${counter}/${total}] ${label} — failed: B2 upload`);
      return;
    }

    const { error: insErr } = await sb.from("photos").insert({
      event_id: t.eventId,
      storage_path: storagePath,
      filename: t.originalName,
    });

    if (insErr) {
      if (insErr.code === "23505") {
        stats.skipped++;
        console.log(`[${counter}/${total}] ${label} — already imported (row exists)`);
        return;
      }
      // Rollback B2 object
      try {
        await b2Delete(key);
      } catch {
        orphans.push(key);
      }
      stats.failed++;
      failures.push({ label, reason: `DB insert failed: ${insErr.message}` });
      console.log(`[${counter}/${total}] ${label} — failed: DB insert`);
      return;
    }

    stats.uploaded++;
    stats.bytes += buf.length;

    // Cover: set once per event if currently null (never overwrite existing)
    const ck = `${t.year}/${t.eventName}`;
    if (!coverSet.has(ck) && !t.eventCover) {
      await sb.from("events").update({ cover_image: storagePath }).eq("id", t.eventId).eq("cover_image", null);
      coverSet.add(ck);
    }

    console.log(`[${counter}/${total}] ${label} — uploaded (b2:${key})`);
  };

  if (LIMIT) tasks.splice(LIMIT);
  await runPool(tasks, worker);

  const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total eligible : ${total}`);
  console.log(`Uploaded       : ${stats.uploaded}`);
  console.log(`Skipped (done) : ${stats.skipped}`);
  console.log(`Failed         : ${stats.failed}`);
  console.log(`Bytes uploaded : ${(stats.bytes / 1e9).toFixed(3)} GB`);
  console.log(`Duration       : ${duration} s`);
  if (failures.length) {
    console.log(`\nFAILURES:`);
    for (const f of failures) console.log(`  - ${f.label}: ${f.reason}`);
  }
  if (orphans.length) {
    console.log(`\nORPHAN B2 KEYS (cleanup manually):`);
    for (const k of orphans) console.log(`  - b2:${k}`);
  }

  console.log("\nNO LOCAL FILES MODIFIED. NO REPOSITORY CHANGES.");
  process.exit(0);
})().catch((e) => {
  console.error("IMPORTER ERROR:", e.message);
  process.exit(1);
});
