# DESIGN — Arsip Dokumentasi 17 Agustus

## 1. Design Direction
Modern digital photo archive, terinspirasi Google Photos tetapi tidak menirunya secara literal. Gabungkan photo archive yang bersih, nuansa 17 Agustus, identitas Karang Taruna, dan sedikit sentuhan editorial fotografi.

Website harus terasa seperti arsip fotografi nyata, bukan website organisasi formal.

## 2. Brand Reference
Logo Karang Taruna tersedia di:
`public/brand/karang-taruna-logo.png`

Gunakan sebagai referensi identitas, bukan dekorasi besar di setiap halaman.

## 3. Color Direction
- Primary: deep navy, terinspirasi warna utama logo.
- Accent: warm orange/gold.
- Secondary: red sebagai aksen kecil bernuansa 17 Agustus.
- Neutral: off-white/light gray dan dark navy/charcoal.

Hindari interface full merah-putih atau terlalu ramai. Nuansa 17 Agustus muncul melalui aksen dan detail.

## 4. Typography
Sans-serif modern dan mudah dibaca. Heading boleh lebih editorial, body text tetap sederhana.

## 5. Homepage
Hero:
- Headline bernuansa dokumentasi, misalnya “Merayakan. Mengabadikan. Mengenang.”
- Subheadline tentang arsip dokumentasi 17 Agustus Karang Taruna.
- Collage beberapa foto.
- CTA ke arsip.

Archive section:
- Year cards dengan cover image.
- 2023–2026 sebagai data awal.
- Tahun berikutnya muncul otomatis setelah dibuat admin.

## 6. Year Page
- Breadcrumb/back navigation.
- Judul tahun.
- Event cards.
- Hanya event yang tersedia yang ditampilkan.
- Jangan tampilkan empty event cards.

## 7. Gallery
Gunakan masonry atau justified grid.
- Pertahankan aspect ratio foto.
- Hindari cropping agresif.
- Hover ringan.
- Loading/skeleton state.
- Lazy loading.
- Thumbnail/optimized preview bila diperlukan.

## 8. Photo Viewer
Fullscreen lightbox:
- foto besar,
- previous/next,
- close,
- zoom,
- download,
- caption/metadata.
Keyboard navigation pada desktop.

## 9. Admin UI
Konsisten dengan visual public tetapi lebih utilitarian.

Upload:
- drag & drop zone,
- file picker,
- multi-file selection,
- progress per upload dan overall,
- pilih tahun dan event sebelum upload,
- validasi file,
- success/error summary.

## 10. Responsive
Mobile first-class:
- gallery menyesuaikan lebar,
- navigation sederhana,
- lightbox nyaman disentuh,
- upload tetap usable.

## 11. Motion
Animasi ringan untuk gallery hover, transitions yang wajar, upload progress. Hindari animasi berat.
