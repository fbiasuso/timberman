# Design: Teams & Leagues (Phase 1)

## Technical Approach

Introduce a `leagues` + `teams` registry on the existing hexagonal stack. Teams are FLAT entities whose league participation is expressed through a `team_leagues` many-to-many junction, so a team can belong to several leagues (future Copa sharing Primera A+B squads). Team create/edit use flat endpoints carrying `leagueIds`; autocomplete joins through the junction. Matches gain nullable team FKs (strings stay source of truth), shields are self-hosted via a download→validate→store pipeline served by `@fastify/static`, and free-text team inputs are replaced by a reusable `Autocomplete` filtered by a UI-only league selector. Follows existing patterns: normalized-unique functional indexes with pre-flight DO blocks (0003/0004), 23505→domain-error mapping (`DrizzleTournamentRepo.mapNameViolation`), immutable entities, use-case-first routing, admin middleware on all new routes. Specs: team-registry, team-image-hosting, admin-operations, tournament-management.

## Architecture Decisions

| # | Decision | Alternatives | Rationale |
|---|----------|--------------|-----------|
| D1 | `leagues` unique on normalized name; `teams` unique on the GLOBAL normalized name (`lower(regexp_replace(name,'\s+','','g'))` on `teams.name` alone) | per-league uniqueness | Mirrors 0003; spec mandates global uniqueness — a name cannot repeat across leagues |
| D2 | `matches.local_team_id`/`visitor_team_id` nullable FK **ON DELETE SET NULL** + app-level delete guard (pre-check → 409) | `ON DELETE RESTRICT` only | Strings are display source of truth; SET NULL keeps legacy rows safe; guard produces typed 409 (SET NULL alone would allow deletion) |
| D3 | `team_leagues` junction: `team_id` FK **ON DELETE CASCADE**, `league_id` FK **ON DELETE RESTRICT**, UNIQUE(team_id, league_id) + league-side index; app pre-checks for both delete guards | `teams.league_id` column (1:1) | A team participates in MULTIPLE leagues (spec). CASCADE makes team delete atomically remove memberships; RESTRICT + `countTeams` pre-check blocks league delete while memberships exist |
| D4 | Unknown team id on match create/edit → 422 (`TeamNotResolvableError`); team/league admin CRUD on missing id → 404; unknown league id inside `leagueIds` → 404 (`LeagueNotFoundError`) | single 404 for all | Spec mandates 422 for match enrichment (semantic resolution failure), 404 for registry CRUD |
| D5 | Logo pipeline in the **application layer** (`TeamImageService` port + local adapter), download **after** insert (id → filename); failures → log + `null` logo, never block | before-insert temp id | `logos/{teamId}.{ext}` permanently unique (serial ids never reused); no temp-file juggling |
| D6 | Filename/ext from **sniffed magic bytes** (PNG/JPEG/WebP), not URL extension or Content-Type; size cap 1 MiB | trust URL ext / header | HTML pages served as image/* must be rejected (spec scenario) |
| D7 | `@fastify/static` root `server/public`, prefix `/public/`, long `maxAge` (≈30d, **not** `immutable`) | immutable cache | Same filename overwritten on re-upload; 30d balances cache hit vs staleness |
| D8 | `GET /api/admin/leagues` nests `teams[]` (memberships grouped in memory); match forms + Equipos tab read one `useLeagues()` | separate per-league queries | Registry is small; one query feeds autocomplete + tab; single invalidation key |
| D9 | Create/edit team = flat `POST /api/admin/teams` / `PATCH /api/admin/teams/:teamId` with `leagueIds` in the body | `POST /api/admin/leagues/:leagueId/teams` (nested) | team-registry spec names the flat paths; M2M makes path-scoping impossible — a team spans leagues |
| D10 | Match team FKs are write-once enrichment: rename/delete of a team never rewrites match strings | cascade rewrite | Strings are snapshots; betting flow (tickets, history) untouched |
| D11 | Match league is a UI-only filter in Phase 1 — never stored, never derived from team ids (M2M makes it ambiguous). Phase 2 betting match takes its league from the originating `fixture_match` | derive league from team FK | Explicit Phase-2 note so Phase 1 is not blocked; see Data Flow |
| D12 | Team memberships handled **inside TeamRepo** (no separate membership repo) | standalone `TeamLeagueMembershipRepo` | Memberships have no independent lifecycle: every write is a side effect of team create/edit/delete, every read a side effect of league listing. One repo = one transactional boundary (team + memberships commit atomically); avoids a second port/adapter over the same table |

## Data Flow

```
Equipos tab / AddMatchForm / MatchRow
   │  useLeagues()  ['admin','leagues']
   ▼
GET /api/admin/leagues ──► ListLeaguesUseCase ──► LeagueRepo.findAll() + TeamRepo.findAll() (memberships grouped in memory)

GET /api/admin/leagues/:id/teams ──► ListTeamsByLeagueUseCase ──► TeamRepo.findByLeagueId (join team_leagues)

POST /api/admin/teams {name, aliases?, logoUrl?, leagueIds[]}
   ▼
CreateTeamUseCase ──► TeamRepo.save (team + memberships, one tx) ──► TeamImageService.downloadAndStore(url, teamId) → logo
PATCH /api/admin/teams/:id {name?, aliases?, logoUrl?, leagueIds[]?}
   ▼
UpdateTeamUseCase ──► TeamRepo.update (replace membership set; last-membership removal → 400)
DELETE /api/admin/teams/:id ──► guard countMatchesReferencing → 409; else TeamRepo.delete (CASCADE removes memberships)

POST /api/admin/matches {localTeamId, visitorTeamId}   (PATCH same)
   ▼
CreateMatch/UpdateMatchDetailsUseCase ──► TeamRepo.findById(id)  (unknown → 422)
   │   string := team.name, fk := team.id  (text-only PATCH → fk null)
   ▼
MatchRepo.save/update ──► matches (strings + nullable fks)
```

**Phase-2 note (D11):** a match's league is NOT derivable from `local_team_id`/`visitor_team_id` — a team spans leagues via memberships. Phase 1 keeps the league selector purely as a UI filter over the autocomplete (league id is never sent to match endpoints). Phase 2's betting match will take its league from the originating `fixture_match` (API-FOOTBALL row) at ingestion time. No Phase-1 element depends on this.

## Data Model (DDL sketch — migration `drizzle/0005_*.sql` via `drizzle-kit generate`)

```sql
CREATE TABLE "leagues" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "country" text NOT NULL,
  "format" text NOT NULL,                -- enum 'liga'|'copa'
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "idx_leagues_name_normalized_unique"
  ON "leagues" USING btree (lower(regexp_replace("name", '\s+', '', 'g')));

CREATE TABLE "teams" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "aliases" text[],                      -- nullable
  "logo" text,                           -- relative path 'logos/{id}.{ext}', nullable
  "created_at" timestamp DEFAULT now() NOT NULL
);
-- pre-flight DO block mirrors 0003 (fails loudly with a duplicate report
-- should legacy/backfilled rows ever collide)
CREATE UNIQUE INDEX "idx_teams_name_normalized_unique"
  ON "teams" USING btree (lower(regexp_replace("name", '\s+', '', 'g')));

CREATE TABLE "team_leagues" (
  "id" serial PRIMARY KEY NOT NULL,
  "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "league_id" integer NOT NULL REFERENCES "leagues"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "idx_team_leagues_team_league_unique"
  ON "team_leagues" USING btree ("team_id", "league_id");
-- PG does not auto-index FKs: league-side lookups (findByLeagueId, countTeams) need this
CREATE INDEX "idx_team_leagues_league" ON "team_leagues" USING btree ("league_id");

ALTER TABLE "matches"
  ADD COLUMN "local_team_id" integer REFERENCES "teams"("id") ON DELETE SET NULL,
  ADD COLUMN "visitor_team_id" integer REFERENCES "teams"("id") ON DELETE SET NULL;
CREATE INDEX "idx_matches_local_team" ON "matches" ("local_team_id");
CREATE INDEX "idx_matches_visitor_team" ON "matches" ("visitor_team_id");
```

Index choices: the junction `UNIQUE(team_id, league_id)` is the membership-invariant backstop AND serves team-side lookups; the league-side index serves `findByLeagueId`/`countTeams`. Migration order: `db:migrate` applies 0003→0004→0005 sequentially; no backfill — new columns nullable. Rollback: branch revert.

## Server Layers

**Entities** (`server/src/domain/entities/league.ts`, `team.ts`; immutable, `create/new/toSnapshot`, mirrors Tournament):

```ts
interface LeagueSnapshot { id: number; name: string; country: string; format: 'liga' | 'copa'; createdAt: Date }
interface TeamSnapshot   { id: number; name: string; aliases: string[] | null; logo: string | null; leagueIds: number[]; createdAt: Date }
```

`Team` carries `leagueIds` — its aggregate includes memberships (D12). Invariants (route zod): name/country non-blank (`min(1)` + trim-refine, stored as typed per tournament convention); aliases ≤20 strings; `leagueIds` items `z.number().int().positive()`, `min(1)` on create, `min(1).optional()` on PATCH.

**Ports** (`domain/ports/league-repo.ts`, `team-repo.ts`):
`LeagueRepo`: `findAll()` (order by name), `findById`, `findByName(name)` (normalized — seed idempotency), `save`, `update`, `delete(id)`, `countTeams(leagueId)` (count via `team_leagues` join).
`TeamRepo` (memberships included, D12): `findAll()` (order by name), `findById` (with memberships), `findByLeagueId(leagueId)` (join junction, order by name), `findByName(name)` (global normalized — seed idempotency), `save(team)` (team + memberships, one tx), `update(team)` (replace membership set, one tx), `delete(id)` (CASCADE removes memberships), `countMatchesReferencing(teamId)`.
Drizzle impls (`drizzle-league-repo.ts`, `drizzle-team-repo.ts`): map PG 23505 on the constraint names above to `LeagueNameAlreadyExistsError`/`TeamNameAlreadyExistsError` (reuse `mapNameViolation`; junction-dup mapping is defensive only — update replaces the set); `delete` throws NotFound when 0 rows; membership replacement runs in `db.transaction` (delete by team_id → insert rows).

**Image port** (`domain/ports/image-service.ts`): `downloadAndStore(sourceUrl: string, teamId: number): Promise<string | null>` — unchanged from prior design: global `fetch` (Node 22) with `AbortSignal.timeout(10s)` → 1 MiB cap → magic-byte sniffing (PNG/JPEG/WebP) → write `public/logos/{id}.{ext}`; every failure caught, logged, returns null — never throws.

**Use cases** (`application/teams/`): `CreateLeagueUseCase`, `UpdateLeagueUseCase`, `DeleteLeagueUseCase` (pre-check `countTeams` → `LeagueHasTeamsError` 409), `ListLeaguesUseCase` (leagues + `TeamRepo.findAll()` memberships grouped in memory), `CreateTeamUseCase(teamRepo, imageService)` — input `{name, aliases?, logoUrl?, leagueIds[]}`; resolve every league id (`LeagueNotFoundError` 404), insert team + memberships in one tx, then download logo → update path; `UpdateTeamUseCase(teamRepo, imageService)` — `{name?, aliases?, logoUrl?, leagueIds[]?}`; when `leagueIds` present, removing the last membership → `TeamNeedsLeagueError` 400, else replace set in tx; `DeleteTeamUseCase` (pre-check `countMatchesReferencing` → `TeamReferencedByMatchesError` 409; else delete — CASCADE removes memberships); `ListTeamsByLeagueUseCase`; `SetTeamLogoUseCase(teamRepo, imageService)`.

**Match enrichment**: unchanged from prior design — `MatchSnapshot` + `Match.withDetails()` gain `localTeamId`/`visitorTeamId` (`undefined` keeps, per existing partial semantics). Present id → `teamRepo.findById` → not found `TeamNotResolvableError` (422), string := team.name; string without id → FK null; `DrizzleMatchRepo.update/save` include the columns; `MatchDTO` adds `localTeamId`/`visitorTeamId: number | null`.

**Routes** (admin-routes.ts, all `preHandler: [authMiddleware, adminMiddleware]`):

| Method+Path | Body (zod) | Success | Errors |
|---|---|---|---|
| POST `/api/admin/leagues` | `{name, country, format}` | 201 `{league}` | 400 blank, 409 dup, 403 |
| GET `/api/admin/leagues` | — | `{leagues}` (nested `teams[]`, by name) | 403 |
| PATCH `/api/admin/leagues/:leagueId` | partial `{name?, country?, format?}` | `{league}` | 404, 409 dup, 403 |
| DELETE `/api/admin/leagues/:leagueId` | — | 204 | 404, 409 has-memberships, 403 |
| GET `/api/admin/leagues/:leagueId/teams` | — | `{teams}` | 404, 403 |
| POST `/api/admin/teams` | `{name, aliases?, logoUrl?, leagueIds: number[]}` | 201 `{team}` | 400 blank / leagueIds<1, 404 league, 409 dup, 403 |
| PATCH `/api/admin/teams/:teamId` | partial `{name?, aliases?, logoUrl?, leagueIds?}` | `{team}` | 400 blank / last-membership, 404, 409 dup, 403 |
| DELETE `/api/admin/teams/:teamId` | — | 204 | 404, 409 referenced, 403 |
| POST `/api/admin/teams/:teamId/logo` | `{url: z.string().url()}` | `{team}` | 404, 400, 403 |

Params via `z.coerce.number().int().positive()`. New domain errors in `domain/errors/index.ts`: `LeagueNameAlreadyExistsError` 409, `TeamNameAlreadyExistsError` 409, `LeagueNotFoundError` 404, `TeamNotFoundError` 404, `TeamNotResolvableError` 422, `LeagueHasTeamsError` 409, `TeamReferencedByMatchesError` 409, `TeamNeedsLeagueError` 400 (membership invariant). Existing `errorHandler` maps them automatically. Register repos in `index.ts` + `router.ts` (new params), `@fastify/static` plugin, and Vite proxy entry `/public` → `http://localhost:3001` (dev logo serving).

## Client

**Types** (`types/index.ts`): `MatchDTO`/`CreateMatchPayload`/`UpdateMatchDetailsPayload` += `localTeamId`/`visitorTeamId: number | null`; new `LeagueFormat = 'liga'|'copa'`, `LeagueDTO {id,name,country,format,teams: TeamDTO[]}`, `TeamDTO {id,name,aliases: string[]|null,logo: string|null,leagueIds: number[]}`. Helper `resolveLogoUrl(logo)` (`utils/format.ts`) as before.

**API** (`api/admin-api.ts`): `getLeagues`, `createLeague`, `updateLeague`, `deleteLeague`, `getLeagueTeams(leagueId)`, `createTeam({name, aliases?, logoUrl?, leagueIds})`, `updateTeam(teamId, …)`, `deleteTeam`, `setTeamLogo` — flat endpoints, same DTO shapes as server.

**Hooks** (`hooks/use-teams.ts`): `useLeagues()` → `['admin','leagues']` (nested teams). Mutations `useCreateLeague/useUpdateLeague/useDeleteLeague/useCreateTeam/useUpdateTeam/useDeleteTeam/useSetTeamLogo` all invalidate `['admin','leagues']` (team renames do NOT rewrite match strings — no match invalidation needed). Match create/update keep existing invalidation.

**Equipos tab** (`components/admin/Equipos.tsx`): create-league form (name, country, format select) → league cards (accordion) → per-team create/edit form with name, aliases comma-separated, logo URL, and a **league multi-select** (checkbox list of all leagues) driving `leagueIds`; create requires ≥1 checked; edit toggles memberships — removing the last surfaces the 400 in the existing error-box pattern; blocked deletes surface `response.data.message`. `AdminPage.tsx`: add `'equipos'` to `Tab` + tabs + switch.

**Autocomplete** (`components/Autocomplete.tsx`): unchanged from prior design — combobox, keyboard nav, a11y attrs, unmatched-text state for legacy strings.

**Form integration**: the league selector is UI-only (D11) — it filters `items = league.teams` from `useLeagues()`; the league id is never submitted to match endpoints. Initial league prefilled by resolving `match.localTeamId`'s first membership (M2M: a team may span leagues, so the selector stays overridable — it only filters the autocomplete). On select: `localTeam = team.name`, `localTeamId = team.id`, shield auto-fill `resolveLogoUrl(team.logo)` (overridable). AddMatchForm: free text removed → submit requires both selections (no legacy path in *create*). MatchRow `EditableRow`: initial team = registry team when id matches, else unmatched text = stored string; PATCH sends `{localTeam, localTeamId}` together (or string-only → FK null, spec "free text clears the team id").

## Seed Script

`server/scripts/seed-teams.ts` (`npm run seed:teams`): constant `ROSTERS` — `[{ league: {name, country, format}, teams: [{name, aliases, shieldUrl}] }, …]` with real Primera A + Primera B rosters **researched at implementation time** (data-source note in file header, mirroring seed-dev.ts). Flow in one `db.transaction`: league `findByName` → reuse or insert; per team `findByName` (GLOBAL normalized) → skip if present (**idempotent re-run**); **membership assigned per league** — membership lookup on `team_leagues`, insert if missing; a team shared by both leagues appears once with 2 memberships (future-proof; current rosters are disjoint); `shieldUrl` → same `LocalFileImageService.downloadAndStore` — failures logged and skipped, team persists with `logo null`. Summary log + exit code.

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Server unit (use cases) | `application/__tests__/teams-use-cases.test.ts`: global dup team → 409; empty `leagueIds` → 400; last-membership removal → 400; unknown league id → 404; delete guards → 409; match team resolution (unknown id 422, string-only clears FK, id sets name); logo failure → team with null logo (mocked imageService) | `vi.fn()` repo mocks, `createMatchRepoMocks`-style helpers |
| Server entity | `match.test.ts` `withDetails` id semantics; league/team entity invariants | existing domain test style |
| Server routes | api.test.ts (or `teams-routes.test.ts`): 201/400/403/404/409 per route table; nested teams in GET leagues | Fastify `inject()` with mock services + real `createRouter` |
| Server repo | `drizzle-teams-repo.test.ts`: unique-violation mapping, membership replacement (tx), `findByLeagueId` join, CASCADE on team delete | follow `drizzle-tournament-repo.test.ts` conventions |
| Client | `Autocomplete.test.tsx` (keyboard nav, filter, click-outside, a11y); `Equipos.test.tsx` (list, multi-select membership, blocked-delete error); updated `AddMatchForm`/`MatchRow`/`MatchEditor` tests (selection flow, legacy fallback) | Testing Library + happy-dom, existing conventions |

Commands: server `pnpm vitest run`, client `pnpm vitest run`.

## File Changes

| File | Action | Description |
|---|---|---|
| `server/src/infrastructure/db/schema.ts` | Modify | leagues/teams (flat) + team_leagues junction, matches FKs + indexes |
| `server/drizzle/0005_*.sql` | Create | generated migration (junction + pre-flight + unique indexes) |
| `server/src/domain/entities/league.ts`, `team.ts` | Create | immutable entities (Team carries leagueIds) |
| `server/src/domain/entities/match.ts` | Modify | snapshot + `withDetails` gain team ids |
| `server/src/domain/ports/league-repo.ts`, `team-repo.ts`, `image-service.ts` | Create | ports (memberships inside TeamRepo) |
| `server/src/infrastructure/repositories/drizzle-league-repo.ts`, `drizzle-team-repo.ts` | Create | drizzle impls + 23505 mapping + membership tx |
| `server/src/infrastructure/repositories/drizzle-match-repo.ts` | Modify | persist team-id columns |
| `server/src/application/teams/*.ts` | Create | 9 use cases + DTOs (leagueIds in inputs) |
| `server/src/application/tournament/create-match-use-case.ts`, `update-match-details-use-case.ts` | Modify | team resolution + null semantics |
| `server/src/domain/errors/index.ts` | Modify | 8 new errors |
| `server/src/infrastructure/images/local-file-image-service.ts` | Create | logo pipeline |
| `server/src/infrastructure/http/routes/admin-routes.ts` | Modify | flat team routes + league/logo routes + match id fields |
| `server/src/index.ts`, `routes/router.ts` | Modify | repo wiring + `@fastify/static` |
| `server/package.json` | Modify | + `@fastify/static`; seed script entry |
| `server/scripts/seed-teams.ts` | Create | rosters + memberships + shield fetch |
| `client/src/types/index.ts`, `utils/format.ts` | Modify | DTOs, `resolveLogoUrl` |
| `client/src/api/admin-api.ts`, `hooks/use-teams.ts` | Create/Modify | flat API + query hooks |
| `client/src/components/Autocomplete.tsx`, `admin/Equipos.tsx` | Create | combobox + tab (membership multi-select) |
| `client/src/components/admin/AdminPage.tsx`, `AddMatchForm.tsx`, `MatchRow.tsx` | Modify | tab + selector/autocomplete integration |
| `client/vite.config.ts` | Modify | proxy `/public` → :3001 |
| `server/public/logos/.gitkeep` | Create | dir tracked; images gitignored |

## Migration / Rollout

`pnpm db:generate` + `pnpm db:migrate` (0005). No data migration; columns nullable; old matches unaffected. Rollback = revert branch (drop tables/columns, unregister routes; betting flow never depends on team ids). Phase 2 readiness: M2M memberships + aliases + nullable FKs shipped now; `fixture_match` league resolution documented (D11); no design element blocks `league_rounds`/`fixture_matches`.

## Delivery / Work Units (feature/teams-leagues; no PR chain)

| # | Commit | Content | ≈ lines |
|---|---|---|---|
| 1 | `feat(server): add leagues and teams registry (schema, entities, repos, migration)` | schema (incl. team_leagues), 0005, entities, ports, drizzle repos (incl. membership tx) + tests | 520 |
| 2 | `feat(server): add league/team CRUD use cases and admin routes` | use cases (leagueIds + invariant), errors, routes, wiring + tests | 550 |
| 3 | `feat(server): enrich matches with team ids (create/update + guards)` | Match entity, 2 use cases, routes, DTOs + tests | 250 |
| 4 | `feat(server): self-host team shields (image service + static serving + logo route)` | adapter, @fastify/static, logo endpoints + tests | 250 |
| 5 | `feat(server): seed Primera A/B rosters with shield download` | seed-teams.ts + package.json script | 300 |
| 6 | `feat(client): team/league types, api client and react-query hooks` | types, admin-api, use-teams, resolveLogoUrl | 250 |
| 7 | `feat(client): add reusable Autocomplete combobox` | Autocomplete.tsx + tests | 200 |
| 8 | `feat(client): add Equipos admin tab (league and team CRUD)` | Equipos.tsx (membership multi-select), AdminPage + tests | 380 |
| 9 | `feat(client): wire team selection into match create/edit forms` | AddMatchForm, MatchRow, vite proxy + tests | 300 |

The junction adds ~70 lines to unit 1 (schema + membership handling) and ~30 to unit 2 (leagueIds validation/invariant) — meaningful but contained. Each unit keeps the repo green (tests with code). Unit (8) > 400-line budget alone → delivered as one commit but reviewable in chunks; guard line `Chained PRs recommended: No` (branch commits, merge later).

## Open Questions

- [ ] Re-upload same-logo staleness: 30d `maxAge` accepted? (immutable caching rejected in D7).
- [ ] Hosted deployment: `VITE_API_URL` must serve `/public` on the API origin — confirm single-origin hosting assumption.
