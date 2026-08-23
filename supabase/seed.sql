-- ============================================================================
-- Seed: initial archives 2023–2026 (PRD §3).
-- Initial data ONLY — future years are created dynamically from the admin
-- dashboard and never require a new migration.
-- ============================================================================

insert into public.archives (year, title)
values
  (2023, 'HUT RI ke-78 — Dokumentasi 17 Agustus Karang Taruna'),
  (2024, 'HUT RI ke-79 — Dokumentasi 17 Agustus Karang Taruna'),
  (2025, 'HUT RI ke-80 — Dokumentasi 17 Agustus Karang Taruna'),
  (2026, 'HUT RI ke-81 — Dokumentasi 17 Agustus Karang Taruna')
on conflict (year) do nothing;
