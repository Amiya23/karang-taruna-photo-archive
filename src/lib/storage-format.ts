/**
 * Formatting helpers for storage byte sizes (framework-free, unit-testable).
 *
 * Used by the admin dashboard "Penyimpanan Digunakan" card. Input is a raw byte
 * count; output is a human-readable string. No Supabase / Next imports.
 */

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;
const TB = GB * 1024;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < KB) return `${bytes} B`;

  const value =
    bytes < MB ? bytes / KB : bytes < GB ? bytes / MB : bytes < TB ? bytes / GB : bytes / TB;

  const unit = bytes < MB ? "KB" : bytes < GB ? "MB" : bytes < TB ? "GB" : "TB";

  // 1 decimal for KB (small), 2 decimals otherwise, trailing zeros trimmed.
  const rounded = bytes < MB ? value.toFixed(1) : value.toFixed(2);
  const trimmed = rounded.replace(/\.?0+$/, "");

  return `${trimmed} ${unit}`;
}
