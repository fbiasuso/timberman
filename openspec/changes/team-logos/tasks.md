# Tasks: Team Logos — Supabase Storage, File Upload, Shield Seeding

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,500 (server ~1,130 + client ~370) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Single PR on `feature/teams-leagues` with 5 work-unit commits (U1→U5) — no PR chain per delivery context |
| Delivery strategy | ask-always (C1) |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| U1 | Shared validation + port + local refactor (D1) | commit 1 | base `feature/teams-leagues`; tests included |
| U2 | SupabaseImageService + factory + env wiring (D2) | commit 2 | depends on U1 |
| U3 | Use-case return type + multipart logo route (D3) | commit 3 | depends on U2 |
| U4 | Client upload UX + two-step flow (D4) | commit 4 | depends on U3 |
| U5 | seed-shields script (D5) | commit 5 | depends on U2 |

## Phase 1: Server Core — validation, port, adapters, env (D1, D2)

### U1 — Extract shared validation + extend port + refactor LocalFileImageService (D1)

**Summary**: Move sniff/cap/download into `image-validation.ts`; add `storeFromBuffer(bytes, teamId)` to the `ImageService` port; `LocalFileImageService` re-exports validation (test compat) and delegates `downloadBytes → validate → storeFromBuffer`.
**Files**: `server/src/infrastructure/images/image-validation.ts` (new), `server/src/domain/ports/image-service.ts` (mod), `server/src/infrastructure/images/local-file-image-service.ts` (mod), `server/src/infrastructure/images/__tests__/local-file-image-service.test.ts` (extend)
**Dependencies**: none
**Est. lines**: server ~240 | client 0

- [x] T1 (U1) — Create `image-validation.ts` (`sniffImageType`, `MAX_IMAGE_BYTES` 1 MiB, `EXTENSIONS`, `downloadBytes` with 10s timeout); add `storeFromBuffer` to port; refactor `LocalFileImageService` to delegate; re-export validation — acceptance: existing 6 tests stay green; `storeFromBuffer` returns `logos/{id}.{ext}` for valid PNG/JPEG/WebP, null + no write on invalid/oversized, never throws (spec "Buffer Store Operation").

### U2 — SupabaseImageService + factory + env wiring (D2)

**Summary**: New `SupabaseImageService` (`@supabase/supabase-js`, bucket `logos`, `cacheControl 30d`, `upsert`, `getPublicUrl`); `createImageService` factory with fail-soft-to-local; `IMAGE_STORAGE`/`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` env; wire factory into `index.ts`; add dependency.
**Files**: `server/src/infrastructure/images/supabase-image-service.ts` (new), `server/src/infrastructure/images/image-service-factory.ts` (new), `server/src/config/env.ts` (mod), `server/src/index.ts` (mod), `server/package.json` (mod: `@supabase/supabase-js`), `server/src/infrastructure/images/__tests__/supabase-image-service.test.ts` (new), `server/src/infrastructure/images/__tests__/image-service-factory.test.ts` (new)
**Dependencies**: U1 (port method)
**Est. lines**: server ~290 | client 0

- [x] T2 (U2) — Add `SupabaseImageService` + factory + env fields; wire into `index.ts` via `createImageService` — acceptance: default `local`; `supabase` + creds → supabase adapter (mocked client, no network); missing creds → fail-soft local + error log (spec "Storage Backend Selection"); `storeFromBuffer` uploads `logos/{teamId}.{ext}` and returns public URL, null on error, never throws.

## Phase 2: Server Routes — multipart logo endpoint (D3)

### U3 — Use-case return type + multipart branch + error contract (D3)

**Summary**: `SetTeamLogoInput` → `{ teamId; url?; bytes? }`, return `{ team, stored }`; register `@fastify/multipart` (`fileSize: MAX_IMAGE_BYTES`, `files: 1`) in `index.ts`; logo route branches on `isMultipart()` (file → buffer → `storeFromBuffer`; JSON `{url}` unchanged); error mapping.
**Files**: `server/src/application/teams/set-team-logo-use-case.ts` (mod), `server/src/infrastructure/http/routes/admin-routes.ts` (mod), `server/src/index.ts` (mod), `server/package.json` (mod: `@fastify/multipart`), `server/src/application/__tests__/teams-use-cases.test.ts` (extend), `server/src/infrastructure/http/__tests__/api.test.ts` (extend)
**Dependencies**: U2 (storeFromBuffer + service wiring)
**Est. lines**: server ~280 | client 0

- [x] T3 (U3) — Change use-case input/return; add multipart registration + route branch + error contract; extend use-case and API tests — acceptance (spec team-registry): JSON `{url}` works; valid multipart `file` → 200 + `teams.logo` updated; oversized → 400 (`FST_REQ_FILE_TOO_LARGE`), team unchanged; invalid format → 415 `{message}`; unreachable URL (JSON) → 400, existing logo kept; team 404 preserved; team only updated after successful store.

## Phase 3: Client — file picker, preview, two-step upload (D4)

### U4 — TeamForm file input + validation + FormData upload flow (D4)

**Summary**: `admin-api.setTeamLogo(teamId, FormData | {url})`; `useSetTeamLogo` accepts FormData; TeamForm swaps URL input for `<input type="file" accept="image/png,image/jpeg,image/webp">` with `createObjectURL` preview (revoked) + client validation (type, ≤1 MiB) inline error blocking save; `LeagueCard` chains `useSetTeamLogo` after create/update success ("Subiendo escudo..."); `logoUrl` omitted while a file is selected.
**Files**: `client/src/api/admin-api.ts` (mod), `client/src/hooks/use-teams.ts` (mod), `client/src/components/admin/Equipos.tsx` (mod), `client/src/components/__tests__/Equipos.test.tsx` (extend)
**Dependencies**: U3 (multipart endpoint)
**Est. lines**: server 0 | client ~370

- [ ] T4 (U4) — Multipart transport (admin-api + hook) then TeamForm file picker/preview/validation + two-step save; extend `Equipos.test.tsx` (mock `useSetTeamLogo`) — acceptance (spec admin-operations): valid selection previews + save enabled; invalid type → inline error + save blocked; oversized → blocked; save posts multipart FormData and list refreshes; team without logo adds one; existing logo replaced.

## Phase 4: Seed — shield population (D5)

### U5 — seed-shields script + npm script (D5)

**Summary**: New `server/scripts/seed-shields.ts` + `"seed:shields": "tsx scripts/seed-shields.ts"`. For teams with `logo IS NULL` (all with `--force`): Wikimedia `pageimages` (pithumbsize 256) → TheSportsDB fallback (`THESPORTDB_API_KEY` override) → store via factory-built service → update `teams.logo`; ~300ms sleep between requests; per-team updates, no transaction; summary stored/skipped/unresolved + unresolved names.
**Files**: `server/scripts/seed-shields.ts` (new), `server/package.json` (mod: script), `server/src/scripts/__tests__/seed-shields.test.ts` (new — must live under `src/` so vitest `src/**/*.test.ts` picks it up)
**Dependencies**: U2 (factory + validated write path)
**Est. lines**: server ~320 | client 0

- [ ] T5 (U5) — Write `seed-shields.ts` (export testable run function; build service from `process.env`, dotenv — avoids `env.ts` JWT_SECRET hard-fail) + npm script + script test (mocked fetch, in-memory teams) — acceptance (spec "Seed Shields Population"): Wikimedia primary; TheSportsDB fallback; existing logo skipped; `--force` re-syncs; unresolved listed and script completes; summary counts correct.

## Phase 5: Verification — change-wide gate

### U6 — Full-suite verification gate (no code)

**Summary**: Prove the whole change: server + client suites and type checks green.
**Files**: none
**Dependencies**: U1–U5
**Est. lines**: 0 | 0

- [ ] T6 (U6) — Run `npm run lint` (tsc --noEmit) + `npm test` in `server/`, then `npm run lint` + `npm test` in `client/` — acceptance: full suite (728+ existing + new) green on both sides, tsc clean, no regressions in `resolveLogoUrl`/static serving (D6 untouched).

## Review Workload Forecast (summary)

- Total estimated changed lines: **~1,500** — server **~1,130** (U1 ~240, U2 ~290, U3 ~280, U5 ~320) + client **~370** (U4)
- Exceeds 400-line budget: **Yes** (~3.75×)
- Chained PRs recommended: **Yes** (work units are chain-ready slices; per delivery context they land as commits in the single `feature/teams-leagues` PR)
- 400-line budget risk: **High**
- Decision needed before apply: **Yes** (ask-always C1 — orchestrator stops and asks before sdd-apply)
