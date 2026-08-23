# AGENT — Arsip Dokumentasi 17 Agustus

## 1. Mission
Build and maintain a modern, secure photo archive website for Karang Taruna's 17 Agustus documentation.

## 2. Source of Truth
Before implementing features, read:
- `PRD.md`
- `DESIGN.md`

Do not contradict them unless explicitly instructed by the user.

## 3. Preferred Stack
- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage

Use a clean, modular architecture.

## 4. Domain Rules
Years are dynamic data, not hard-coded application logic. 2023–2026 are initial records only. Support future years without source-code changes.

Events are dynamic. A year may have any number of events, including any subset of:
- Lomba
- Karnaval
- Tasyakuran

Never assume every year contains the same events.

## 5. Security Rules
- Public users can browse/read public archive content.
- Only authenticated admin users can manage archives/events/photos.
- Use Supabase RLS for database authorization.
- Use Supabase Storage policies for storage authorization.
- Never rely on `/admin` being secret.
- No public registration.
- Validate uploaded file type and size.
- Never expose service-role secrets to the browser.

## 6. Bulk Photo Upload
Admin workflow:
1. Select year.
2. Select event.
3. Drag/drop or choose multiple images.
4. Upload in a managed queue.
5. Show progress.
6. Store metadata.
7. Show success/failure summary.

Do not require assigning an event to each photo individually.

## 7. UX Priorities
1. Photo browsing.
2. Fast gallery loading.
3. Simple year/event navigation.
4. Reliable bulk upload.
5. Security.
6. Visual polish.

## 8. Implementation Discipline
- Inspect existing project before modifying files.
- Avoid unnecessary dependencies.
- Do not rewrite unrelated files.
- Keep components reusable.
- Handle loading, empty, and error states.
- Optimize images for gallery browsing.
- Do not store photos in Git.

## 9. Development Workflow
1. Read relevant requirements.
2. Inspect existing code.
3. Explain intended changes briefly.
4. Implement the smallest coherent change.
5. Run available checks/build/lint.
6. Report changes and remaining issues.

## 10. Current Scope
Start with the MVP in `PRD.md`. Do not add AI tagging, face recognition, social features, video support, or browser automation unless explicitly requested.
