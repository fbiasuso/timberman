# Archive Report: Bet Amount Propagation

**Change**: bet-amount-propagation
**Archived at**: 2026-08-02
**Archived to**: `openspec/changes/archive/2026-08-02-bet-amount-propagation/`
**Verified at**: main @ `69ee9ea` (commits `a5e100e`, `8f1021f`, `bae8ba2`, `69ee9ea`)

## Summary

SDD cycle complete: proposal → spec → design → tasks → apply → verify → archive. All 11/11 tasks complete, verification PASS (server 242/242, client 109/109, both `tsc --noEmit` gates exit 0, 0 migrations, 7/7 spec requirements fully compliant). The change's delta specs were synced into the baseline (`openspec/specs/`), the design's open questions and race-condition mitigation were resolved during verification, and the change folder was moved to the archive as an audit trail. No source code was touched during archive — specs/artifacts only.

## Artifacts Synced (delta → baseline)

| Domain | Action | Details |
|--------|--------|---------|
| `admin-operations` | Updated | 2 MODIFIED requirements replaced in main spec (System Configuration → propagation semantics, response shape `{ config, updatedDates, blockedDates }`, ticketed dates blocked-never-thrown; Partidos Date Accordion → `betAmount` in header + `TournamentDateDTO`), delta `(Previously: ...)` annotations dropped as change metadata. +2 ADDED requirements appended: Propagation Results Feedback (3 scenarios, exact Rioplatense copy, default line always, tournaments invalidation), Propagation Audit Trail (2 scenarios, two rows, JSON reason with both keys). All other requirements preserved. |
| `system-config` | Updated | 2 MODIFIED requirements replaced in main spec (Config Update Persists → config row persists regardless of propagation outcome; Default Bet Amount in Cents → propagate to open ticket-free dates, ticketed keep old amount), delta `(Previously: ...)` annotations dropped. All other requirements preserved. |
| `tournament-management` | Updated | +1 ADDED requirement appended: Bet Amount Propagation Boundary (2 scenarios — propagation only on config-default change, never on date creation). All other requirements preserved. |

Resulting baseline files:
- `openspec/specs/admin-operations/spec.md`
- `openspec/specs/system-config/spec.md`
- `openspec/specs/tournament-management/spec.md`

## Verification State

`verify-report.md` verdict: **PASS — READY TO ARCHIVE** (no blockers, no warnings).

- Tasks: 11/11 `[x]` confirmed in `tasks.md` before sync.
- Tests: server 242/242 (25 files), client 109/109 (11 files); both `tsc --noEmit` gates exit 0.
- Spec compliance: 7/7 requirements PASS, 0 PARTIAL.
- The single WARNING (deviation: `PropagateBetAmountResult.updatedDates` lacked spec-mandated `betAmount`) was **resolved by commit `bae8ba2`** — the field was added to implementation (updated → new cents, blocked → current cents as an additive superset) so the authoritative spec text now holds exactly; no spec amendment needed.
- Race-condition mitigation (user-demanded): `findMatchDateByIdForUpdate` locks each date row before `countByMatchDateId`, inside the `uow.withTransaction` — confirmed intact in code.

## Design Updates Made

- **Open question closed** (design.md, per D1): UI copy references dates by `dateNumber` ("fecha N"); audit + programmatic use use date `id`.
- **D-Risks resolved during implementation**:
  - Race between count and update: mitigated with per-date row lock (`findMatchDateByIdForUpdate`) before ticket count, inside the UoW transaction; `if (!locked) continue` guard for dates deleted between list and lock.
- **Informational open items carried forward** (no action needed for this change):
  1. Pre-existing spec wording drift: "Partidos Date Accordion" requirement text says "$" icon for 'results' dates but UI renders `✅` (introduced in commit `e6dc346`, before this change) — candidate for a future spec cleanup.
  2. Design D4 future guard: if a tournament deactivation flow ever lands, `findOpenMatchDates()` must be filtered by tournament `isActive` (currently satisfied by construction — no deactivation flow exists).

## Tasks Final State

- 11/11 implementation tasks complete (Phases 1–4), verified by `verify-report.md` (PASS).
- Archived `tasks.md` shows no unchecked implementation tasks.

## Final State

- Baseline specs reflect all new behavior: `betAmount` propagation to open ticket-free dates, response shape `{ config, updatedDates, blockedDates }`, grouped green/red UI feedback with exact Spanish copy, two-row audit trail, and admin DTO `betAmount`.
- Change folder archived in full: `proposal.md`, `specs/` (3 domains), `design.md`, `tasks.md`, `verify-report.md`, `archive-report.md`.
- `openspec/config.yaml` `archive:` section updated with `bet-amount-propagation` entry (archived_at 2026-08-02, status complete, 351 tests, 0 PRs — delivered as direct commits on `main`).
- No code, spec semantics, or schema were modified during archive — documentation/artifacts only.

## Next Recommended

**none** — SDD cycle complete. Ready for the next change.
