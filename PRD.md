# PRD — Arsip Dokumentasi 17 Agustus

## 1. Ringkasan
Website arsip foto digital untuk dokumentasi perayaan 17 Agustus Karang Taruna. Arsip awal mencakup 2023–2026, tetapi tahun berikutnya harus dapat ditambahkan tanpa perubahan kode.

## 2. Tujuan
- Menggantikan penggunaan Google Drive sebagai tempat utama melihat dokumentasi.
- Menjelajah foto berdasarkan tahun dan acara.
- Gallery modern terinspirasi Google Photos.
- Bulk upload melalui drag & drop.
- Pengelolaan aman melalui authentication dan authorization.

## 3. Struktur Konten
Archive/Tahun → Event/Acara → Photos.

Contoh data awal:
- 2023 → Lomba, Karnaval, Tasyakuran
- 2024 → Lomba, Tasyakuran
- 2025 → Karnaval, Tasyakuran
- 2026 → Lomba, Karnaval, Tasyakuran

Tidak semua tahun harus memiliki semua event. Event yang tidak tersedia tidak ditampilkan.

## 4. Fitur Public
- Homepage.
- Daftar arsip berdasarkan tahun.
- Halaman tahun.
- Daftar event.
- Masonry/justified photo gallery.
- Fullscreen photo viewer/lightbox.
- Next/previous, zoom, download.
- Responsive desktop/mobile.
- Tahun dinamis dan tidak dibatasi 2026.

## 5. Fitur Admin
- Login admin.
- Dashboard.
- Tambah/edit tahun.
- Tambah/edit event.
- Set cover image.
- Bulk photo upload.
- Drag & drop banyak file.
- Progress upload.
- Manage/delete photos.
- Tidak ada public registration.

## 6. Security
- Supabase Auth untuk admin.
- PostgreSQL Row Level Security (RLS).
- Supabase Storage policies.
- Public hanya membaca konten gallery.
- Hanya admin yang boleh create/update/delete/upload.
- Validasi tipe dan ukuran file.
- `/admin` bukan mekanisme security; authorization harus dilakukan di backend/database/storage.
- Service-role secret tidak boleh masuk browser.

## 7. Data Model
### archives
- id
- year
- title
- description
- cover_image
- created_at

### events
- id
- archive_id
- name
- description
- cover_image
- created_at

### photos
- id
- event_id
- storage_path
- filename
- caption
- taken_at
- created_at

## 8. Storage
Gunakan Supabase Storage. Foto tidak disimpan di repository Git.

## 9. Non-Goals MVP
- Public user accounts.
- Social login.
- Comments/likes.
- AI tagging.
- Face recognition.
- Video support.
- Browser automation.
- Multi-role admin kompleks.

## 10. Acceptance Criteria
- Pengunjung dapat menemukan foto berdasarkan tahun dan event.
- Tahun baru dapat ditambahkan dari admin tanpa perubahan kode.
- Event dapat berbeda pada setiap tahun.
- Admin dapat mengunggah banyak foto sekaligus.
- Public tidak dapat upload/delete/update.
- Gallery nyaman di desktop dan mobile.
