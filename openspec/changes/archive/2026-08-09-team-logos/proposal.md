# Proposal: Team Logos — Supabase Storage, File Upload, Shield Seeding

## Intent

Shields are core to the cartelera UX, but today they are fragile end to end. The admin form only accepts a remote URL (`client/src/components/admin/Equipos.tsx` TeamForm), so every logo depends on a third-party URL staying alive. Locally, downloaded files live on `server/public/logos` — ephemeral disk that Render wipes on redeploy, so prod logos disappear. This change makes shield storage durable (Supabase Storage), lets admins upload files instead of pasting URLs, and populates the 66 seeded teams with real shields via an idempotent script.

## Scope

### In Scope
- **Supabase Storage hosting**: new `SupabaseImageService` writing to public bucket `logos` (cache-control `30d` non-immutable); `teams.logo` stores the FULL public URL. `LocalFileImageService` stays for dev/tests; selection via `IMAGE_STORAGE=local|supabase` (default `local`).
- **Port extension**: `ImageService.storeFromBuffer(bytes, teamId): Promise<string|null>`; uploaded files and downloaded shields share one validated write path (magic-byte sniff, 1 MiB cap). `downloadAndStore` keeps working.
- **File upload in admin**: TeamForm swaps URL text input for `<input type="file">` + `URL.createObjectURL` preview + validation (accept png/jpeg/webp, <=1 MiB), posted as multipart/form-data. Server adds `@fastify/multipart` on `POST /api/admin/teams/:teamId/logo`, keeps JSON compatibility for existing tests.
- **`seed-shields` script**: idempotent; resolves each team's shield via Wikimedia (es.wikipedia.org `action=query&prop=pageimages&pithumbsize=256` / `piprop=thumbnail`) → fallback TheSportsDB (`searchteams.php?t={name}` badge), downloads with the existing pipeline, uploads to Supabase, updates `teams.logo`, reports unresolvable teams for manual curation. Skips teams with a logo unless `--force`.

### Out of Scope
- Phase 2 fixtures / API-FOOTBALL ingestion (later change)
- SVG support / transcoding — wiki thumbs come as PNG, no conversion
- Multi-bucket admin UI / bucket management screens
- Migration of legacy `logos/{id}.{ext}` files to Supabase (URLs pass through; `resolveLogoUrl` already handles absolute URLs)

## Assumptions

Decisions confirmed with the maintainer:
- Supabase Storage is the production host (public bucket `logos`, full public URL in `teams.logo`).
- Wikimedia primary + TheSportsDB fallback for shield resolution.
- This change runs on the same branch (`feature/teams-leagues`), same-branch SDD.
- `IMAGE_STORAGE` defaults to `local`; Supabase mode is opt-in per environment.

## Capabilities

### New Capabilities
None — all changes extend existing capabilities.

### Modified Capabilities
- `team-image-hosting`: storage model changes (local relative path → Supabase public URL; `storeFromBuffer` added to the port; shared validation reused by uploads and downloads).
- `team-registry`: shield input semantics change — admins upload a file (multipart) instead of providing a URL; `POST /api/admin/teams/:teamId/logo` accepts multipart with JSON kept compatible.
- `admin-operations`: Equipos TeamForm renders file input with preview and client-side validation; shield is uploaded via multipart.

## Approach

1. Extract shared validation (`sniffImageType`, 1 MiB cap) into a reusable helper; add `storeFromBuffer` to the `ImageService` port; `LocalFileImageService.downloadAndStore` delegates to it.
2. Add `SupabaseImageService` (`@supabase/supabase-js`): `storeFromBuffer` uploads `team-{teamId}.{ext}` to bucket `logos`, returns the public URL; `downloadAndStore` = download → shared validation → upload. Select in `server/src/index.ts` via new `IMAGE_STORAGE` env (plus `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
3. Server: register `@fastify/multipart`; `POST /api/admin/teams/:teamId/logo` branches on `request.isMultipart()` — file → buffer → `storeFromBuffer`; JSON `{url}` → existing `downloadAndStore`. `SetTeamLogoUseCase` accepts a pre-built logo value (URL from buffer path or download).
4. Client: TeamForm file input with preview and validation; upload helper posts multipart; invalid/oversized files blocked client-side before upload.
5. `server/scripts/seed-shields.ts`: for each team without a logo (or all with `--force`), resolve → download → upload → update `teams.logo`; log failures in a curated list. Safe to re-run.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/src/domain/ports/image-service.ts` | Modified | Add `storeFromBuffer(bytes, teamId)` |
| `server/src/infrastructure/images/image-validation.ts` | New | Shared magic-byte sniff + 1 MiB cap |
| `server/src/infrastructure/images/local-file-image-service.ts` | Modified | Delegate to shared validation + buffer path |
| `server/src/infrastructure/images/supabase-image-service.ts` | New | Supabase Storage implementation |
| `server/src/index.ts`, `server/src/config/env.ts` | Modified | `IMAGE_STORAGE` + Supabase env selection |
| `server/src/infrastructure/http/routes/admin-routes.ts` | Modified | Multipart on logo route, JSON compat |
| `server/src/application/teams/set-team-logo-use-case.ts` | Modified | Buffer-based store path |
| `server/package.json` | Modified | `@fastify/multipart`, `@supabase/supabase-js` |
| `client/src/components/admin/Equipos.tsx` | Modified | TeamForm file input + preview + validation |
| `client/src/api/` | Modified | Multipart upload helper |
| `server/scripts/seed-shields.ts` | New | Idempotent shield seeder (66 teams) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Wikimedia rate limits / API changes | Med | TheSportsDB fallback, per-team retry, skip + report |
| Some clubs unresolvable (small/short-lived names) | Med | Report list for manual curation via the new upload form |
| Supabase bucket missing/misconfigured | Low | Fail-soft to local; clear env validation |
| Multipart oversized payloads | Low | `@fastify/multipart` limits + shared 1 MiB cap |
| Existing relative-path logos in DB | Low | `resolveLogoUrl` still resolves relative paths; no data migration |

## Rollback Plan

- Flip `IMAGE_STORAGE` back to `local` — no code revert needed; both services coexist.
- `teams.logo` is a plain text column; reverting only changes future writes, existing URLs keep rendering.
- `seed-shields` is idempotent and non-destructive (update-only); re-running with `--force` re-syncs.
- No schema migration, no destructive operation — drop the change at any point.

## Dependencies

- Supabase project with public bucket `logos` and credentials (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
- `@fastify/multipart`, `@supabase/supabase-js`
- Wikimedia (es.wikipedia.org) and TheSportsDB API availability

## Success Criteria

- [x] With `IMAGE_STORAGE=supabase`, `teams.logo` stores the full public URL; dev/test with `local` unchanged
- [x] `storeFromBuffer` shares the validated write path; all existing image-service tests pass
- [x] TeamForm uploads a file with preview; invalid type/size blocked client-side; `POST /api/admin/teams/:teamId/logo` works for both multipart and JSON
- [x] `seed-shields` populates shields for the 66 seeded teams; re-run skips existing logos; `--force` re-syncs; failed teams reported
- [x] Full existing test suite (790 tests: 530 server + 260 client) stays green

## Open Questions

None — scope decisions are settled with the maintainer (see Assumptions).
