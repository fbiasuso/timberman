# Proposal: Bet Amount Propagation

## Intent

Open dates keep a stale betAmount when `defaultBetAmount` changes (verified bug). This change propagates the new default to open dates, blocks ticketed dates, and reports grouped admin results.

## Scope

### In Scope (Goals)
- Config update ALWAYS persists, independent of date outcomes.
- Propagate to all open, ticket-free dates, all active tournaments (`findOpenMatchDates()`).
- Ticketed dates blocked (keep amount) — structured partial success, never thrown.
- `audit_log` entries (config + propagation); admin DTO/Partidos show `betAmount`.

### Out of Scope (Non-Goals)
- Per-date betAmount editor; retroactive updates; user-facing amount visibility.
- Atomic config+dates transaction (future hardening).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `admin-operations` — System Configuration: propagation response, grouped UI, audit, Partidos `betAmount`.
- `system-config` — Config Update Persists / Default Bet Amount in Cents: propagation semantics.
- `tournament-management` — unchanged; cross-referenced.

## Approach

New `PropagateBetAmountUseCase` (→ `PropagateBetAmountResult`), called by `PATCH /api/admin/config` AFTER `UpdateConfigUseCase` persists (config always saves — req 3). Per `findOpenMatchDates()`: `countByMatchDateId` 0 ⇒ `withBetAmount(Money)` + `updateMatchDate` ⇒ `updatedDates`; else ⇒ `blockedDates`. Response `{config, updatedDates:[{id,dateNumber,betAmount}], blockedDates:[{id,dateNumber}]}`. Add `MatchDate.withBetAmount(Money)` (withPozo pattern). Audit via `AuditLogRepo.save`: config + propagation entries (action `default_bet_amount_update`, cents, date ids in `reason`). DTO gains `betAmount`; client widens `updateConfig` return, invalidates `['admin','tournaments']`, renders grouped results. `UpdateConfigUseCase` untouched.

## UI Behavior (ConfigPanel — Spanish copy)

- **Green** (≥1 success): always `"Éxito: se guardó el nuevo monto de apuesta ($5,00) para futuras fechas."` + per updated date: `"Éxito: se modificó correctamente el monto de la apuesta en la fecha 46."`
- **Red** (≥1 blocked), per blocked date: `"Error: no se pudo cambiar el monto de la apuesta en la fecha 45 porque ya existen jugadas para esa fecha."`

## Affected Areas

- Server: `propagate-bet-amount-use-case.ts` (new), `match-date.ts` (add `withBetAmount`), `admin-routes.ts` (compose on config PATCH), `list-tournaments-use-case.ts` (DTO `betAmount`).
- Client: `admin-api.ts` (widen return), `ConfigPanel.tsx` (grouped boxes), `use-admin.ts` (invalidate tournaments), `MatchEditor.tsx` (show amount).
- Ports `findOpenMatchDates`/`updateMatchDate`/`countByMatchDateId` exist — no port changes, no migrations.

## Risks

- Low: bet placed between count and update → `findMatchDateByIdForUpdate` future.
- Med: breaking client contract (new shape) → widen `admin-api.ts`; ConfigPanel only consumer.
- Med: stale Partidos → extra query invalidation.
- Med: audit_log lacks date FK → date ids in `reason`.

## Rollback Plan

Remove propagation call → config-only. Revert DTO/client; SQL restore of `bet_amount` if needed.

## Success Criteria

- [ ] PATCH `defaultBetAmount` persists config + updates all ticket-free open dates.
- [ ] Ticketed dates keep amount, in `blockedDates`, HTTP 200.
- [ ] `audit_log` rows written; Partidos shows new amount (admin-only).
- [ ] Existing suites green; new use-case + route tests pass.

## Open Questions

- "fecha 45/46": `dateNumber` or `id`? Audit: aggregate vs per-date?
