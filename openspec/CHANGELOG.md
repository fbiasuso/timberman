# Changelog

## 2026-08-14 — apk-lts-hosting

Archived change: LTS APK Hosting on Supabase Storage on branch `feat/apk-lts-hosting` (PR #61). Planning commits `0b2d604`, `ec7ff1b`, `064ea6e`; implementation via PR #61 (merge `38265d4`); archived by the `docs(openspec)` archive commit (this entry).

### Features

- **LTS download link on `/install`**: `client/public/install.html` download button href → `https://uwjcgmitaedkawgaqrfk.supabase.co/storage/v1/object/public/apk/timberman.apk` (public Supabase Storage bucket `apk`, path `timberman.apk`); no GitHub Releases link.
- **GitHub-free install page**: footer "Ver todas las versiones publicadas" link removed; footer renders plain text `Versión estable — actualizada manualmente`; `git grep github.com` → 0 matches.
- **README LTS distribution docs**: "Android APK (sideload)" section documents the LTS URL as download source and the manual per-release upload procedure — Supabase dashboard (Storage → bucket `apk` → overwrite + headers) or Storage API curl with `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` from `server/.env` (`upsert=true`, `Cache-Control: no-cache`, content type `application/vnd.android.package-archive`); keystore custody and version-bump cadence kept.
- **GitHub Releases untouched**: `.github/workflows/android-apk.yml` and `netlify.toml` have no diff vs main; releases preserved as backup, never linked from `/install`.

### Scope

Static change only: `client/public/install.html` + `README.md`. Out of scope: workflow/CI changes, automated bucket upload (manual per release is a deliberate design choice), server/client app code.

### Verification

- Static greps + `git diff origin/main...feat/apk-lts-hosting` scope check green; live `HEAD` on the LTS URL → HTTP 200 (`application/vnd.android.package-archive`, ~3.3 MB).
- Verdict: PASS WITH WARNINGS — 4/4 spec requirements compliant, zero CRITICAL; 1 non-blocking open follow-up: task 3.2 manual device E2E (install-over-previous-version on real Android) remains for the human release owner.

## 2026-08-14 — capacitor-apk

Archived change: Android APK distribution via Capacitor 8 (sideload) on branch `feature/capacitor-apk` (chained PRs #46–#50). Planning commit `fb93eef`; implementation PRs #46 `c0edb58`, #47 `55da4a1`, #48 `b149de5`, #49 `1410d49`, #50 `34d54b3`; archived by the `docs(openspec)` archive commit (this entry).

### Features

- **Capacitor 8 WebView shell**: `@capacitor/core@^8.5.0` + CLI/android/app devDeps; `capacitor.config.ts` (`com.timberman.prode` / `Timberman` / `webDir dist`); committed `client/android/` scaffold (54 files) so clean checkouts build without `cap add`; dark launch theme `#132421`.
- **Relative asset loading**: `vite.config.ts` `base: './'` so assets resolve under the WebView origin `https://localhost`; web build on Netlify unchanged.
- **Build-time API URL**: workflow builds with `VITE_API_URL=https://timberman-api.onrender.com` (HTTPS); missing `VITE_API_URL` fails the build with no artifact.
- **Back-button navigation**: `use-back-button.ts` via `@capacitor/app` — inner routes `history.back()`, root `exitApp()`; native-only guard keeps web tests green.
- **Signed release APK pipeline**: GitHub Actions (Node 22 + pnpm 11 frozen install, `cap sync android`, JDK 21 + SDK licenses, `assembleRelease`) signing with the release keystore from GitHub secrets, artifact upload + GitHub Release asset `Timberman.apk` (tag `v{version}`); keystore absent fails loudly (secret gate + Gradle guard), no unsigned APK possible; in-place updates preserve data.
- **Central app-version constant**: `APP_VERSION` from `client/package.json` (single source, tested) — hook for a future forced-update check; every release bumps the version.
- **Install landing page**: mobile-first es-AR `client/public/install.html` (dark `#132421`, unknown-sources steps, latest APK link) with `netlify.toml` redirect `/install → /install.html` before the SPA fallback.

### Scope

Client + build/distribution only. Out of scope: server changes, Google Play/AAB, TWA, push notifications, native splash (no logo asset), forced-update mechanism (version constant is its hook).

### Verification

- Client: 273 tests passed (21 files) + `tsc && vite build` green on fresh runs.
- Device E2E (Android 9+): features render without 404s, back navigates/exits at root, JWT session survives restart, in-place updates preserve data (v0.1.1 → v0.1.2 → v0.1.3).
- Live: GET https://timbermanpro.netlify.app/install → 200 serving the install page.
- Verdict: PASS — 17/17 spec scenarios compliant, zero CRITICAL/WARNING; 2 non-blocking SUGGESTIONs tracked for a future cleanup (gate Eliminar on pending save in Equipos.tsx; remove vestigial `.team-row-actions` CSS).

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
