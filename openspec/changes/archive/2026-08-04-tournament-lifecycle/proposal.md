# Proposal: Tournament Lifecycle

## Intent

Give tournaments a real lifecycle: terminate freezes a finished tournament and persists winners; archive hides it and auto-creates the next one. Points are awarded ONLY when a date is paid (publish-results), persisted per user+tournament+date; ranking becomes per-tournament instead of global on-the-fly recompute.

## Problem / Context

- No lifecycle: `isActive` boolean (27 refs; dead `activate()`/`deactivate()`/`findActive()`), no status model, no boot creation of "Torneo 1".
- Points count before payment: publish computes but never persists; ranking/GetUserDetail recompute from ALL tickets — points appear once a match result is set, even on open dates.
- Ranking global only (client never sends tournamentId); spec's "fewer bets" tie-break is pre-existing drift the impl ignores.
- Propagation + HistorySection span all tournaments; no guards against date/match creation on finished tournaments.
- Existing 'results' dates have no persisted points — backfill required.

## Scope

### In Scope
- Terminate: status 'finished', winners = max-points users, persisted; 409 while an open date exists; prize payment stubbed (no balance/prize changes).
- Archive: only on 'finished'; hidden from active flow; auto-creates next tournament (name "Torneo N+1", carryover 0, active, admin-editable).
- Boot: auto-create "Torneo 1" when none exists.
- Points: persist per user+tournament+date at publish; ranking/GetUserDetail read persisted rows, per-tournament (client sends tournamentId; default = active).
- Guards: date/match creation blocked on non-'active' tournaments; propagation + HistorySection scoped to active tournament.
- Migration: status column + winner storage + `tournament_points`; backfill points from existing 'results' dates; `is_active=true` → status 'active'.

### Out of Scope
Prize payment, "Histórico" section (all tournaments + dropdowns), multiple tickets per date, ticket-count tie-break.

## Assumptions

- Ties ⇒ ALL tied users become winners (one ticket/user/date ⇒ ticket-count tie-break moot; winners split future prize).
- Archived tournament's carryover stays frozen — never transferred to next tournament.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities (delta specs)
- `tournament-management` — status model, terminate/archive, boot creation, winner storage, creation guards.
- `ranking-calculation` — persisted points, per-tournament ranking, tie-break drift removed.
- `prize-payouts` — points awarded only on paid dates; terminate winner determination.
- `admin-operations` — terminate/archive endpoints + UI.
- `system-config` — propagation targets active tournament only.
- `date-history` — "Fechas anteriores" shows active tournament only.

## Approach

`tournaments.status` (active|finished|archived) replaces `isActive`; add winner(s)/`finished_at`. New `TournamentPointsRepo` port + Drizzle table; PublishResultsUseCase writes points after computing; GetRanking/GetUserDetail read persisted rows. `TerminateTournamentUseCase`/`ArchiveTournamentUseCase` (archive also creates next tournament) + admin routes. Boot hook seeds "Torneo 1". Backfill = custom SQL post-`drizzle-kit generate` (0001 precedent). Client: admin buttons, RankingPage tournament selector, HistorySection scoped query, MatchEditor targets active tournament.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| server/src/domain, ports, application/ | Modified | tournament entity/status, points repo port, terminate/archive use cases |
| server/src/infrastructure/db/schema.ts, drizzle/* | Modified | status + winner columns, tournament_points table |
| server/src/application/ranking/*, publish-results-use-case.ts | Modified | persisted points reads/writes |
| server/src/infrastructure/http/routes/admin-routes.ts, match-routes.ts | Modified | terminate/archive routes, scoped queries |
| client admin-api.ts, use-admin.ts, MatchEditor, ResultsEntry, RankingPage, HistorySection | Modified | buttons, selector, scoping |
| server/drizzle/000N | New | migration + backfill SQL |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Backfill wrong for historical points | Med | Validate vs PointsCalculator on seeded data |
| TransactionRepos/new port breaks test mocks | Med | Extend shared fixtures; run full suite |
| Seeds reference `isActive` column | High | Update seeds in same change |
| Propagation rescope silently shrinks updates | Low | Explicit delta in system-config spec + tests |
| Ranking tie-break drift removal surprises users | Med | Call out in spec; add integration tests |

## Rollback Plan

Status-only transitions, no money moved. Remove terminate/archive routes to disable. New columns/table are additive; backfill is one-way — restore from SQL backup if corrupt. Drop `tournament_points` reads to revert to on-the-fly ranking.

## Success Criteria

- [x] Terminate returns 409 on open date; archive accepts only 'finished'; archive creates next tournament.
- [x] Points persist only on paid dates; per-tournament ranking matches PointsCalculator output (incl. backfill).
- [x] Boot creates "Torneo 1"; date/match creation blocked on non-active tournaments.
- [x] Existing suites green; new use-case/route tests pass.
