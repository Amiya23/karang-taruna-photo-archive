/**
 * Safe forced-download helpers (framework-free, unit-testable).
 * Used by src/app/api/photos/[id]/download/route.ts.
 */

const CONTROL_CODES = (() => {
  const out: number[] = [];
  for (let i = 0; i <= 31; i++) out.push(i);
  out.push(127);
  return out;
})();

const QUOTE = 34;
const CR = 13;
const LF = 10;

function isControl(code: number): boolean {
  return CONTROL_CODES.indexOf(code) !== -1;
}

export function sanitizeDownloadFilename(name: string): string {
  const input = String(name == null ? "" : name);
  let cleaned = "";
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (isControl(code)) continue;
    if (code === QUOTE || code === CR || code === LF) continue;
    cleaned += input[i];
  }
  cleaned = cleaned.replace(/[\\/]/g, "_").trim();
  return cleaned.length > 0 ? cleaned : "foto";
}

export function contentDisposition(filename: string): string {
  const sanitized = sanitizeDownloadFilename(filename);
  let ascii = "";
  for (let i = 0; i < sanitized.length; i++) {
    const code = sanitized.charCodeAt(i);
    if (code >= 32 && code <= 126) ascii += sanitized[i];
    else ascii += "_";
  }
  const encoded = encodeURIComponent(sanitized);
  const apostrophe = String.fromCharCode(39);
  return 'attachment; filename="' + ascii + '"; filename*=UTF-8' + apostrophe + encoded;
}
