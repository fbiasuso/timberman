# Design: Bet Amount Propagation

## Context / Problem Recap

`PATCH /api/admin/config` persists `defaultBetAmount` but never touches existing dates — an open date created under an older default keeps a stale `betAmount` (verified bug). Specs (`admin-operations`, `system-config`, `tournament-management`) require: config always persists regardless of date outcomes; propagate to all open, ticket-free dates; ticketed dates keep their amount and are reported as data (partial success, never thrown); response `{ config, updatedDates, blockedDates }`; two `audit_log` rows; admin DTO + Partidos show `betAmount`; grouped Spanish UI feedback.

## Decisions

### D1: New `PropagateBetAmountUseCase` (do not extend `UpdateConfigUseCase`)

| Option | Tradeoff | Decision |
|---|---|---|
| New use case, route composes | Route gains thin orchestration; UC independently testable | **Chosen** |
| Extend `UpdateConfigUseCase` | One UC, but two responsibilities; validation + propagation coupled | Rejected |
| Single transaction incl. config | Contradicts req 3 (config MUST save even when dates block); `SystemConfigRepo` not in `TransactionRepos` | Rejected |

```ts
class PropagateBetAmountUseCase {
  constructor(
    tournamentRepo: TournamentRepo,
    ticketRepo: TicketRepo,
    auditLogRepo: AuditLogRepo,
    uow?: UnitOfWork,
  ) {}
  execute(adminId: string, betAmount: Money): Promise<PropagateBetAmountResult>;
}
// PropagateBetAmountResult = { updatedDates: {id;dateNumber;betAmount}[]; blockedDates: {id;dateNumber}[] }
// betAmount in integer cents. File: server/src/application/admin/propagate-bet-amount-use-case.ts
```

`UpdateConfigUseCase` stays byte-identical (all 8 existing tests keep passing). Proposal open question resolved: UI copy uses `dateNumber` ("fecha N"); audit + programmatic use use `id`.

### D2: Composition & transactionality — config leg outside, propagation leg inside UoW

Route sequence (`admin-routes.ts` PATCH handler):
1. `conf = await updateConfigUseCase.execute(body.key, body.value)` — persists config + mutates shared ref. Always runs first; cannot be rolled back by propagation.
2. If `body.key === 'defaultBetAmount'`: `prop = await propagateBetAmountUseCase.execute(request.user!.sub, Money.fromCents(conf.defaultBetAmount))`.
3. Reply `{ config: conf, updatedDates, blockedDates }` — empty arrays for non-defaultBetAmount keys.

`execute` wraps the propagation leg (date updates + both audit rows) in `uow.withTransaction((repos) => ...)` when `uow` is provided (repos: `tournamentRepo`/`ticketRepo`/`auditLogRepo`), else falls back to injected repos — exact `AdjustBalanceUseCase`/`CloseDateUseCase` pattern. This makes date updates + audit atomic among themselves while keeping config persistence independent (req 3). No row locks on the open-date list; the count→update race window is documented (D-Risks).

### D3: `MatchDate.withBetAmount(amount: Money): MatchDate`

Mirror `withPozo`/`withCommission`: private constructor, return new instance, all fields preserved, swap `_betAmount`. `Money` VO already rejects non-integer cents. File: `server/src/domain/entities/match-date.ts`.

### D4: Repo primitives — no changes

`findOpenMatchDates()` (drizzle-tournament-repo.ts:165) selects all `status='open'` rows with **no** tournament-active join. Confirmed: no tournament-deactivation flow exists (`isActive` is only read, defaults true) — the spec's "active tournaments" qualifier is satisfied by construction. No repo change; flag as open item if a deactivation flow ever lands. `TicketRepo.countByMatchDateId(id) === 0` is the "ticket-free" check.

### D5: Route response shape

`{ config, updatedDates, blockedDates }` always present. `updatedDates: { id, dateNumber, betAmount }` (cents), `blockedDates: { id, dateNumber }`.

### D6: Audit — two rows, both written by the propagation use case

| Row | action | amount | reason |
|---|---|---|---|
| 1 | `default_bet_amount_update` | new cents | `null` |
| 2 | `default_bet_amount_propagation` | new cents | `JSON.stringify({ changed: [ids], blocked: [ids] })` — both keys always present |

`reason` is a `text` column (schema.ts:100) → JSON string. `AuditLog.new({ id: 0, adminId, action, amount, reason })` + `AuditLogRepo.save` (AdjustBalance convention). Route stays a thin composer — all defaultBetAmount audit logic lives in one testable unit. Both rows carry the JWT admin id (`request.user!.sub`).

### D7: Admin date DTO gains `betAmount`

`TournamentDateDTO` in `server/src/application/admin/list-tournaments-use-case.ts` (from `dateSnap.betAmount`, cents) and client `TournamentDateDTO` in `client/src/api/admin-api.ts`.

### D8: Client

- `admin-api.ts`: widen `updateConfig` to `Promise<ConfigUpdateResult>` (`{ config, updatedDates, blockedDates }`), full body not just `config`. Only ConfigPanel consumes it (verified).
- `use-admin.ts` `useUpdateConfig.onSuccess`: invalidate BOTH `['admin','config']` and `['admin','tournaments']` (Partidos refresh).
- `ConfigPanel.tsx`: render grouped boxes inline (no extraction) below the bet-amount field when the mutation succeeded AND `variables.key === 'defaultBetAmount'`. Green group = default-save line (always shown, even if every date is blocked — req) + one line per updated date. Red group = one line per blocked date. Exact copy: `Éxito: se guardó el nuevo monto de apuesta ($5,00) para futuras fechas.`, `Éxito: se modificó correctamente el monto de la apuesta en la fecha {n}.`, `Error: no se pudo cambiar el monto de la apuesta en la fecha {n} porque ya existen jugadas para esa fecha.` Amount formatted cents→`$5,00` (comma decimal).
- `MatchEditor.tsx`: date header shows formatted `betAmount` (cents→`$5,00`) next to "Fecha {n}".

## Architecture / Sequence

```
ConfigPanel ──PATCH /api/admin/config (key=defaultBetAmount)──▶ admin-routes
                                                                 │
  1. UpdateConfigUseCase.execute ──▶ configRepo.upsert ──▶ shared config ref (always)
  2. key==='defaultBetAmount'? ──▶ PropagateBetAmountUseCase.execute(adminId, Money)
         │  [uow? withTransaction]
         ├─ findOpenMatchDates()
         ├─ per date: countByMatchDateId(id)
         │     ├─ 0 ─▶ date.withBetAmount(amount) ─▶ updateMatchDate ─▶ updatedDates[]
         │     └─ >0 ────────────────────────────────────────────────▶ blockedDates[]
         ├─ audit: default_bet_amount_update (amount, reason null)
         └─ audit: default_bet_amount_propagation (reason JSON {changed,blocked})
  3. reply { config, updatedDates, blockedDates }
         └─▶ ConfigPanel grouped green/red boxes; invalidate ['admin','config'] + ['admin','tournaments']
```

## Data Model Changes

**None — no migration.** `match_dates.bet_amount` exists (default 1500) and `DrizzleTournamentRepo.updateMatchDate` already writes it; `audit_logs` exists with `action`/`amount`/`reason`/`admin_id`.

## API Contract Changes

Before: `PATCH /api/admin/config` → `{ config: AdminConfigDTO }`.
After: `{ config: AdminConfigDTO, updatedDates: [{ id, dateNumber, betAmount }], blockedDates: [{ id, dateNumber }] }` — arrays always present. Non-defaultBetAmount keys return empty arrays. `GET /api/admin/tournaments` date objects gain `betAmount` (additive, non-breaking).

## Client Changes

| File | Change |
|---|---|
| `client/src/api/admin-api.ts` | `ConfigUpdateResult` type; `updateConfig` returns full body; `TournamentDateDTO.betAmount` |
| `client/src/hooks/use-admin.ts` | `useUpdateConfig` invalidates `['admin','tournaments']` too |
| `client/src/components/admin/ConfigPanel.tsx` | Grouped green/red result boxes (inline), exact Spanish copy, `$5,00` formatting |
| `client/src/components/admin/MatchEditor.tsx` | Header shows formatted `betAmount` |

## Test Plan

| Layer | File | Coverage |
|---|---|---|
| Unit (UC, new) | `server/src/application/__tests__/propagate-bet-amount-use-case.test.ts` | all ticket-free → all updated; mixed → split; all blocked → still saves + audit; no open dates → `{"changed":[],"blocked":[]}`; two audit rows with actions/amount/reason JSON; `withBetAmount` result persisted |
| Unit (entity) | `server/src/domain/__tests__/match-date.test.ts` | `withBetAmount` returns new instance, preserves id/tournamentId/dateNumber/status/pozo/commission/createdAt |
| Integration (routes) | `server/src/infrastructure/http/__tests__/api.test.ts` | defaultBetAmount PATCH → 200 with response shape; blocked dates → 200 (not thrown); both audit rows; non-defaultBetAmount key → empty arrays (existing `createMockServices` already stubs all needed fns; make `updateMatchDate` resolve the entity) |
| Verify only | `server/src/application/__tests__/admin-use-cases.test.ts` | UpdateConfigUseCase untouched — suite stays green, no edits |
| Client | `client/src/components/__tests__/ConfigPanel.test.tsx` | green group (default line + per-date lines), red group per blocked date, default line when all blocked, no group for commission-only save (mock gains `data`/`variables`) |
| Client (new, small) | `client/src/api/__tests__/admin-api.test.ts` | `updateConfig` resolves the widened body (mock `./client`; no such mock precedent in the suite — if awkward, ConfigPanel tests + TS typing cover the contract) |

Commands: server — `pnpm test`, `pnpm lint` (tsc --noEmit), `pnpm build` (tsc) in `server/`; targeted `pnpm exec vitest run src/application/__tests__/propagate-bet-amount-use-case.test.ts src/domain/__tests__/match-date.test.ts src/infrastructure/http/__tests__/api.test.ts`. Client — `pnpm test`, `pnpm lint`, `pnpm build` in `client/`.

## Risks / Open Items

- **Race**: bet placed between `countByMatchDateId` and `updateMatchDate` — low (single admin, one open date per tournament); future hardening: per-date `findMatchDateByIdForUpdate` inside the propagation transaction.
- **Breaking contract**: `updateConfig` return widened — ConfigPanel is the only consumer.
- **`findOpenMatchDates()` ignores `isActive`** — safe today (no deactivation flow); must filter if one lands.
- **Audit `reason`** is JSON in a text column; date ids have no FK (accepted per proposal).
- No client API-mock precedent — new mock pattern, or fall back to ConfigPanel-level coverage.
