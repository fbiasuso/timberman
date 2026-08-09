# Proposal: Teams & Leagues

## Intent

Matches store team names as free text (`local_team`/`visitor_team` on every row, schema.ts:73-74) and shields as hotlinked URLs. There is no team identity, no league concept, and no autocomplete — typos create phantom teams that propagate to tickets and history, and fragile remote URLs break shields. Fix by introducing a `leagues` + `teams` registry and making match creation/edit pick teams from it.

## Problem / Context

- `tournaments` is a BETTING-SEASON container (Torneo 1, 2…) — NOT a sports league; no country/format metadata. Betting flow stays untouched.
- `local_img`/`visitor_img` are plain URL strings (admin-routes.ts:86-87); no upload/serving infra (`@fastify/static` absent, no multipart).
- AddMatchForm (:127-175) and MatchRow EditableRow (:232-276) use free-text team + shield URL inputs.
- Phase 2 (API-FOOTBALL fixture ingestion, multi-league match dates) needs team identity + aliases — Phase 1 design must not block it.

## Scope

### In Scope
- `leagues` + `teams` entities/tables (team belongs to a league; `aliases` for future matching).
- Admin CRUD: leagues (create/list/rename), teams (create under league, edit, delete).
- Match create/edit (AddMatchForm + MatchRow): per-match league selector + team autocomplete filtered by league; team chosen from registry; shield auto-fills from team. Free text removed from create/edit.
- `matches` gain nullable `local_team_id`/`visitor_team_id` FKs; existing matches keep working via text fallback.
- Seed script: REAL Primera A + Primera B (Nacional) rosters with aliases; shields downloaded once, self-hosted, graceful fallback.
- Self-host images: download once at import/team-create, validate mime/size, store under `public/logos/`, serve via `@fastify/static` with long cache; DB stores relative path. Manual URL fallback stays.
- Client: new "Equipos" admin tab; reusable `Autocomplete` component; AddMatchForm/MatchRow integration.

### Out of Scope
- API-FOOTBALL fixture ingestion; multi-league match dates (Phase 2 — design only prepares for it).
- Betting flow, scoring/results, tournaments — untouched.
- No PRs/chains: work lives on `feature/teams-leagues` branch; merge to main decided later.

## User Stories (Phase 1)

- As admin: create a league; add teams with name, aliases, shield.
- As admin creating/editing a match: pick a league, type to autocomplete from that league's teams, shield auto-fills.
- Legacy matches without `team_id` render and edit fine.

## Capabilities

### New Capabilities
- `team-registry`: leagues + teams CRUD, normalized uniqueness, aliases, seeded rosters.
- `team-image-hosting`: self-hosted logo pipeline (download → validate → store → serve).

### Modified Capabilities (delta specs)
- `admin-operations`: match create/edit accepts team ids + league selector; Equipos tab UI.
- `tournament-management`: match creation/details accept nullable team FKs while text fields remain as fallback.

## Approach

- **Schema**: `leagues(id, name, unique-normalized)`; `teams(id, league_id FK, name, aliases[], logo_path?)`; `matches` + nullable `local_team_id`/`visitor_team_id` FKs. Migration via drizzle-kit generate + unique functional indexes.
- **Server**: League/Team entities + ports + use cases (CreateLeague, CreateTeam, ListTeamsByLeague, DeleteTeam with reference guard); admin routes; image service port + local adapter (download, mime/size check, write to `public/logos/`).
- **Client**: Equipos tab; `Autocomplete` (keyboard nav, filter by league); AddMatchForm/MatchRow send `localTeamId`/`visitorTeamId`, shield from team record.
- **Seed**: script with real rosters + alias tables; shield download once; failure → null logo, never blocks.

## Business Rules / Edge Cases

- Team name unique WITHIN league under normalized key (lowercase, strip whitespace) → 409.
- League name normalized-unique → 409; empty names rejected (zod min 1).
- Delete team blocked while any match references it; delete league blocked while teams exist.
- Image download failure → team still created (null logo); manual URL fallback kept.
- Existing matches without `team_id` must keep rendering/editing (text fallback).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| server/src/domain/entities, ports, application/teams | New | League/Team entities, image service port, CRUD use cases |
| server/src/infrastructure/db/schema.ts, drizzle/* | Modified | leagues/teams tables, matches FKs, migration |
| server/src/infrastructure/http/routes/admin-routes.ts | Modified | league/team routes; match create/edit accepts team ids |
| server/src/infrastructure/static, public/logos | New | logo storage + @fastify/static serving |
| server/src/infrastructure/seed/ | New | Primera A + B roster seed with shield download |
| server/package.json | Modified | + @fastify/static |
| client/src/components/admin/AdminPage.tsx, AddMatchForm.tsx, MatchRow.tsx | Modified | Equipos tab; selector + autocomplete integration |
| client/src/components/Autocomplete.tsx | New | reusable combobox |
| client/src/api/admin-api.ts, hooks/use-admin.ts | Modified | team/league queries + mutations |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| FK migration surprises on existing rows | Low | FKs nullable; no backfill; text fallback kept |
| Seed roster drift (rosters change over time) | Med | One-time seed; aliases enable future re-match |
| Shield download failures at seed/team-create | Med | Fallback to null logo; never block creation |
| Autocomplete UX on small lists | Low | Filter by league + keyboard nav + tests |
| Phase 2 blocked by Phase 1 shape | Low | aliases + nullable FKs included now |

## Rollback Plan

Branch-only work. Revert migration (drop `leagues`/`teams`, drop FKs — columns nullable so old flows unaffected). Disable Equipos routes/tab to hide feature; matches keep text fields so betting flow never depends on team ids.

## Success Criteria

- [x] New matches in create/edit pick teams ONLY from the registry (no free text).
- [x] Selecting a team persists its `team_id` and auto-fills the shield; legacy matches still render/edit.
- [x] League/team CRUD enforces normalized uniqueness (409) and guarded deletes.
- [x] Seed loads real Primera A + B rosters; shields served from `public/logos/` with cache headers.
- [x] Existing suites stay green; new tests cover uniqueness, guards, fallback, autocomplete.
