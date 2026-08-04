# Design: Tournament Lifecycle

## Technical Approach

Replace the `isActive` boolean with a three-state status model (`active|finished|archived`) on `tournaments`, persist per-user points at publish-results time (`tournament_points`), and add a two-step lifecycle: **terminate** (active→finished, persist winners from max points) and **archive** (finished→archived, auto-create "Torneo N+1"). Ranking/GetUserDetail stop recomputing from tickets and read persisted rows, per-tournament (default = active). All active-flow reads (`/matches/current`, `/matches/dates`, propagation, MatchEditor, ResultsEntry, HistorySection) become active-tournament-scoped server-side where possible. Backfill = script using PointsCalculator; migration = one DDL file (0002).

## Architecture Decisions

### D1: `tournament_winners` table (not `winner_id` column)
| Option | Tradeoff | Decision |
|---|---|---|
| Separate table, PK `(tournament_id, user_id)` | Multi-winner (tie) by construction; matches `ticket_predictions` join-table pattern | **Chosen** |
| `winner_id` column on tournaments | Single FK — violates "ALL tied users are winners" spec | Rejected |

`tournaments` gains `status` (text enum, default `'active'`) + `finished_at` (nullable timestamp). Drizzle pattern: `text('status', { enum: ['active','finished','archived'] })` — same as `match_dates.status`.

### D2: One `TournamentPointsRepo` port for points AND winners
| Option | Tradeoff | Decision |
|---|---|---|
| Single port, 5 methods | One `TransactionRepos` entry = one ripple point in UoW + mocks | **Chosen** |
| Separate `TournamentWinnerRepo` | Cleaner naming, second TransactionRepos entry + full mock ripple | Rejected |

Port methods: `savePoints(rows)`, `findByTournamentId(id)`, `findByUserAndTournament(userId, id)`, `saveWinners(tournamentId, userIds[])`, `findWinnersByTournamentId(id)`. Rows are plain interfaces (read-model, no entity class — data-access pattern like `AuditLogRepo` returns).

### D3: Repurpose `findActive()`; scope `findOpenMatchDates(tournamentId?)`
`findActive()` is dead code today — it becomes "status = 'active'" and is used by ranking resolution, propagation, match-routes, and boot. `findOpenMatchDates` gains an optional `tournamentId` filter (callers pass the active tournament id). Callers: `PropagateBetAmountUseCase` (active only — spec system-config), `/api/matches/current` (active only — spec date-history/admin-operations). This makes the previous "deactivation-flow" open item moot: the spec now defines the filter.

### D4: New errors for lifecycle guards
`TournamentOpenDateError` (409, `TOURNAMENT_OPEN_DATE`), `TournamentNotActiveError` (422, `TOURNAMENT_NOT_ACTIVE`), `TournamentNotFinishedError` (422, `TOURNAMENT_NOT_FINISHED`) in `server/src/domain/errors/index.ts` — error-handler maps `statusCode` automatically.

### D5: `/api/matches/dates` scoped server-side
HistorySection, TicketsPage and TicketCard all consume `useMatchDates()`; filtering client-side would duplicate active-tournament knowledge in 3 components. Instead `GET /api/matches/dates` resolves `findActive()` and returns only its dates (`[]` when none). HistorySection/CarteleraPage stay byte-identical; spec date-history is satisfied server-side.

### D6: New public `GET /api/tournaments` for the ranking selector
RankingPage needs tournament options but `GET /api/admin/tournaments` is admin-only. New route (auth, non-admin) in a new `tournament-routes.ts` returning `{ tournaments: [{id, name, status}] }` (active first). "Histórico" section stays out of scope; the selector only enables per-tournament views.

### D7: Backfill as a script, migration carries DDL only
Points backfill needs PointsCalculator logic (tickets × matches per 'results' date) — not expressible in clean SQL. `server/scripts/backfill-tournament-points.ts` (seed-dev pattern, idempotent via `onConflictDoNothing`). Migration 0002 = DDL + status mapping only.

## Data Flow

```
PublishResults ──▶ uow.withTransaction: date→results; compute points; savePoints(user,tourn,date,pts) ──▶ payouts
Terminate ──▶ uow: lock tournament; active? no open date? sumByTournament → max>0 → saveWinners; status=finished; audit
Archive ──▶ uow: lock tournament; finished? → archived; save "Torneo N+1" (carryover 0); audit
Ranking ──▶ resolve active (default) → findByTournamentId → aggregate → sort+rank (ties share) → DTO
/matches/dates, /matches/current, propagate ──▶ findActive() → findOpenMatchDates(active.id)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `server/src/infrastructure/db/schema.ts` | Modify | tournaments: drop `isActive`, add `status` + `finishedAt`; new `tournamentWinners`, `tournamentPoints` tables |
| `server/drizzle/0002_*.sql` | Create | DDL: status/finished_at/backfill mapping/is_active drop; winners + points tables + indexes |
| `server/scripts/backfill-tournament-points.ts` | Create | Idempotent PointsCalculator backfill for existing 'results' dates |
| `server/src/domain/entities/tournament.ts` | Modify | `TournamentSnapshot`: `status` replaces `isActive`; `finish(winnerUserIds)` (active-only), `archive()` (finished-only) methods; `status` getter; remove dead `activate()/deactivate()` |
| `server/src/domain/entities/match-date.ts` | Modify | None needed (no lifecycle change) |
| `server/src/domain/errors/index.ts` | Modify | Add D4 errors |
| `server/src/domain/ports/tournament-repo.ts` | Modify | `findOpenMatchDates(tournamentId?: number)`; `findActive()` doc update (status='active') |
| `server/src/domain/ports/tournament-points-repo.ts` | Create | D2 port |
| `server/src/domain/ports/unit-of-work.ts` | Modify | `TransactionRepos` += `tournamentPointsRepo` |
| `server/src/infrastructure/repositories/drizzle-tournament-repo.ts` | Modify | status mapping everywhere; `findOpenMatchDates` filter; `findActive` → status query |
| `server/src/infrastructure/repositories/drizzle-tournament-points-repo.ts` | Create | Drizzle impl of D2 |
| `server/src/infrastructure/persistence/drizzle-unit-of-work.ts` | Modify | Factory += tournamentPointsRepo |
| `server/src/index.ts` | Modify | Wire points repo + router param; **boot auto-create**: `findAll() === []` → `tournamentRepo.save(Tournament.new({ id: 0, name: 'Torneo 1', commission: config.commission }))` after config load |
| `server/src/application/tournament/publish-results-use-case.ts` | Modify | `publish()` pick += `tournamentPointsRepo`; after step 6 write one row per ticket owner (incl. 0) |
| `server/src/application/tournament/create-date-use-case.ts` | Modify | After `findById`: `status !== 'active'` → `TournamentNotActiveError` |
| `server/src/application/tournament/create-match-use-case.ts` | Modify | Load tournament via `findById(matchDate.tournamentId)`; non-active → `TournamentNotActiveError` |
| `server/src/application/admin/terminate-tournament-use-case.ts` | Create | UoW: lock; active guard; open-date guard (409); winners from `findByTournamentId` max>0; `tournament.finish(ids)`; `saveWinners`; audit `tournament_finished` (reason JSON `{tournamentId, winners}`); DTO `{id, status, winners, finishedAt}` |
| `server/src/application/admin/archive-tournament-use-case.ts` | Create | UoW: lock; finished guard; `archive()`; update; save "Torneo N+1" (name = `Torneo ${parseNum(name) ?? id}+1`, carryover 0, config commission); audit `tournament_archived`; DTO `{id, status, nextTournament}` |
| `server/src/application/admin/list-tournaments-use-case.ts` | Modify | `AdminTournamentDTO`: `status`, `finishedAt`, `tournamentWinners: {userId, username}[]` (from points repo + userRepo); drop `isActive` |
| `server/src/application/admin/create-tournament-use-case.ts` | Modify | DTO: `status` instead of `isActive` |
| `server/src/application/admin/propagate-bet-amount-use-case.ts` | Modify | Resolve `findActive()`; no active → skip date loop (audit still written); else `findOpenMatchDates(active.id)` |
| `server/src/application/ranking/get-ranking-use-case.ts` | Modify | Deps → `(userRepo, tournamentRepo, tournamentPointsRepo)`; resolve tournamentId (active default, `[]` if none); read + aggregate persisted rows; sort/rank unchanged |
| `server/src/application/ranking/get-user-detail-use-case.ts` | Modify | `execute(userId, tournamentId?)`; resolve active; points from `findByUserAndTournament`; `totalMatches/correctPredictions` recomputed from that date's ticket+matches (same logic, restricted to paid dates) |
| `server/src/infrastructure/http/routes/admin-routes.ts` | Modify | `createAdminRoutes` param += `tournamentPointsRepo`; `tournamentParamsSchema`; POST `/terminate`, `/archive`; construct both UCs; ListTournaments wiring |
| `server/src/infrastructure/http/routes/match-routes.ts` | Modify | `/matches/current` + `/matches/dates`: resolve active first, scope queries |
| `server/src/infrastructure/http/routes/tournament-routes.ts` | Create | `GET /api/tournaments` (auth) — D6 |
| `server/src/infrastructure/http/routes/router.ts` | Modify | Param += points repo; register tournament-routes |
| `server/src/infrastructure/http/routes/ranking-routes.ts` | Modify | New UC deps; pass `query.tournamentId` to both UCs; `getUserDetail` gains tournamentId |
| `server/scripts/seed-dev.ts`, `seed-from-json.ts` | Modify | Replace `isActive: true` with `status: 'active'` |
| `client/src/api/admin-api.ts` | Modify | `AdminTournamentDTO`: `status`, `finishedAt`, `tournamentWinners`; drop `isActive`; `terminateTournament(id)`, `archiveTournament(id)` |
| `client/src/api/ranking-api.ts` | Modify | `getUserDetail(userId, tournamentId?)` |
| `client/src/hooks/use-admin.ts` | Modify | `useTerminateTournament`, `useArchiveTournament` (invalidate `['admin','tournaments']`, archive also `['matches']`); publish-results hook invalidates `['ranking']` too |
| `client/src/hooks/use-tournaments.ts` | Create | `useTournaments()` → GET /api/tournaments |
| `client/src/components/admin/TournamentManager.tsx` | Create | Rows: name, status label, finishedAt, winners, `Terminar torneo` (active) / `Archivar` (finished) buttons; confirm dialogs |
| `client/src/components/admin/AdminPage.tsx` | Modify | New tab `torneos` (Torneos) rendering TournamentManager |
| `client/src/components/admin/MatchEditor.tsx` | Modify | Tournament = `tournaments?.find(t => t.status === 'active')` (was has-open-date/first) |
| `client/src/components/admin/ResultsEntry.tsx` | Modify | `selectableDates` from active tournament only |
| `client/src/components/ranking/RankingPage.tsx` | Modify | Tournament selector (useTournaments), `useRanking(selectedId)` (undefined = active), "activo" badge; `useUserDetail(userId, selectedId)` |
| `client/src/components/matches/*`, `CarteleraPage.tsx` | Unchanged | Server-side scoping covers HistorySection/TicketsPage/Cartelera |

## Interfaces / Contracts

```ts
// domain/ports/tournament-points-repo.ts
export interface TournamentPoint { userId: string; tournamentId: number; matchDateId: number; points: number }
export interface TournamentPointsRepo {
  savePoints(rows: TournamentPoint[]): Promise<void>;
  findByTournamentId(tournamentId: number): Promise<TournamentPoint[]>;
  findByUserAndTournament(userId: string, tournamentId: number): Promise<TournamentPoint[]>;
  saveWinners(tournamentId: number, userIds: string[]): Promise<void>;
  findWinnersByTournamentId(tournamentId: number): Promise<{ userId: string }[]>;
}

// entity: TournamentSnapshot — status: TournamentStatus; finishedAt: Date | null
// tournament.status: 'active' | 'finished' | 'archived'
// Tournament.finish(winnerUserIds: string[]): Tournament  // throws TournamentNotActiveError
// Tournament.archive(): Tournament                        // throws TournamentNotFinishedError

// API
POST /api/admin/tournaments/:tournamentId/terminate  → 200 { id, status:'finished', winners: string[], finishedAt } | 409 open date | 422 non-active
POST /api/admin/tournaments/:tournamentId/archive    → 200 { id, status:'archived', nextTournament: {id,name,status} } | 422 non-finished
GET  /api/tournaments                                → { tournaments: [{id,name,status}] }  (auth)
GET  /api/ranking?tournamentId=                      → persisted points; omitted ⇒ active ([] when none)
GET  /api/ranking/users/:userId?tournamentId=
GET  /api/admin/tournaments                          → DTO gains status, finishedAt, tournamentWinners
```

## Testing Strategy

| Layer | File | Coverage |
|---|---|---|
| Unit (domain) | `server/src/domain/__tests__/tournament.test.ts` | `finish` active-only, `archive` finished-only, status in snapshot |
| Unit (UC, new) | `server/src/application/__tests__/tournament-lifecycle-use-cases.test.ts` | Terminate: single winner; tie → all winners; open date → 409; non-active reject; max=0 → no winners; no balance/prize writes. Archive: creates next (carryover 0, frozen archived), name N+1, non-finished reject |
| Unit (UC) | `tournament-use-cases.test.ts` | Publish persists one row per ticket owner (incl. 0) inside txn; CreateDate/CreateMatch non-active guards |
| Unit (UC) | `ranking-use-cases.test.ts` | Ranking reads persisted rows (no ticket calls), ties share rank, active default, `[]` when no active; GetUserDetail per-tournament |
| Unit (UC) | `propagate-bet-amount-use-case.test.ts` | Finished-tournament open date untouched; no active → empty results + audit still written |
| Unit (UC) | `admin-use-cases.test.ts` | ListTournaments DTO status + tournamentWinners |
| Integration | `api.test.ts` | terminate/archive routes (200/409/422/403); ranking default + tournamentId; GET /api/tournaments; /matches/dates scoped; `createMockServices` += points repo |
| Repos | `drizzle-tournament-repo.test.ts` + new `drizzle-tournament-points-repo.test.ts`, `drizzle-unit-of-work.test.ts` | status mapping, points/winners CRUD, UoW factory |
| Client | new `TournamentManager.test.tsx`; extend `MatchEditor.test.tsx`, `ResultsEntry.test.tsx`, `RankingPage.test.tsx` | status fixtures, active-only selection, selector passes tournamentId, buttons by status |

**Mock ripple** (TransactionRepos mocks): `tournament-use-cases.test.ts`, `admin-use-cases.test.ts`, `propagate-bet-amount-use-case.test.ts` `createFakeUow`/`fakeUow` objects gain `tournamentPointsRepo`. `Tournament.create` fixtures with `isActive` in `tournament.test.ts`, `api.test.ts`, `drizzle-unit-of-work.test.ts`, `drizzle-tournament-repo.test.ts`, `ResultsEntry.test.tsx`, `MatchEditor.test.tsx` switch to `status`.

## Migration / Rollout

**0002 DDL** (hand-edited after `pnpm db:generate`, 0001 precedent):
1. `ALTER TABLE tournaments ADD COLUMN status text DEFAULT 'active' NOT NULL;`
2. `ALTER TABLE tournaments ADD COLUMN finished_at timestamp;`
3. `UPDATE tournaments SET status = 'active' WHERE is_active = true; UPDATE tournaments SET status = 'archived' WHERE is_active = false;` (legacy safety mapping)
4. `ALTER TABLE tournaments DROP COLUMN is_active;`
5. `CREATE TABLE tournament_winners (id serial PK, tournament_id int REFERENCES tournaments(id), user_id uuid REFERENCES users(id), UNIQUE (tournament_id, user_id));`
6. `CREATE TABLE tournament_points (id serial PK, user_id uuid REFERENCES users(id) NOT NULL, tournament_id int REFERENCES tournaments(id) NOT NULL, match_date_id int REFERENCES match_dates(id) NOT NULL, points int NOT NULL DEFAULT 0, UNIQUE (tournament_id, match_date_id, user_id));` + index on `(tournament_id, user_id)`.
Then run `server/scripts/backfill-tournament-points.ts` (one row per user per 'results' date; re-runnable). **Rollback**: columns/tables additive except `is_active` drop → restore from SQL backup (proposal rollback plan). Rankdown: dropping persisted-points reads reverts to on-the-fly; removing terminate/archive routes disables lifecycle.

## Implementation Slices (chained PRs)

1. **Data foundation** — schema + 0002 + entity status/finish/archive + points repo port/impl + UoW + TransactionRepos + index wiring + backfill script + seeds + all test fixture updates (biggest slice).
2. **Write path** — PublishResults persistence; CreateDate/CreateMatch guards; propagation scoping; match-routes scoping (`/current`, `/dates`).
3. **Read path** — GetRanking/GetUserDetail persisted reads; ranking-routes resolution; GET /api/tournaments; RankingPage selector + badges.
4. **Lifecycle** — Terminate/Archive UCs + errors + admin routes + ListTournaments DTO + client TournamentManager, AdminPage tab, MatchEditor/ResultsEntry scoping.
5. **Boot + polish** — boot auto-create "Torneo 1", HistorySection verification, full suite + lint + build green.

Each slice is independently testable and green; server slices before client consumption.

## Open Questions

- None blocking. (Tie-break drift removal and archived-date visibility in TicketsPage are resolved: persisted-only ranking per spec; `/matches/dates` active-scoped server-side.)
