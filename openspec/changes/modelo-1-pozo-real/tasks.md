# Tasks: Modelo 1 — Real-Money Pozo

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1000–1150 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 foundation → PR 2 config → PR 3 flows → PR 4 client |
| Delivery strategy | ask-always |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Schema + migration + domain entities + config repo | PR 1 | base main; entity tests included |
| 2 | Boot load/ensureDefault, async UpdateConfig, auth live toggle, seed | PR 2 | base main; config/register tests |
| 3 | Close + publish flows, pozo-split, routes, list-tournaments DTO | PR 3 | base main; use-case + api tests |
| 4 | Client: types, admin-api, hooks, ResultsEntry, TicketCard, Cartelera | PR 4 | base main; depends on PR 3 |

## Phase 1: Foundation

- [x] 1.1 `schema.ts`: add `system_config` (id=1, commission numeric(5,2) default '15.00', allow_registration boolean default true, default_bet_amount integer default 1500); add `matchDates.commission` numeric default '0.00', `tournaments.carryover` int default 0, `tickets.prizeWon` int null (sys-config: Persisted; betting-engine: snapshot).
- [x] 1.2 Run `npm run db:generate` → `server/drizzle/0001_*.sql`; commit migration + meta snapshot.
- [x] 1.3 Create `domain/entities/system-config.ts`: `SystemConfig` + `DEFAULT_SYSTEM_CONFIG` (15/true/1500); delete interface from `get-config-use-case.ts`; export via barrels.
- [x] 1.4 Create `domain/ports/system-config-repo.ts`: `get(): Promise<SystemConfig|null>`, `upsert(config)`; add to ports barrel.
- [x] 1.5 Create `infrastructure/repositories/drizzle-system-config-repo.ts`: read id=1; `upsert` via insert `onConflictDoUpdate` id=1.
- [x] 1.6 Entities: `Tournament.withCarryover(cents)` + snapshot field; `MatchDate.withCommission(pct)` + field; `Ticket.withPrize(cents)` + `prizeWon`.
- [x] 1.7 `errors/index.ts`: add `DateNotClosedError` (DATE_NOT_CLOSED, 409); `MatchDate.publishResults()` throws it when not closed.
- [x] 1.8 `TicketRepo.update(ticket)` (port + Drizzle impl); `DrizzleTournamentRepo.update`/`updateMatchDate` persist carryover/commission.

## Phase 2: Config Persistence + Wiring

- [ ] 2.1 `index.ts`: instantiate repo → `ensureDefault()` (upsert DEFAULTS if `get()` null) → load `config` → pass to router; delete `allowRegistration` const (sys-config: Boot loads, Empty table, Seed Default).
- [ ] 2.2 `UpdateConfigUseCase`: ctor `(config, repo)`; `execute` async; after mutation `await repo.upsert(config)` (sys-config: Update survives restart; admin-ops: System Configuration).
- [ ] 2.3 Auth live toggle: `RegisterUseCase`/`AuthService`/`auth-routes` take `SystemConfig` ref, read `allowRegistration` at execute; `router.ts` drops `allowRegistration` param (user-auth: all 3 scenarios).
- [ ] 2.4 `seed-dev.ts`: insert system_config row (15/true/1500) (sys-config: Seed Default Config Row).

## Phase 3: Close + Publish Flows + Routes

- [ ] 3.1 `CreateTournamentUseCase`: default `commission` from `config.commission` (informational) (tournament-mgmt: Start New Tournament).
- [ ] 3.2 `CloseDateUseCase`: ctor `(tournamentRepo, ticketRepo, pozoCalculator, config, userRepo, auditLogRepo)`; `execute(dateId, adminId)`: pozo = carryover + (gross − commission via `Commission(config.commission)`); store pozo + commission snapshot; `tournament.withCarryover(0)` + update; `userRepo.update(admin.addBalance(commission))`; save audit `'commission_payout'` (tournament-mgmt: Close Date Financials, Carryover Lifecycle; betting-engine: Pozo Calculation).
- [ ] 3.3 Create `application/tournament/pozo-split.ts`: pure `splitPozo(pozoCents, n)` floor + remainder to index 0 (prize-payouts: Equal Pozo Split).
- [ ] 3.4 `PublishResultsUseCase`: ctor gains `userRepo`; winners = max correct > 0, ascending ticketId; transition-first `updateMatchDate(publishResults())` (idempotent via DateNotClosedError); credit winners + persist `ticket.withPrize`; max=0 → `tournament.withCarryover(carryover + pozo)`; result gains `winners` (prize-payouts: all; tournament-mgmt: Date Lifecycle).
- [ ] 3.5 `admin-routes.ts`: close passes `request.user.sub`; add `POST /api/admin/dates/:dateId/publish-results` (zod coerce dateId) behind auth+admin (admin-ops: Publish Results Route).
- [ ] 3.6 DTOs: `bet-routes.ts` expose `prizeWon`; `match-routes.ts` expose `commission` + `carryover` (prize-payouts: Premio ganado, Carryover in Cartelera).
- [ ] 3.7 `list-tournaments-use-case.ts`: per-tournament `dates[]` `{id,dateNumber,status,pozo,commission,winners[{ticketId,userId,username,prize}]}` via ticketRepo+userRepo lookups — CONFIRMED payload for design risk #2 (admin-ops: Payout Breakdown).

## Phase 4: Client

- [ ] 4.1 `types/index.ts`: `TicketDTO.prizeWon?`, `MatchDateDTO.commission`, `carryover`.
- [ ] 4.2 `admin-api.ts`: `publishResults(dateId)`; extend `AdminTournamentDTO` with dates+winners.
- [ ] 4.3 `use-admin.ts`: `usePublishResults()` (invalidates admin tournaments + matches).
- [ ] 4.4 `ResultsEntry.tsx`: close button only when `open`; "Publish results and pay out" when `closed`; winners + amounts + commission breakdown when `results` (admin-ops: Payout Breakdown).
- [ ] 4.5 `TicketCard.tsx`: "Premio ganado" badge when `prizeWon != null` (prize-payouts: Premio ganado).
- [ ] 4.6 `CarteleraPage.tsx`: show pozo including carryover (prize-payouts: Carryover).

## Phase 5: Tests

- [ ] 5.1 Unit `splitPozo`: 1000/3 → 334/333/333; exact; single winner (prize-payouts: Equal Split).
- [ ] 5.2 MatchDate: `withCommission` immutable; `publishResults()` throws DateNotClosedError (betting-engine: never recomputed).
- [ ] 5.3 CloseDateUseCase (mocks): carryover add+reset, admin credit, audit entry, zero-bet → 0 (tournament-mgmt scenarios).
- [ ] 5.4 PublishResultsUseCase (mocks): winners paid, prizeWon persisted, max=0 → carryover, no credits; double execute → DateNotClosedError, no double credit (prize-payouts: Idempotency).
- [ ] 5.5 Update existing: config use cases (async + repo), register (config ref), close/publish signatures, `api.test.ts` (403 non-admin publish, publish happy path, close credits, config round-trip) (admin-ops: Re-submit harmless, Non-admin rejected).

## Phase 6: Docs

- [ ] 6.1 `README.md` pozo row + `commission.ts` JSDoc: pozo = gross − commission (betting-engine delta already corrects spec; archive merges).
