# Acceptance Tests — PRD §10

Status per 2026-08-22. Environment: production build (`next build` + `next start`), live Supabase via `.env.local`.

## Hasil Otomatis — LOLOS

Dijalankan dengan kunci anon (perspektif pengunjung publik):

| # | Test | Hasil |
|---|------|-------|
| AC1a–d | Anon membaca archives → events → photos → storage URL (HTTP 200) | PASS |
| AC3 | Set event per tahun berbeda; tidak ada daftar event hardcode di kode; `unique(archive_id, name)` di DB | PASS |
| AC2-schema | DB menerima tahun dinamis apa pun (check 1900–2999), bukan hanya 2023–2026 | PASS |
| AC5a–i | Anon INSERT/UPDATE/DELETE pada `archives`, `events`, `photos`, `admin_profiles` → semua ditolak RLS (42501) | PASS |
| AC5j | Anon upload ke Storage `photos` bucket → ditolak policy | PASS |
| Build | `npm run typecheck`, `npm run lint`, `npm run build` | PASS |
| Route smoke | `/`, `/archive`, `/archive/2026`, `/archive/2026/lomba` = 200; `/archive/1999` = 404 | PASS |
| Optimasi foto | next/image menghasilkan JPEG teroptimasi HTTP 200 | PASS |
| Admin gate | anon `/admin/archives` → redirect `/admin/login`, tanpa kebocoran konten panel | PASS |
| AC6 statis | Masonry 2→4 kolom, viewport meta, lazy-load + skeleton, lightbox responsif + keyboard nav | PASS |

## Manual — Butuh Sesi Admin

### M1. Tambah tahun baru tanpa ubah kode (AC2 penuh)

1. Login di `/admin/login`.
2. Buka `/admin/archives`, tambah tahun **2027** dengan judul apa pun.
3. Verifikasi:
   - Kartu **2027** muncul di homepage dan `/archive` tanpa deploy/ubah kode.
   - `/archive/2027` bisa diakses.
   - Duplikasi tahun 2027 ditolak dengan pesan jelas.
4. Bersihkan: hapus arsip 2027 (harus gagal bila masih ada event/foto).

### M2. Bulk upload (AC4)

1. Login admin, masuk ke detail tahun → event.
2. Drag & drop ≥5 file campur (JPEG/PNG/WebP valid, 1 salah tipe, 1 >10 MB).
3. Verifikasi:
   - File invalid langsung ditandai gagal sebelum upload.
   - Progress per-file dan total berjalan.
   - Ringkasan sukses/gagal tampil setelah selesai.
   - Foto muncul di galeri publik setelah refresh.
   - Cover event otomatis terisi foto pertama bila belum ada cover.
4. Hapus satu foto via photo manager; verifikasi hilang dari galeri dan cover bergeser bila perlu.

### M3. Authenticated non-admin ditolak (pelengkap AC5)

1. Buat user uji lewat dashboard Supabase (Auth), TIDAK menambahkannya ke `admin_profiles`.
2. Login sebagai user itu → harus dialihkan dari `/admin`.
3. Coba INSERT `archives` via API memakai token user itu → harus 42501.

## Gap Diketahui (tidak dikerjakan — di luar lingkup sesi ini)

- Lightbox belum memiliki tombol **zoom** dan **download** (PRD §4 menyebutkan keduanya).
