# Design: Team Logos — Supabase Storage, File Upload, Shield Seeding

## Goals

1. Make shield storage durable (Supabase Storage, public bucket `logos`) while keeping `local` as the default dev/test backend.
2. Let admins upload shield files (multipart) instead of pasting URLs; keep the JSON `{url}` path working.
3. Populate shields for the 66 seeded teams via an idempotent `seed-shields` script.

## Architecture Decisions

### Decision D1: Port extension — `storeFromBuffer(bytes, teamId)`

**Choice**: Add `storeFromBuffer(bytes: Uint8Array, teamId: number): Promise<string | null>` to `ImageService`. Extract the shared validation into `server/src/infrastructure/images/image-validation.ts`: `sniffImageType`, `MAX_IMAGE_BYTES` (1 MiB), `EXTENSIONS`, plus `downloadBytes(url, logger)` (fetch + 10s timeout + arrayBuffer) reused by both adapters. `LocalFileImageService` re-exports `sniffImageType`/`MAX_IMAGE_BYTES` so existing test imports keep working; its `downloadAndStore` becomes `downloadBytes → validate → storeFromBuffer`. The new `SupabaseImageService` implements both methods with the same shared path.

**Alternatives considered**: (a) put validation in the route layer — rejected: duplicates the single validated write path the spec requires; (b) leave validation private to each adapter — rejected: download/upload/seed would each re-implement sniff+cap.

**Rationale**: One validated write path for uploads, downloads, and seeding (spec "Buffer Store Operation"). The adapter owns value semantics: local returns relative `logos/{id}.{ext}`, supabase returns the full public URL — both are what `teams.logo` persists.

### Decision D2: Storage backend — `IMAGE_STORAGE` env + factory

**Choice**: `IMAGE_STORAGE=local|supabase` (default `local`) added to `server/src/config/env.ts` as optional zod fields (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` optional). New `server/src/infrastructure/images/image-service-factory.ts` exports `createImageService({ storage, supabaseUrl, supabaseServiceRoleKey, logosDir, logger })`: returns `LocalFileImageService` for `local`; for `supabase` with missing credentials logs an error and FAILS SOFT to local (spec "Storage Backend Selection"); otherwise `SupabaseImageService`. `index.ts` wires it from `env`; `seed-shields.ts` builds it from `process.env` (dotenv pattern like `seed-leagues-teams.ts`, avoiding `env.ts`'s JWT_SECRET hard-fail).

**Alternatives considered**: inline if/else in `index.ts` — rejected: untestable fail-soft logic; env var switch in the adapters themselves — rejected: service shouldn't know about selection.

**Supabase client — choice: `@supabase/supabase-js` v2 (upload + `getPublicUrl`).** Alternatives: raw REST via fetch — rejected: hand-rolls auth headers, signed uploads, error handling; supabase-js is the canonical client. Upload path inside bucket: `team-{teamId}.{ext}` with `{ contentType, cacheControl: '30d', upsert: true }`; `getPublicUrl` yields `…/storage/v1/object/public/logos/team-{teamId}.{ext}`. `upsert: true` replaces the old object on re-upload (no orphans, mirrors local overwrite).

### Decision D3: Multipart route — `POST /api/admin/teams/:teamId/logo`

**Choice**: Register `@fastify/multipart` v9 (Fastify 5) in `index.ts` with `{ limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }` so oversized payloads are cut at the transport (no unbounded memory buffering). Route branches on `request.isMultipart()`:

- multipart → `request.file()` → `await file.toBuffer()` → `setTeamLogoUseCase.execute({ teamId, bytes })`
- JSON → `setTeamLogoSchema` (unchanged) → `execute({ teamId, url })`

`SetTeamLogoInput` becomes `{ teamId; url?: string; bytes?: Uint8Array }`; the use case calls the matching port method (download vs `storeFromBuffer`) and returns `{ team: TeamDTO; stored: boolean }`. Route error contract (spec team-registry): `stored === false` → multipart: `415 { message }`; JSON: `400 { message }`; plugin size-limit → error handler maps `FST_REQ_FILE_TOO_LARGE` → `400`. The team is only ever updated after a successful store — a failed upload never changes it.

**Alternatives considered**: use case takes a pre-built logo value — rejected: pushes acquisition orchestration into routes; branching inside the use case keeps the "store-then-persist" invariant next to the repo write. Silent null (current behavior) — rejected: spec requires surfacing errors for unreachable URLs too, so the JSON path also reports `stored: false`.

### Decision D4: Client file picker + UX flow

**Choice**: TeamForm swaps the URL input for `<input type="file" accept="image/png,image/jpeg,image/webp">` with `URL.createObjectURL` preview (revoked on change/unmount), client-side validation (type + ≤1 MiB) with inline error blocking save. Flow: **two-step (a)** — extend `onSubmit(payload, selectedFile?)`; parent (`LeagueCard`) runs `createTeam/updateTeam` first, then on success chains `useSetTeamLogo.mutate({ teamId, data: FormData })` when a file is pending ("Subiendo escudo..." state). `logoUrl` is omitted from the team payload while a file is selected.

**Alternatives considered**: (b) upload-first then create with returned URL — rejected: `CreateTeamPayload.logoUrl` means "server downloads this URL", so we'd need a whole new "upload → URL" endpoint; (c) single multipart request for team+file — rejected: different endpoints.

**Rationale**: two-step reuses the existing create/update and logo endpoints untouched (spec "Save uploads via FormData"); a failed upload after a successful save surfaces in the card error box and is retryable via re-edit.

### Decision D5: `seed-shields` script

**Choice**: New `server/scripts/seed-shields.ts` + `"seed:shields": "tsx scripts/seed-shields.ts"` (following `seed:teams`). For each team with `logo IS NULL` (all with `--force`): resolve via Wikimedia `action=query&prop=pageimages&piprop=thumbnail&pithumbsize=256&format=json` (es.wikipedia.org, team name then first alias), fallback TheSportsDB `searchteams.php?t={name}` (key `3`, optional `THESPORTDB_API_KEY` override) → `downloadAndStore` via the factory-built service → `db.update(teams).set({ logo })`. `sleep(~300ms)` between requests (Wikimedia/TheSportsDB rate limits — noted). Per-team updates, no transaction; summary counts stored/skipped/unresolved + unresolved names for manual curation. Re-runs skip existing logos.

### Decision D6: Downstream URL handling

**Choice**: `resolveLogoUrl` already passes `https?://` through and prefixes `/public/` otherwise — supabase public URLs pass through unchanged. **No change**. Vite's `/public` proxy only serves local-mode relative paths; in supabase mode URLs hit the storage origin directly. `<img onError>` hiding (Equipos/MatchRow) stays as the broken-logo fallback.

## Data Flow

```
Admin: File ──▶ POST /logo (multipart) ──▶ @fastify/multipart (1MiB cap)
        ──▶ SetTeamLogoUseCase ──▶ storeFromBuffer ──▶ ImageService adapter
        ──▶ teams.logo (relative | full public URL) ──▶ resolveLogoUrl ──▶ <img>
seed-shields: Wikimedia/TheSportsDB ──▶ downloadAndStore ──▶ same adapter path
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `server/src/domain/ports/image-service.ts` | Modify | Add `storeFromBuffer(bytes, teamId)` |
| `server/src/infrastructure/images/image-validation.ts` | Create | `sniffImageType`, `MAX_IMAGE_BYTES`, `EXTENSIONS`, `downloadBytes` |
| `server/src/infrastructure/images/local-file-image-service.ts` | Modify | Delegate to shared validation + `storeFromBuffer`; re-export validation for test compat |
| `server/src/infrastructure/images/supabase-image-service.ts` | Create | `@supabase/supabase-js` adapter (bucket `logos`, `cacheControl 30d`, `upsert`) |
| `server/src/infrastructure/images/image-service-factory.ts` | Create | `createImageService(...)` with fail-soft selection |
| `server/src/config/env.ts` | Modify | `IMAGE_STORAGE` (default `local`), optional `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `server/src/index.ts` | Modify | Factory wiring; `@fastify/multipart` registration; pass to admin routes |
| `server/src/infrastructure/http/routes/admin-routes.ts` | Modify | Logo route multipart branch + error contract; `stored` result handling |
| `server/src/application/teams/set-team-logo-use-case.ts` | Modify | `url?`/`bytes?` input; return `{ team, stored }` |
| `server/package.json` | Modify | `@fastify/multipart`, `@supabase/supabase-js`; `seed:shields` script |
| `server/scripts/seed-shields.ts` | Create | Idempotent shield seeder |
| `client/src/components/admin/Equipos.tsx` | Modify | File input + preview + validation; two-step save orchestration |
| `client/src/api/admin-api.ts` | Modify | `setTeamLogo(teamId, FormData \| {url})` multipart support |
| `client/src/hooks/use-teams.ts` | Modify | `useSetTeamLogo` accepts FormData payload |

## Data Model / Migration

`teams.logo` (text) already exists and stores whatever the service returns — **no schema change, no migration**. Legacy relative paths keep resolving via `resolveLogoUrl`.

## Testing Strategy

| Unit | What | Approach |
|------|------|----------|
| `image-validation` | sniff (PNG/JPEG/WebP/HTML/truncated), cap, `downloadBytes` | Extend existing `local-file-image-service.test.ts` pattern |
| `LocalFileImageService` | existing 6 tests stay green; `storeFromBuffer` valid/invalid/oversized/no-throw | Unit with tmp dir + stub fetch |
| `SupabaseImageService` | `storeFromBuffer` maps upload/getPublicUrl, null on error; `downloadAndStore` delegates | Mock supabase-js client (no network) |
| factory | default local; supabase ok; missing creds → fail-soft local + log | Unit |
| `SetTeamLogoUseCase` | bytes path, url path, `stored:false` keeps team, 404 | Extend `teams-use-cases.test.ts` (mock repo/service) |
| admin routes | multipart valid → 200 + update; oversized → 400; invalid bytes → 415; JSON unreachable → 400; team unchanged | Extend `api.test.ts` (mock `storeFromBuffer`) |
| `Equipos.tsx` | pick valid → preview; invalid type/size → inline error + blocked save; save chains upload | Extend `Equipos.test.tsx` (mock `useSetTeamLogo`) |
| `seed-shields` | skip-with-logo, `--force`, unresolved reported, summary | Script test with mocked fetch + in-memory team list |

## Risks / Open Questions

- Wikimedia/TheSportsDB rate limits or shape changes → TheSportsDB fallback + skip/report (D5); the ~300ms delay is a heuristic, tune in apply if 429s appear.
- Upload failure after team save leaves team saved without logo → surfaced in card error box; retry via re-edit (accepted UX tradeoff, spec allows).
- Supabase project/bucket must exist (`logos` public) — documented in proposal dependencies; fail-soft only guards config, not bucket existence.
- `@fastify/multipart` version pin for Fastify 5 (`^9`); verify exact major during apply.
- Open: none blocking — all scope decisions settled in the proposal.

No migration required.
