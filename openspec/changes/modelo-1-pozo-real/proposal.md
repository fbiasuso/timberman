# Proposal: Modelo 1 — Real-Money Pozo

## Intent

The prode currently runs a "model 0": a pozo is computed at close but never paid out, commission is inert (dates use `tournament.commission`; registration uses a hardcoded constant, not `config.allowRegistration`), and SystemConfig lives only in memory — lost on every Render cold start. Modelo 1 makes the pool real: persisted config, commission credited to the closing admin, pozo paid out to winning tickets, and unpaid pozo carried over to the next date. It also fixes the two wiring bugs found in exploration and corrects the documented-but-wrong pozo formula.

## Scope

### In Scope

- **Persist SystemConfig**: new `system_config` table (single row, id=1: commission %, allowRegistration, defaultBetAmount cents). Boot loads `repo.get() ?? DEFAULTS`; seed inserts the row; UpdateConfigUseCase becomes async and persists after mutation.
- **Wiring fixes**: register reads `config.allowRegistration` by reference (toggle becomes live); date close uses `config.commission`, not `tournament.commission`.
- **Pozo formula**: `pozo = gross − commission`, where commission = gross × config%. Code already computes this correctly; fix README, `Commission` JSDoc, and the betting-engine spec.
- **Commission snapshot**: new `match_dates.commission` column stores the rate applied at close. Closed dates are NEVER recomputed. `tournament.commission` becomes informational (set from config at creation; no longer feeds the pozo).
- **Close flow** (CloseDateUseCase): `pozo = carryover + (recaudación − commission)`; consume carryover (reset to 0); credit commission to the closing admin's balance (adminId from authenticated JWT; requires userRepo); write `commission_payout` audit_log entry; store pozo + commission snapshot on the date.
- **Publish results** (PublishResultsUseCase exists but is unwired — wire it): points via existing PointsCalculator; winners = ticket(s) with max correct count, only if max > 0; pozo split equally among winners in integer cents (remainder to first winner); credit balances via userRepo. If max = 0: no payout, pozo moves to new `tournaments.carryover` (int, default 0). Points keep working for ranking (money and points coexist).
- **New admin route**: `POST /api/admin/dates/:dateId/publish-results`.
- **Client**: "Mis Tickets" shows "Premio ganado" on winning tickets; admin Resultados shows winners + amounts + house commission after publish; Cartelera shows accumulated pozo (including carryover) for open dates; admin Resultados gets a "Publish results and pay out" button when date status is `closed`.

### Out of Scope

- House ledger table (deferred decision D1: commission goes to the closing admin's balance).
- Live estimated pozo for open dates beyond carryover display.
- PDF ticket generation (remains a placeholder).

## Capabilities

### New Capabilities

- `prize-payouts`: winner determination, pozo split, balance credits, carryover accumulation, commission snapshot on close.
- `system-config`: persisted SystemConfig — table, boot load with defaults, seed, async update.

### Modified Capabilities

- `betting-engine`: Pozo Calculation formula corrected to `gross − commission`; Configurable Commission becomes system-config-driven with snapshot-on-close semantics.
- `admin-operations`: config updates persist; new publish-results route; close credits commission to acting admin; results breakdown after publish.
- `tournament-management`: close flow gains carryover consumption + commission snapshot; publish-results now pays out; carryover lifecycle on tournaments.
- `user-auth`: registration reads live `config.allowRegistration` (toggle becomes effective).

## Approach

New Drizzle migration + schema additions; new ConfigRepo port (`get`/`upsert`) with Drizzle impl; SystemConfig becomes an async-loaded shared reference wired through routes. CloseDateUseCase gains userRepo, auditLogRepo, config; PublishResultsUseCase gains userRepo + payout logic. Snapshot fields flow through existing entity snapshots/repos. Client: extend DTO types + API hooks, then update 4 components.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/src/infrastructure/db/schema.ts` + new migration | Modified | `system_config` table; `match_dates.commission`; `tournaments.carryover`; ticket prize-won field |
| `server/src/index.ts` | Modified | Boot-load config from DB; drop hardcoded `allowRegistration`; wire config by reference |
| `server/src/application/tournament/close-date-use-case.ts` | Modified | Carryover, commission snapshot, admin credit, audit |
| `server/src/application/tournament/publish-results-use-case.ts` | Modified | Winners + payout; wired to new route |
| `server/src/infrastructure/http/routes/admin-routes.ts` | Modified | New publish-results route; config wiring |
| `server/src/application/auth/*`, `application/admin/*` | Modified | Register reads live config; UpdateConfigUseCase async + persistent |
| `client/src` (`bets/TicketCard`, `admin/ResultsEntry`, `admin/AdminPage`, `matches/CarteleraPage`, `types`, `api/admin-api`) | Modified | Premio ganado, publish button, breakdown, carryover pozo |
| `README.md`, `server/src/domain/value-objects/commission.ts` | Modified | Correct pozo formula docs |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Double payout on re-submit of publish-results | Med | `publishResults()` domain transition already guards closed→results only; verify idempotency in tests |
| Money rounding in pozo split | Med | Integer cents throughout; remainder-to-first-winner rule; unit tests |
| Existing DBs lack new columns/config row | Low | Migration + boot-time upsert of default config row |
| Concurrent closes on same date | Low | Status transition guard; single date owner |

## Rollback Plan

Down-migration drops new columns/tables; config falls back to in-memory defaults. Code revert: wire close back to `tournament.commission`, register back to the constant, unregister publish-results route. Snapshot semantics mean closed dates never need recomputation, so no data repair.

## Dependencies

- Existing Drizzle migration tooling; existing `PozoCalculator`, `PointsCalculator`, `Commission`, `Money` (reused, not rewritten).

## Success Criteria

- [ ] Server restart: admin config changes survive (loaded from DB at boot).
- [ ] Toggling allowRegistration immediately blocks/permits registration.
- [ ] Closing a date credits commission to the acting admin + writes audit entry + stores pozo and commission snapshot.
- [ ] Publishing results pays winners exactly (cents, remainder to first winner); max=0 rolls pozo into carryover, visible in Cartelera.
- [ ] Client shows Premio ganado, admin payout breakdown, publish button.
- [ ] All existing 138 tests pass; new tests cover close/publish/config flows.
