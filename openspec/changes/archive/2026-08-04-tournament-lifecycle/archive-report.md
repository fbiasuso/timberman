# Archive Report: Tournament Lifecycle

**Change**: tournament-lifecycle
**Archived at**: 2026-08-04
**Archived to**: `openspec/changes/archive/2026-08-04-tournament-lifecycle/`
**Verified at**: main @ `cb80b54` (PRs #24 `abd8ea8`, #25 `82a6caa`, #26 `146e344`, #27 `fd138cd`, #28 `cb80b54`)

## Summary

SDD cycle complete: proposal → spec → design → tasks → apply → verify → archive. All 21/21 tasks complete across 5 chained PRs (#24–#28), verification PASS per slice (S1 CHANGES-REQUIRED resolved → shipped; S2 APPROVED; S3 PASS; S4/S5 APPROVED with non-blocking warnings; no CRITICAL issues anywhere), final full suite green (server 316/316, client 128/128, both `tsc --noEmit` gates exit 0, both `pnpm build` clean). The change's 6 delta specs were synced into the baseline (`openspec/specs/`), the proposal's 4 Success Criteria checkboxes were flipped to `[x]` at archive time (per S5 verify SUGGESTION), and the change folder was moved to the archive as an audit trail. No source code was touched during archive — specs/artifacts only.

## Artifacts Synced (delta → baseline)

| Domain | Action | Details |
|--------|--------|---------|
| `tournament-management` | Updated | +3 ADDED requirements appended: Tournament Status Model (status enum replaces `isActive`, boot auto-create "Torneo 1", legacy migration mapping; 3 scenarios), Terminate Tournament (active→finished, winners from persisted max points > 0, 409 on open date, prize stub; 4 scenarios), Archive Tournament (finished→archived, auto-create "Torneo N+1" carryover 0 editable name, frozen carryover, non-finished rejected; 4 scenarios). 5 MODIFIED requirements replaced (delta `(Previously: ...)` annotations dropped as change metadata): Create Tournament Date (+status guard, +Reject on non-active tournament scenario), Date Lifecycle (points computed AND persisted in `tournament_points` at publish), Set Match Results (results never award points; scenario renamed Results update does not award points), Start New Tournament (status 'active' carryover 0 + auto-create on archive), Match Creation (+non-active tournament rejection scenario). All other requirements preserved. |
| `ranking-calculation` | Updated | 1 RENAMED: Global Ranking → Tournament Ranking (Reason: ranking is now per-tournament over persisted points; Migration: tests/docs referencing global leaderboard target per-tournament ranking). 4 MODIFIED requirements replaced: Tournament Ranking (tournamentId param, active default, empty list when none, shared ranks, no ticket-count tie-break), Per-Tournament Breakdown (persisted reads, client sends tournamentId), Points Calculation (persisted only at publish; +Open date results award nothing scenario), Historical Ranking (persisted rows never change, archived queryable by id, Histórico UI out of scope). +1 ADDED appended: Persisted Points Reads (2 scenarios). All other requirements preserved. |
| `prize-payouts` | Updated | +2 ADDED requirements appended: Points Awarded Only on Paid Dates (one `tournament_points` row per user+tournament+date at publish; 2 scenarios), Terminate Winner Determination (max-points ties all win, max>0 only, prize stub; 4 scenarios). No MODIFIED/REMOVED. All other requirements preserved. |
| `admin-operations` | Updated | +3 ADDED requirements appended: Terminate Tournament Route (POST /terminate, 409 on open date, no prize payment, 403 non-admin; 3 scenarios), Archive Tournament Route (POST /archive, finished-only, auto-create next; 3 scenarios), Tournament Lifecycle UI (status labels, Terminar/Archivar buttons by status, `['admin','tournaments']` invalidation; 3 scenarios). 3 MODIFIED requirements replaced: Match Results Entry (ACTIVE tournament only, +Non-active tournament dates hidden scenario), System Configuration (propagation targets ACTIVE tournament only; scenario renamed + finished-tournament date neither updated nor blocked), Partidos Date Accordion (ACTIVE tournament only, "Nueva fecha" button; scenario renamed Accordion lists active tournament dates only). All other requirements preserved. |
| `system-config` | Updated | 1 MODIFIED requirement replaced: Default Bet Amount in Cents (propagates to ACTIVE tournament's open ticket-free dates only; non-active dates neither updated nor blocked; scenario renamed + Non-active tournament dates untouched scenario). All other requirements preserved. |
| `date-history` | Updated | 1 MODIFIED requirement replaced: Cartelera Fechas Anteriores Section (lists ONLY the ACTIVE tournament's dates; +Only active tournament dates listed scenario). All other requirements preserved. |

Resulting baseline files:
- `openspec/specs/tournament-management/spec.md` (13 requirements)
- `openspec/specs/ranking-calculation/spec.md` (5 requirements)
- `openspec/specs/prize-payouts/spec.md` (8 requirements)
- `openspec/specs/admin-operations/spec.md` (14 requirements)
- `openspec/specs/system-config/spec.md` (4 requirements)
- `openspec/specs/date-history/spec.md` (3 requirements)

## Verification State

Verification ran per-slice (fresh-context adversarial, before each chained PR shipped); final suite green at main @ `cb80b54`. No CRITICAL issues at any point; final verdict: PASS (slice warnings non-blocking).

- Tasks: 21/21 `[x]` confirmed in `tasks.md` before sync (zero unchecked).
- Tests: server 316/316 (28 files), client 128/128 (12 files); both `tsc --noEmit` gates exit 0; both `pnpm build` clean.
- Slice history: S1 CHANGES-REQUIRED (missing guard tests) → tests added, shipped as PR #24; S2 APPROVED (279/279 server); S3 PASS (291 server + 116 client); S4 APPROVED with warnings; S5 APPROVED with warnings.
- Warnings (non-blocking, no spec amendment needed):
  1. S4: spec scenarios "Non-active tournament dates hidden" (ResultsEntry) and "Accordion lists active tournament dates only" (MatchEditor) lack direct client tests — fixtures all use status 'active'; behavior verified by inspection.
  2. S5: boot guard is check-then-act (`findAll() === []` → save) with no unique constraint on `tournaments.name`; a concurrent cold-start of 2+ instances on an empty DB could double-insert "Torneo 1". Sequential restarts (the spec scenario) are safe.
  3. S4 minor: design.md interface `finish(winnerUserIds)` vs entity `finish()` no-arg (winners via saveWinners, per D1) — doc drift only.
- Proposal Success Criteria: all 4 checkboxes flipped to `[x]` (S5 verify SUGGESTION: "check at archive time"). Demonstrably met: terminate 409/archive 422 flows + next-tournament creation (T16–T19 tests), persisted points on paid dates + backfill (T6/T8/T12/T13 tests), boot "Torneo 1" + non-active creation guards (T9/T20 tests), full suites green (316/316 server, 128/128 client).

## Design Updates Made

- **D1–D7 decisions held** through implementation; no design revision needed during apply.
- **D4 errors** (`TournamentOpenDateError` 409, `TournamentNotActiveError` 422, `TournamentNotFinishedError` 422) mapped automatically by error-handler via `statusCode`.
- **D2** single `TournamentPointsRepo` port (savePoints, findByTournamentId, findByUserAndTournament, saveWinners, findWinnersByTournamentId) — wired into TransactionRepos/UoW in S1 (T5), one ripple point as designed.
- **S2 discovery** (recorded in Engram): `PublishResultsUseCase` constructor gained a REQUIRED `tournamentPointsRepo` param, forcing the points-repo wiring into `createAdminRoutes`/`createRouter`/`index.ts` early in S2 (T8) rather than the design's deferred S4 T18 — a timing deviation, not a design change.
- **Backfill** (D7): `server/scripts/backfill-tournament-points.ts`, idempotent via `onConflictDoNothing`, matches PointsCalculator output — validated on seeded data.
- **Informational open items carried forward** (no action needed for this change):
  1. Boot double-insert race under concurrent cold-start (S5 warning #2) — candidate for a future unique constraint or locked boot guard.
  2. Create-date uses a non-locking `findById` (pre-existing S2) → theoretical open-date race with terminate, low severity.

## Tasks Final State

- 21/21 implementation tasks complete (Phases 1–5: S1 data foundation T1–T7, S2 write path T8–T11, S3 read path T12–T15, S4 lifecycle T16–T19, S5 boot + polish T20–T21), verified per slice.
- Archived `tasks.md` shows no unchecked implementation tasks.

## Final State

- Baseline specs reflect all new behavior: three-state tournament status with boot "Torneo 1", terminate/archive lifecycle (winners persisted, next tournament auto-created), persisted `tournament_points` read by per-tournament ranking, active-only guards on date/match creation, propagation and date-history scoped to the active tournament, and the TournamentManager admin UI.
- Proposal Success Criteria checkboxes flipped `[ ]` → `[x]` in the archived proposal.
- Change folder archived in full: `proposal.md`, `specs/` (6 domains), `design.md`, `tasks.md`, `archive-report.md`. (No `verify-report.md` — verification ran per-slice via fresh-context adversarial reports; summaries recorded in Engram observations #668, #674, #675.)
- `openspec/config.yaml` `archive:` section updated with `tournament-lifecycle` entry (archived_at 2026-08-04, status complete, 444 tests, 5 PRs).
- No code, spec semantics, or schema were modified during archive — documentation/artifacts only.

## Next Recommended

**none** — SDD cycle complete. Ready for the next change.
