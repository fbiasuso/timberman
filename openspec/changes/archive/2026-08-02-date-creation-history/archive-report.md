# Archive Report: Date Creation & History

**Change**: date-creation-history
**Archived at**: 2026-08-02
**Archived to**: `openspec/changes/archive/2026-08-02-date-creation-history/`
**Verified at**: main @ `6403102` (PRs #10–#16 + post-delivery PR #18 merged)

## Summary

SDD cycle complete: proposal → spec → design → tasks → apply → verify → archive. All 23/23 tasks complete, verification PASS (230 server + 100 client tests, both builds exit 0, 0 migrations, 17/17 spec scenarios compliant). The change's delta specs were synced into the baseline (`openspec/specs/`), design.md open questions were closed, post-delivery fixes from PR #18 were recorded as design notes, and the change folder was moved to the archive as an audit trail.

## Artifacts Synced (delta → baseline)

| Domain | Action | Details |
|--------|--------|---------|
| `admin-operations` | Updated | +2 ADDED requirements appended to main spec: Partidos Date Accordion, Open Date Match Editing (5 scenarios total). No other requirements touched. |
| `tournament-management` | Updated | 1 MODIFIED requirement replaced in main spec (Create Tournament Date → POST `/api/admin/dates`, auto dateNumber max+1, open-guard 409, config betAmount; delta `(Previously: ...)` annotation dropped as change metadata); +2 ADDED requirements appended: Match Creation, Match Details Editing (6 scenarios). All other requirements preserved. |
| `date-history` | Created | New domain — delta spec was a full spec (Purpose + Requirements), copied verbatim to `openspec/specs/date-history/spec.md` (3 requirements: Date History Endpoint, Results Sanitization by Date Status, Cartelera Fechas Anteriores Section). |

Resulting baseline files:
- `openspec/specs/admin-operations/spec.md`
- `openspec/specs/tournament-management/spec.md`
- `openspec/specs/date-history/spec.md`

## Design Updates Made

- **Open Questions closed** (design.md):
  - OQ1 (create-date body shape) → **RESOLVED: `{ tournamentId }`** — design assumption confirmed by implementation (zod `createDateSchema`, `api.test.ts`).
  - OQ2 (HistorySection tournament scope) → **RESOLVED: all non-open dates across tournaments, sorted chronologically** — the design's fallback option was implemented (`HistorySection.tsx`).
- **Post-Delivery Notes & Deviations** added to design.md (PR #18, commit `6403102`, code fixes with no spec behavior change):
  - N1: audit/tournament repo `id: 0` sentinel strip on insert (root cause of close-date 500 on second insert).
  - N2: ConfigPanel bet amount in pesos (cents ÷ 100).
  - N3: HistorySection centered "L/E/V" score layout + user's own bet badge.
  - N4: MatchEditor date order (open first, then descending).
  - N5: CarteleraPage already-bet lock flow ("ya hiciste tu jugada - ver ticket").
  - N6: line forecast undershoot (~1,640 Δ forecast vs 3,859+/202− actual) — forecast-only.
- D9 (dedicated `HistoryMatchRow` instead of `MatchCard` + `showResults`) was already recorded in the Architecture Decisions table; noted again in the deviations section.

## Tasks Final State

- 23/23 implementation tasks complete (Phases 1–7), verified by `verify-report.md` (PASS).
- Phase 8 (Archive) task 8.1 added and checked in `tasks.md` — archived tasks artifact shows no unchecked implementation tasks.

## Issue Tracker

- GitHub issue **#9** — reopened on each merge during the chained PR delivery; to be **closed after this archive step** (orchestrator/human action, outside this phase's scope).

## Final State

- Baseline specs reflect all new behavior; `date-history` exists as a new capability domain.
- Change folder archived in full: `proposal.md`, `specs/` (3 domains), `design.md`, `tasks.md`, `verify-report.md`, `archive-report.md`.
- `openspec/config.yaml` `archive:` section updated with `date-creation-history` entry (archived_at 2026-08-02, status complete, 330 tests, 8 PRs).
- No code, spec semantics, or schema were modified during archive — documentation/artifacts only.

## Next Recommended

**none** — SDD cycle complete. Close GitHub issue #9. Ready for the next change.
