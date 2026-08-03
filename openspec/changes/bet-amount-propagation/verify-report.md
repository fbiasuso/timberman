# Verification Report: Bet Amount Propagation

**Change**: bet-amount-propagation
**Version**: N/A (delta specs)
**Mode**: Standard (no Strict TDD gate)
**Date**: 2026-08-02
**Verifier**: sdd-verify executor
**Commits**: `a5e100e` (server: domain entity + use case), `8f1021f` (route wiring + client UI), `bae8ba2` (fix: include `betAmount` in propagation date results)

---

## Completeness (Tasks)

| Metric | Value |
|--------|-------|
| Tasks total | 11 |
| Tasks complete | 11 (`[x]`) |
| Tasks incomplete | 0 |

All checkboxes in `tasks.md` are checked: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4. Confirmed 11/11 as dispatched.

## Build & Tests Execution

**Build / Type check (server)**: ✅ Passed
```text
> cd server && pnpm lint        # = tsc --noEmit
EXIT: 0
```

**Build / Type check (client)**: ✅ Passed
```text
> cd client && pnpm lint        # = tsc --noEmit
EXIT: 0
```

**Tests (server)**: ✅ 242 passed / 0 failed / 0 skipped
```text
> cd server && pnpm test        # = vitest run
Test Files  25 passed (25)
     Tests  242 passed (242)
Duration 48.06s
```

**Tests (client)**: ✅ 109 passed / 0 failed / 0 skipped
```text
> cd client && pnpm test        # = vitest run
Test Files  11 passed (11)
     Tests  109 passed (109)
Duration 65.62s
```

**Coverage**: ➖ Not measured (no coverage gate configured in this project).

New/updated covering tests for this change:
- `server/src/application/__tests__/propagate-bet-amount-use-case.test.ts` — 5 tests (all free → all updated; mixed split; all blocked still saves + audit; no open dates → `{"changed":[],"blocked":[]}`; no-UoW fallback).
- `server/src/domain/__tests__/match-date.test.ts` — 3 new `withBetAmount` tests (new instance, preserves all fields, no mutation).
- `server/src/infrastructure/http/__tests__/api.test.ts` — 4 new route tests (full response shape 200; blocked → 200 partial; both audit rows; non-defaultBetAmount key → empty arrays + UC never invoked).
- `client/src/components/__tests__/ConfigPanel.test.tsx` — 4 new propagation tests (green default + per-date lines; red per blocked; green default line when all blocked; no group for commission save).
- `client/src/components/__tests__/MatchEditor.test.tsx` — 1 new test (`Fecha 2 · $20,00` cents→pesos) + fixtures gained `betAmount`.

## Spec Compliance Matrix

| Requirement | Verdict | Evidence |
|---|---|---|
| **admin-operations** — Propagation Results Feedback (grouped green/red, exact copy, default line always, tournaments invalidation) | **PASS** | `ConfigPanel.test.tsx` 4 tests assert exact Spanish copy per scenario (`Éxito: se guardó el nuevo monto de apuesta ($5,00) para futuras fechas.`, `Éxito: se modificó correctamente el monto de la apuesta en la fecha 46.`, `Error: no se pudo cambiar el monto de la apuesta en la fecha 45 porque ya existen jugadas para esa fecha.`); default line rendered outside the blocked-count guard; `use-admin.ts` invalidates both `['admin','config']` and `['admin','tournaments']`. |
| **admin-operations** — Propagation Audit Trail (2 rows, actions, cents amount, JSON reason both keys, JWT admin id) | **PASS** | UC unit tests assert `default_bet_amount_update` (amount 800, reason `null`) + `default_bet_amount_propagation` (`{"changed":[...],"blocked":[...]}` both keys always); route test asserts `adminId === 'admin-1'` from JWT; both rows written inside the UoW. |
| **admin-operations** — System Configuration MODIFIED (propagate to open ticket-free dates; blocked kept + reported, never thrown; response shape) | **PASS** | Propagation + 200-partial behavior PASS (route integration tests). Response shape NOW COMPLETE: both `updatedDates` and `blockedDates` entries carry `{id, dateNumber, betAmount}` — `betAmount` is the new cents for updated dates and the current (unchanged) cents for blocked dates. Asserted in route test (`{id:46, dateNumber:46, betAmount:500}`, `{id:45, dateNumber:45, betAmount:1500}`). Resolved by commit `bae8ba2` — see Re-verification section. |
| **admin-operations** — Partidos Date Accordion MODIFIED (header shows `betAmount`; `TournamentDateDTO` includes `betAmount`) | **PASS** | `MatchEditor.tsx` header renders `Fecha {n} · {formatPesos(betAmount)}`; test `Fecha 2 · $20,00`; `betAmount` in server `TournamentDateDTO` (`list-tournaments-use-case.ts` from `dateSnap.betAmount`) and client `TournamentDateDTO`. Status icons (`🔒`/`✅`) pre-existing, unchanged by this delta. |
| **system-config** — Config Update Persists (config saves regardless of propagation outcome; blocked must not fail) | **PASS** | Route composes `updateConfigUseCase.execute` FIRST (outside UoW, cannot roll back); blocked dates are data, never thrown; integration test asserts 200 with config persisted + ticketed date untouched. |
| **system-config** — Default Bet Amount in Cents (cents; propagate ticket-free; ticketed keeps old) | **PASS** | `Money.fromCents` throughout; UC unit test asserts persisted date `betAmount.cents === 800`; ticketed dates excluded from `updateMatchDate` calls. |
| **tournament-management** — Bet Amount Propagation Boundary (only on config default change; never on creation; no create/close/delete; one-open-date rule intact) | **PASS** | Route gates propagation on `body.key === 'defaultBetAmount'` only; `CreateDateUseCase` and `POST /api/admin/dates` untouched (git diff confirms); no repo schema changes. |

**Compliance summary**: 7 requirements fully compliant, 0 requirements PARTIAL.

## Correctness (Static Evidence)

| Item | Status | Notes |
|------|--------|-------|
| `MatchDate.withBetAmount(amount: Money)` | ✅ Implemented | Mirrors `withPozo`; private ctor, returns new instance, swaps `_betAmount`, preserves all other fields (verified in `match-date.ts` L124–136 + 3 unit tests). |
| `PropagateBetAmountUseCase.execute(adminId, betAmount)` | ✅ Implemented | UoW pattern per `AdjustBalanceUseCase`; `findOpenMatchDates()` once; per-date `findMatchDateByIdForUpdate` → `countByMatchDateId` → `withBetAmount` + `updateMatchDate` or `blockedDates`; two audit rows via `AuditLog.new` + `AuditLogRepo.save`. |
| Route wiring `PATCH /api/admin/config` | ✅ Implemented | Config leg first, propagation leg only for `defaultBetAmount`; reply `{config, updatedDates, blockedDates}`; empty arrays for other keys; `PropagateBetAmountUseCase` instantiated in `createAdminRoutes` with all ports + `uow`. |
| `betAmount` in admin DTO | ✅ Implemented | `TournamentDateDTO.betAmount` server (cents from `dateSnap.betAmount`) and client. |
| Client `ConfigUpdateResult` / `DatePropagationResult` | ✅ Implemented | `updateConfig` returns full body; `DatePropagationResult = {id, dateNumber, betAmount}` (client + server entry type). |
| `use-update-config` invalidation | ✅ Implemented | Invalidates `['admin','config']` + `['admin','tournaments']`. |
| ConfigPanel grouped UI | ✅ Implemented | Green box (default line + per updated date), red box per blocked date; rendered only when `variables.key === 'defaultBetAmount'`; exact Rioplatense copy; `formatPesos` cents → `$5,00`. |
| MatchEditor header amount | ✅ Implemented | `Fecha {n} · $X,XX` next to status icons (admin-only view). |
| `UpdateConfigUseCase` untouched | ✅ Implemented | Git history shows last change to `update-config-use-case.ts` predates this change; all 26 `admin-use-cases.test.ts` tests still green. |

## Coherence (Design Decisions)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 — New `PropagateBetAmountUseCase`, don't extend `UpdateConfigUseCase` | ✅ Yes | Confirmed; `UpdateConfigUseCase` byte-identical. |
| D2 — Config leg outside UoW, propagation leg inside; route composes | ✅ Yes | Route order verified; propagation (date updates + both audit rows) atomic inside `uow.withTransaction`. |
| D3 — `MatchDate.withBetAmount` mirrors `withPozo` | ✅ Yes | Verified in code + tests. |
| D4 — No repo changes; `findOpenMatchDates()` selects all `status='open'` (no active-join) | ✅ Yes | `drizzle-tournament-repo.ts:165` unchanged; "active tournaments" satisfied by construction (no deactivation flow). |
| D5 — Response `{ config, updatedDates, blockedDates }` with `updatedDates: {id, dateNumber, betAmount}` | ✅ Yes | Shape present; both `updatedDates` and `blockedDates` entries carry `{id, dateNumber, betAmount}` (updated → new cents, blocked → current cents) since `bae8ba2`. |
| D6 — Audit: two rows (`default_bet_amount_update` + `default_bet_amount_propagation`) with JSON reason | ✅ Yes | Both rows, both with JWT admin id, reason `null` vs JSON with both keys always present. |
| D7 — Admin date DTO gains `betAmount` | ✅ Yes | Server + client DTOs. |
| D8 — Client: widened `updateConfig`, dual invalidation, grouped UI inline, default line always, MatchEditor amount | ✅ Yes | All verified; `useUpdateConfig` consumed only by ConfigPanel (design's contract-risk note holds). |

## Deviation Assessment (D5 / admin-operations updatedDates shape)

**Committed `PropagateBetAmountResult.updatedDates` uses `{ id, dateNumber }`; design D5 and the admin-operations spec require `{ id, dateNumber, betAmount }`.**

Verdict: **WARNING** (not CRITICAL). Reasoning:
- **No consumer needs `betAmount`**: `ConfigPanel` uses only `d.dateNumber` (copy) and `d.id` (React key); the grep of `updateConfig` consumers confirms ConfigPanel is the only one.
- **No information is lost**: the value is always the just-persisted `config.defaultBetAmount` — trivially derivable client-side; the amount also lives in both audit rows.
- **It IS a contract under-delivery vs the written spec**: the scenario "Default bet amount propagates to ticket-free open dates" asserts `updatedDates` lists dates "with id, dateNumber, and betAmount", and the covering test was written to match the implementation (asserts `{id, dateNumber}`), so the spec letter is not proven.
- **Fix is trivial**: add `betAmount: locked.betAmount.cents` to the entry (1 line) + update 3 unit/integration assertions; or amend the spec to `{id, dateNumber}` for `updatedDates` (matching the `blockedDates` shape). No migration, no breaking change either way.

**RESOLVED by commit `bae8ba2`** — the user chose to ADD the field to the implementation rather than amend the spec. The specs are authoritative for requirements; the admin-operations spec text mandates `{ id, dateNumber, betAmount }` for `updatedDates`, and the code now matches it exactly (updated → `betAmount.cents`, i.e., the new amount). For `blockedDates`, the spec text lists `{ id, dateNumber }`; the code additionally ships `betAmount` (current, unchanged cents) there as well — an additive superset that satisfies the spec's required fields and breaks nothing (see Re-verification section).

## Race Condition (user-demanded mitigation)

**CONFIRMED** — the propagation use case locks the row before counting tickets, inside the UoW transaction:
- `uow.withTransaction(...)` wraps the whole propagation leg (`propagate-bet-amount-use-case.ts` L50–53);
- per date: `tournamentRepo.findMatchDateByIdForUpdate(date.id)` (L81) runs BEFORE `ticketRepo.countByMatchDateId(locked.id)` (L87);
- a concurrent bet INSERT on the same date must serialize after this transaction's lock, so a ticket placed mid-propagation is either counted (date blocked) or its INSERT waits until the amount update commits — at-most-once propagation holds.
- Guard for a date deleted between list and lock: `if (!locked) continue` (L82–85).

## Re-verification after fix (commit `bae8ba2`)

**Trigger**: the previous verify flagged WARNING — propagation result entries lacked the spec-mandated `betAmount`. The user chose to ADD the field to the implementation instead of amending the spec. Re-verified on 2026-08-02.

### Deviation resolution — CONFIRMED RESOLVED

| Layer | Before (`8f1021f`) | After (`bae8ba2`) |
|---|---|---|
| `server/src/application/admin/propagate-bet-amount-use-case.ts` | `PropagateBetAmountResultEntry = {id, dateNumber}` | `{id, dateNumber, betAmount}` — updated → `betAmount.cents` (new amount), blocked → `locked.betAmount.cents` (current, unchanged amount) |
| `client/src/api/admin-api.ts` | `DatePropagationResult = {id, dateNumber}` | `DatePropagationResult` gains `betAmount` (cents) — shared by `updatedDates` and `blockedDates` in `ConfigUpdateResult` |
| Tests | asserted `{id, dateNumber}` | UC unit tests, route integration tests, and ConfigPanel tests all assert `betAmount` (e.g. `{id:46, dateNumber:46, betAmount:500}` updated, `{id:45, dateNumber:45, betAmount:1500}` blocked) |

**Source of truth resolution**: the SPECS are authoritative for requirements. The admin-operations spec mandates `updatedDates: {id, dateNumber, betAmount}` — now satisfied exactly. For `blockedDates` the spec lists `{id, dateNumber}`; the code ships `{id, dateNumber, betAmount}` as an additive superset (the blocked amount is the pre-existing value, always the current config for untouched dates). This satisfies the spec's required fields and breaks no consumer — `ConfigPanel` reads `id`/`dateNumber` only. No spec amendment needed.

### Re-run evidence (2026-08-02)

| Gate | Result |
|---|---|
| `cd server && pnpm test` | ✅ **242/242 passed** (25 files) |
| `cd client && pnpm test` | ✅ **109/109 passed** (11 files) |
| `cd server && pnpm lint` (`tsc --noEmit`) | ✅ EXIT 0 |
| `cd client && npx tsc --noEmit` | ✅ EXIT 0 |
| Task completion | ✅ 11/11 `[x]` |
| Race mitigation (lock before count in UoW) | ✅ Intact — `findMatchDateByIdForUpdate` (L83) precedes `countByMatchDateId` (L89) inside `uow.withTransaction` (L53); `if (!locked) continue` guard (L84–87) |

Commit `bae8ba2` is a clean, additive 5-file change (UC + client DTO + 3 test files, +33/−23) — no unintended edits, no migration, `UpdateConfigUseCase` untouched.

## Issues Found

**CRITICAL**: None.

**WARNING**: None — the single `updatedDates` `betAmount` omission was resolved by commit `bae8ba2` (field added to both result arrays; see Deviation Assessment + Re-verification section).

**SUGGESTION**:
1. The admin-operations "Partidos Date Accordion" requirement text mentions a "$" icon for 'results' dates, but the UI renders `✅` (introduced in commit `e6dc346`, before this change). Pre-existing spec wording drift, out of this delta's scope — flag for a future spec cleanup rather than code change.
2. Design test plan listed an optional `client/src/api/__tests__/admin-api.test.ts`; the design's own fallback ("ConfigPanel tests + TS typing cover the contract") was used. No action needed.
3. Design D4 open item (tournament deactivation flow would require filtering `findOpenMatchDates()` by `isActive`) remains valid and is worth a note in the archived spec.

## Verdict

**PASS** — **READY TO ARCHIVE** (no blockers, no warnings).

All 11 tasks complete; both suites green after the fix (server 242/242, client 109/109); both `tsc --noEmit` gates pass; all 7 spec requirements are fully compliant with every scenario covered by a passing test, including the `betAmount` field in propagation results (updated → new cents, blocked → current cents); the race mitigation (lock-before-count inside UoW) is confirmed in code. The previous deviation is resolved by adding the field per the user's choice; specs remain authoritative and are now satisfied.

## Open Items

- [x] Resolve the `updatedDates` `betAmount` deviation — DONE via commit `bae8ba2` (field added to implementation; no spec amendment needed since code now satisfies the authoritative spec text).
- [ ] (Informational) "$" vs `✅` icon wording drift in admin-operations spec — pre-existing, outside delta.
- [ ] (Informational) D4 future guard: filter `findOpenMatchDates()` by tournament `isActive` if a deactivation flow ever lands.
