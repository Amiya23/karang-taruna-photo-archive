# Karang Taruna 17 Agustus Photo Archive

Web archive for Karang Taruna 17 Agustus event photos. A public gallery per year, plus a small admin panel used to upload, organize, and clean up photos.

Live: https://karang-taruna-photo-archive.vercel.app

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) and React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Auth and database | Supabase, SSR client in the app and service role on the server only |
| Photo storage | S3 compatible object storage, Cloudflare R2 or Backblaze B2 |
| Image processing | sharp |
| Deploy | Vercel |

## Features

- Public archive per year with thumbnails and a full view per photo.
- Admin login, then panels for archives and site settings.
- Upload flow that validates and optimizes images before they reach storage.
- Signed URLs for private objects, cached with a TTL so the gallery stays fast.
- Storage cleanup helpers to find and remove orphaned objects.
- Import script for bulk photo ingestion and a migration script that moves objects from Backblaze B2 to Cloudflare R2.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase and object storage credentials
npm run dev
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | development server |
| `npm run build` | production build |
| `npm run start` | serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | node:test suites for the `src/lib` helpers |

The test command compiles the focused `src/lib` modules and runs their suites. Covered today: download helpers, storage cleanup, storage formatting, B2 path building, cache TTL, photo URL building, R2 path building and routing, and hero settings.

## Project layout

```text
src/app              public archive, admin panel (login plus panel group), API routes
src/components       shared UI
src/lib              storage, URL, formatting, and cache helpers, each with tests
src/middleware.ts    admin route protection
supabase/            SQL migrations and seed data
scripts/             storage connection tests, photo import, B2 to R2 migration
public/brand/        logo and brand assets
```

## Environment

Everything stays in `.env.local`. Only `NEXT_PUBLIC_` prefixed variables reach the browser. The Supabase service role key and the object storage credentials are server only and must never be prefixed with `NEXT_PUBLIC_`.

## Documentation

| File | Contents |
|---|---|
| `PRD.md` | product requirements |
| `DESIGN.md` | design system and screen specifications |
| `AGENT.md` | working notes for AI agents on this repository |
| `ACCEPTANCE-TESTS.md` | acceptance checklist |
