# Changelog

## 2026-08-09 — team-logos

Archived change: Team Logos (Supabase Storage, File Upload, Shield Seeding) on branch `feature/teams-leagues`. Planning commit `38a6d39`; implementation PRs #39 `7a8e9bf`, #40 `84edbb7`, #41 `84c7a0d`, #42 `22f211a`, #43 `0644a40`; archived by the `docs(openspec)` archive commit (this entry).

### Features

- **Durable shield storage via backend selection**: new `IMAGE_STORAGE=local|supabase` (default `local`); `SupabaseImageService` writes to public bucket `logos` with cache-control `30d` non-immutable and stores the full public URL in `teams.logo`; invalid supabase config fails soft to local with a clear log.
- **Shared validated write path**: `ImageService.storeFromBuffer(bytes, teamId)` added to the port; magic-byte sniff (PNG/JPEG/WebP) + 1 MiB cap reused by uploads, downloads and seeding; `downloadAndStore` delegates through the same path; never throws.
- **Multipart shield upload**: `POST /api/admin/teams/:teamId/logo` accepts multipart `file` (`@fastify/multipart`, transport-level 1 MiB cap) and keeps JSON `{url}` compatibility; failed uploads (oversized / invalid format / unreachable URL) never change the team and surface the error (415 multipart, 400 JSON).
- **Admin file picker UX**: TeamForm swaps the URL input for a native file picker (`accept="image/png,image/jpeg,image/webp"`) with `createObjectURL` preview and client-side validation; save posts multipart FormData via a two-step create/update → upload flow ("Subiendo escudo...").
- **`seed-shields` script**: idempotent population of the 66 seeded teams via Wikimedia `pageimages` (pithumbsize 256) with TheSportsDB fallback; skips teams with a logo unless `--force`; ~300ms rate-limit sleep; per-team updates with stored/skipped/unresolved summary.

### Scope

Server + client (both fully implemented and verified). Out of scope: SVG support/transcoding, multi-bucket admin UI, migration of legacy `logos/{id}.{ext}` files to Supabase (URLs pass through; `resolveLogoUrl` handles absolute URLs).

### Verification

- Server: 530 tests passed, `tsc --noEmit` clean.
- Client: 260 tests passed, `tsc --noEmit` clean.
- Total: 790 tests, verdict PASS WITH WARNINGS — the two warnings were documentation-only (D2 key-format drift and stale test-count reference) and were corrected in this archive commit.

## 2026-08-09 — teams-leagues

Archived change: Teams & Leagues (Phase 1) on branch `feature/teams-leagues`.

### Features

- **Leagues + teams registry (M2M)**: `leagues` and `teams` entities with many-to-many `team_leagues` memberships; normalized-unique league and team names (global for teams) with 409 collisions; guarded deletes (league with memberships, team referenced by matches); team autocomplete per league.
- **Self-hosted team logos**: download → magic-byte validation (PNG/JPEG/WebP, 1 MiB cap) → store under `public/logos/`; served via `@fastify/static` with ~30d cache; DB stores relative paths only; failures never block team creation (null logo); manual URL fallback retained.
- **Admin Equipos tab**: league create/edit/delete and team create/edit/delete with league multi-select memberships; blocked deletes and last-membership errors surfaced in the UI.
- **Match form team selection**: AddMatchForm and MatchRow editable rows use a UI-only league selector + team autocomplete; picking a team fills name, auto-fills the shield, and submits `localTeamId`/`visitorTeamId`; free text removed from create/edit; legacy string-only matches keep rendering and editing (nullable FKs, strings remain display source of truth).
- **Seed**: real Primera A + Primera B (Nacional) rosters with aliases and memberships; idempotent re-run; shield download failures skip gracefully.

### Scope

Server + client (both fully implemented and verified). Out of scope for Phase 1: API-FOOTBALL fixture ingestion and multi-league match dates (Phase 2).

### Verification

- Server: 475 tests passed (34 files), `tsc --noEmit` clean.
- Client: 253 tests passed (18 files), `tsc --noEmit` clean, `pnpm build` clean.
- Verdict: PASS — zero CRITICAL/WARNING issues; 2 PARTIAL items are test-coverage refinements only.
