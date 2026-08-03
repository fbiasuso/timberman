# Tasks: Bet Amount Propagation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Total files changed | 12 |
| Total lines estimate | ~370 changed + ~280 new (~650 total) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Delivery strategy | ask-always (C1) |
| Chain strategy | pending |
| Suggested split | PR 1: Domain + Application (no route/client) | PR 2: Route + Client + UI |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Base | Notes |
|------|------|-----------|------|-------|
| 1 | Domain entity + use case + unit tests (no route change) | PR 1 | main | Pure business logic; independently testable via unit suite; no existing suite regression |
| 2 | Route wiring + client API/UI + integration tests | PR 2 | main | Route response shape changed; client widened; UI + integration tests; both PRs independently shippable since PR 1 runs but is unreachable until PR 2 wires it |

## Phase 1: Domain

- [x] 1.1 Add `withBetAmount(amount: Money): MatchDate` to `server/src/domain/entities/match-date.ts` (mirror `withPozo` pattern — private ctor, return new MatchDate, swap `_betAmount`). ~12 new lines.
- [x] 1.2 Add `withBetAmount` unit test to `server/src/domain/__tests__/match-date.test.ts`: returns new instance, preserves all other fields (id/tournamentId/dateNumber/status/pozo/commission/createdAt). ~15 new lines.

## Phase 2: Application

- [x] 2.1 Create `server/src/application/admin/propagate-bet-amount-use-case.ts` — `PropagateBetAmountUseCase` with `execute(adminId: string, betAmount: Money): Promise<PropagateBetAmountResult>`. Dependencies: `TournamentRepo`, `TicketRepo`, `AuditLogRepo`, `UnitOfWork?`. Follow `AdjustBalanceUseCase` UoW pattern. Inside UoW transaction: `findOpenMatchDates()`, per-date `findMatchDateByIdForUpdate(id)` (row-level lock), `countByMatchDateId` → 0: `withBetAmount` + `updateMatchDate` → `updatedDates`; else → `blockedDates`. Write 2 audit rows (config + propagation). ~75 new lines.
- [x] 2.2 Create `server/src/application/__tests__/propagate-bet-amount-use-case.test.ts`: covers all ticket-free → all updated, mixed split, all blocked still saves + audit, no open dates `{"changed":[],"blocked":[]}`, two audit rows with correct action/amount/reason JSON. ~120 new lines.

## Phase 3: Route Wiring & DTO

- [ ] 3.1 Add `betAmount` to `TournamentDateDTO` in `server/src/application/admin/list-tournaments-use-case.ts` — include `betAmount: dateSnap.betAmount` in DTO mapping. ~3 changed lines.
- [ ] 3.2 Wire `PropagateBetAmountUseCase` in `server/src/infrastructure/http/routes/admin-routes.ts` PATCH handler: after `updateConfigUseCase.execute`, if `key === 'defaultBetAmount'`, call propagate UC; reply `{ config, updatedDates, blockedDates }`. Instantiate in `createAdminRoutes` factory (all ports + uow already in scope). ~30 changed lines.
- [ ] 3.3 Add/update route integration tests in `server/src/infrastructure/http/__tests__/api.test.ts`: defaultBetAmount PATCH → 200 with `{config, updatedDates, blockedDates}`; blocked dates → 200; both audit rows written; non-defaultBetAmount key → empty arrays; `updateMatchDate` mock resolves entity. Existing mock factory already stubs all needed fns. ~60 new lines.

## Phase 4: Client

- [ ] 4.1 Widen `updateConfig` return type in `client/src/api/admin-api.ts`: add `ConfigUpdateResult = { config, updatedDates, blockedDates }` DTO types, return full body; add `betAmount` to client `TournamentDateDTO`. ~15 changed lines.
- [ ] 4.2 Update `useUpdateConfig` onSuccess in `client/src/hooks/use-admin.ts`: invalidate `['admin','tournaments']` alongside `['admin','config']`. ~2 changed lines.
- [ ] 4.3 Add grouped green/red result boxes to `client/src/components/admin/ConfigPanel.tsx`: render when `data.variables.key === 'defaultBetAmount'`. Green group: default-save line (always, even all blocked) + one line per `updatedDates` (exact Spanish copy with `$5,00` formatting). Red group: one line per `blockedDates`. ~40 new lines.
- [ ] 4.4 Display `betAmount` in `client/src/components/admin/MatchEditor.tsx` accordion header next to "Fecha {n}" (admin-only). Format cents→`"$5,00"`. ~3 changed lines.