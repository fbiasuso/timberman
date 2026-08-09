# Tasks: Teams & Leagues (Phase 1)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2,850 (U1 520 · U2 550 · U3 250 · U4 250 · U5 300 · U6 250 · U7 200 · U8 380 · U9 300) |
| 400-line budget risk | High |
| Chained PRs recommended | No |
| Delivery strategy | exception-ok (branch-only; units accepted on feature/teams-leagues) |
| Chain strategy | pending |
| Suggested split | Branch commits only; U1/U2 >400 → split if a PR opens later |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Commit message | ≈ lines | Notes |
|------|----------------|---------|-------|
| U1 | feat(server): add leagues and teams registry (schema, entities, repos, migration) | 520 | >400 — splittable (schema+entities / repos+tests) if PR later |
| U2 | feat(server): add league/team CRUD use cases and admin routes | 550 | >400 — splittable (use cases+errors / routes+wiring) if PR later |
| U3 | feat(server): enrich matches with team ids (create/update + guards) | 250 | |
| U4 | feat(server): self-host team shields (image service + static serving + logo route) | 250 | |
| U5 | feat(server): seed Primera A/B rosters with shield download | 300 | |
| U6 | feat(client): team/league types, api client and react-query hooks | 250 | |
| U7 | feat(client): add reusable Autocomplete combobox | 200 | |
| U8 | feat(client): add Equipos admin tab (league and team CRUD) | 380 | near budget; review in chunks |
| U9 | feat(client): wire team selection into match create/edit forms | 300 | |

## Phase 1: Server Foundation — Registry (U1)

- [x] **T1** (U1) `server/src/infrastructure/db/schema.ts` + `server/drizzle/0005_*.sql` (leagues; flat teams global-normalized unique + pre-flight DO block; team_leagues junction CASCADE team_id / RESTRICT league_id + UNIQUE pair + league idx; matches local_team_id/visitor_team_id ON DELETE SET NULL + idxs) — then `domain/entities/league.ts`+`team.ts` (immutable, Team carries leagueIds), ports `league-repo.ts`/`team-repo.ts`/`image-service.ts`, `drizzle-league-repo.ts`+`drizzle-team-repo.ts` (23505→domain errors via mapNameViolation; membership tx replace; findByLeagueId join; countTeams/countMatchesReferencing; CASCADE delete), `public/logos/.gitkeep`. AC: db:generate + db:migrate clean; repo tests (`drizzle-teams-repo.test.ts`: unique mapping, membership tx, join, cascade). Deps: none
- [x] **T2** (U2) `application/teams/` 8 UCs (Create/Update/DeleteLeague, ListLeagues with nested teams, ListTeamsByLeague, Create/Update/DeleteTeam — leagueIds invariant: empty→400, last-membership→400, guards→409); 8 new errors in `domain/errors/index.ts`; league/team routes in `admin-routes.ts` (zod bodies, z.coerce params, 201/204/{league}); repos wired in `index.ts`+`router.ts`. AC: UC tests (`teams-use-cases.test.ts`: global dup 409, empty leagueIds 400, unknown league 404, last-membership 400, delete guards 409); route tests (201/400/403/404/409; GET /leagues nests teams; team in multiple leagues). Deps: T1
- [x] **T3** (U3) `domain/entities/match.ts` snapshot+withDetails += localTeamId/visitorTeamId (undefined keeps); create-match + update-match-details UCs resolve id→findById→TeamNotResolvableError 422, string:=team.name, string-only→FK null; `drizzle-match-repo.ts` persists columns; MatchDTO += team ids; match route id fields. AC: UC+api tests — unknown id 422 no match; id sets name; free text clears FK null; partial PATCH preserves fields; legacy matches (null FKs) render/edit unchanged. Deps: T1, T2
- [x] **T4** (U4) `infrastructure/images/local-file-image-service.ts` (fetch + AbortSignal.timeout(10s), 1 MiB cap, PNG/JPEG/WebP magic-byte sniff, write `public/logos/{id}.{ext}`, never throws); register `@fastify/static` (root server/public, prefix /public/, maxAge ≈30d non-immutable); SetTeamLogoUseCase + POST `/api/admin/teams/:teamId/logo`; index.ts wires real adapter into Create/UpdateTeam; package.json += @fastify/static. AC: valid shield stored + relative path persisted; HTML/oversized/unreachable → team created logo null + logged; served with long cache; DB stores relative paths only; manual URL fallback intact. Deps: T1, T2
- [x] **T5** (U5) `scripts/seed-teams.ts` (ROSTERS const: real Primera A + Primera B researched at impl time, data-source header; one db.transaction; league findByName reuse/insert; team findByName global → skip; membership insert-if-missing — shared team gets 2 memberships; shield download failure → logo null, never blocks; summary log + exit code) + package.json `seed:teams`. AC: idempotent — run twice creates no dup leagues/teams/memberships. Deps: T1, T4

## Phase 2: Client Data Layer (U6)

- [ ] **T6** (U6) `client/src/types/index.ts` (MatchDTO/CreateMatchPayload/UpdateMatchDetailsPayload += localTeamId/visitorTeamId: number|null; LeagueFormat 'liga'|'copa'; LeagueDTO {teams: TeamDTO[]}; TeamDTO {leagueIds}); `utils/format.ts` resolveLogoUrl; `api/admin-api.ts` flat fns (getLeagues/create/update/deleteLeague, getLeagueTeams, create/update/deleteTeam, setTeamLogo); `hooks/use-teams.ts` useLeagues ['admin','leagues'] + 7 mutations invalidating that key. AC: shapes match server DTOs; single invalidation key; tsc clean. Deps: server contract (T2/T3)

## Phase 3: Client UI (U7, U8)

- [ ] **T7** (U7) `client/src/components/Autocomplete.tsx` (combobox, keyboard nav up/down/enter/escape, click-outside, a11y attrs, unmatched-text state for legacy strings) + `Autocomplete.test.tsx`. AC: keyboard nav/filter/outside/a11y tests pass. Deps: T6
- [ ] **T8** (U8) `client/src/components/admin/Equipos.tsx` (create-league form: name/country/format select; league accordion cards; per-team create/edit: name, aliases comma-separated, logo URL, league multi-select checkbox → leagueIds — ≥1 required, last-membership 400 and blocked deletes surfaced via error box) + `AdminPage.tsx` 'equipos' Tab + switch + `Equipos.test.tsx`. AC: lists leagues with nested teams; create refreshes list; blocked delete shows server error, team remains. Deps: T6

## Phase 4: Client Match Integration (U9)

- [ ] **T9** (U9) `AddMatchForm.tsx` (UI-only league selector D11 filters `league.teams`; Autocomplete; on select → name+teamId+shield auto-fill resolveLogoUrl overridable; free text removed; both teams required); `MatchRow.tsx` EditableRow (id matches registry → team; else unmatched text = stored string; PATCH sends {localTeam, localTeamId} or string-only → FK null); `vite.config.ts` proxy /public → :3001; updated AddMatchForm/MatchRow/MatchEditor tests. AC: pick team fills name+id+shield; autocomplete league-filtered ordered by name; legacy match renders strings + replaceable via autocomplete; no free text in create/edit. Deps: T6, T7, T8

## Phase 5: Verification

- [ ] **T10** Full check — server `pnpm vitest run` + `pnpm lint` (workdir `server`), client `pnpm vitest run` (workdir `client`), `pnpm build` both. AC: all suites green, betting/ranking/tournament suites unregressed. Deps: T1–T9

## Testing Requirements per Unit

- Server (T1–T5, in `server`): `pnpm vitest run` + `pnpm lint` after each unit; tests with code. New: `drizzle-teams-repo.test.ts`, `teams-use-cases.test.ts`, `teams-routes.test.ts`/api.test.ts additions, `match.test.ts` withDetails id semantics, image-service unit tests (magic-byte, size cap, timeout→null), logo/static cache route tests.
- Client (T6–T9, in `client`): `pnpm vitest run` after each unit. New: `Autocomplete.test.tsx`, `Equipos.test.tsx`; updated AddMatchForm/MatchRow/MatchEditor tests (selection flow, legacy fallback).

## Out of Scope (Phase 2)

API-FOOTBALL fixture ingestion; multi-league match dates; `fixture_match` league derivation (D11); betting flow/tickets/history untouched; tournaments untouched; no PR chain — branch-only commits, merge decision later.
