# Tasks: Tournament Lifecycle

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2,100 (S1 ~500 · S2 ~230 · S3 ~350 · S4 ~950 · S5 ~40) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Delivery strategy | ask-always (C1) |
| Chain strategy | pending |
| Suggested split | 5 chained PRs mirroring design slices S1→S5 |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Base | Notes |
|------|------|-----------|------|-------|
| 1 | S1 Data foundation | PR 1 | main | Schema+migration+entity+points repo+fixtures (~500; largest server slice) |
| 2 | S2 Write path | PR 2 | main | Publish persistence, creation guards, propagation + match-route scoping |
| 3 | S3 Read path | PR 3 | main | Persisted ranking, GET /api/tournaments, RankingPage selector |
| 4 | S4 Lifecycle | PR 4 | main | Terminate/Archive UCs+routes, DTOs, TournamentManager UI (~950; split server/client if needed) |
| 5 | S5 Boot + polish | PR 5 | main | Boot "Torneo 1" + full suite/lint/build green |

## Phase 1: Data Foundation (S1)

- [x] **T1** (S1) `server/src/infrastructure/db/schema.ts` + `server/drizzle/0002_*.sql` — tournaments status/finishedAt, drop isActive, tournamentWinners+tournamentPoints tables, hand-edit DDL. AC: repo status mapping tests. Deps: none
- [x] **T2** (S1) `server/src/domain/entities/tournament.ts` + `errors/index.ts` — TournamentStatus, snapshot status/finishedAt, finish()/archive() guards, remove activate/deactivate, add D4 errors. AC: domain tests. Deps: T1
- [x] **T3** (S1) `server/src/domain/ports/tournament-repo.ts` (findOpenMatchDates filter) + new `tournament-points-repo.ts` (D2). AC: tsc passes. Deps: none
- [x] **T4** (S1) `drizzle-tournament-repo.ts` status mapping/filter/findActive + new `drizzle-tournament-points-repo.ts`. AC: repo tests green. Deps: T1,T3
- [x] **T5** (S1) `ports/unit-of-work.ts` + `persistence/drizzle-unit-of-work.ts` + `server/src/index.ts` — TransactionRepos += tournamentPointsRepo; factory + index wiring. AC: UoW test; server boots. Deps: T4
- [x] **T6** (S1) new `server/scripts/backfill-tournament-points.ts` — idempotent PointsCalculator backfill for 'results' dates. AC: re-runnable; matches calculator. Deps: T4
- [x] **T7** (S1) seeds `seed-dev.ts`/`seed-from-json.ts` (status:'active') + fixtures isActive→status (tournament.test.ts, api.test.ts, drizzle-unit-of-work.test.ts, drizzle-tournament-repo.test.ts, MatchEditor/ResultsEntry tests) + new points-repo test. AC: full suite green. Deps: T2,T4

## Phase 2: Write Path (S2)

- [ ] **T8** (S2) `application/tournament/publish-results-use-case.ts` — pick += tournamentPointsRepo; savePoints per ticket owner (incl. 0) after step 6. AC: txn row-per-owner test. Deps: T5
- [ ] **T9** (S2) `create-date-use-case.ts` + `create-match-use-case.ts` — non-active → TournamentNotActiveError guards. AC: UC tests. Deps: T2
- [ ] **T10** (S2) `application/admin/propagate-bet-amount-use-case.ts` — findActive() resolve; no active → skip loop (audit kept); else findOpenMatchDates(active.id). AC: finished-tournament dates untouched. Deps: T4
- [ ] **T11** (S2) `http/routes/match-routes.ts` — /matches/current + /matches/dates resolve findActive() first, scope queries. AC: api.test scoped dates. Deps: T4

## Phase 3: Read Path (S3)

- [ ] **T12** (S3) `application/ranking/get-ranking-use-case.ts` — deps (userRepo, tournamentRepo, tournamentPointsRepo); active default, [] if none; aggregate persisted rows. AC: no ticket calls; ties; empty tests. Deps: T5
- [ ] **T13** (S3) `application/ranking/get-user-detail-use-case.ts` — execute(userId, tournamentId?); findByUserAndTournament; paid-date totals. AC: per-tournament test. Deps: T5
- [ ] **T14** (S3) `http/routes/ranking-routes.ts` + new `tournament-routes.ts` + `router.ts` — pass query.tournamentId to UCs; GET /api/tournaments (auth). AC: api.test 200/401. Deps: T12,T13
- [ ] **T15** (S3) client — new `hooks/use-tournaments.ts`; `api/ranking-api.ts` getUserDetail(tournamentId?); RankingPage selector + "activo" badge + useRanking/useUserDetail. AC: RankingPage.test. Deps: T14

## Phase 4: Lifecycle (S4)

- [ ] **T16** (S4) new `application/admin/terminate-tournament-use-case.ts` — UoW lock; active guard; open-date 409; winners max>0; finish(); saveWinners; audit; DTO. AC: lifecycle UC tests. Deps: T2,T6
- [ ] **T17** (S4) new `application/admin/archive-tournament-use-case.ts` — finished guard; archive(); create "Torneo N+1" (carryover 0, config commission); audit; DTO. AC: lifecycle UC tests. Deps: T16
- [ ] **T18** (S4) `http/routes/admin-routes.ts` (points repo param, POST /terminate /archive) + ListTournaments/CreateTournament DTOs (status, finishedAt, tournamentWinners). AC: admin UC + api.test 200/409/422/403. Deps: T16,T17
- [ ] **T19** (S4) client — `api/admin-api.ts` DTO + terminate/archive fns; `hooks/use-admin.ts` hooks + invalidation; new `TournamentManager.tsx`; AdminPage `torneos` tab; MatchEditor/ResultsEntry active-only. AC: TournamentManager.test + extended tests. Deps: T18

## Phase 5: Boot + Polish (S5)

- [ ] **T20** (S5) `server/src/index.ts` — boot auto-create "Torneo 1" (findAll()===[] → save). AC: boot test; no duplicate when exists. Deps: T2,T5
- [ ] **T21** (S5) Polish — verify HistorySection/TicketsPage via scoped /matches/dates (D5); full suite + lint + build green. AC: all green. Deps: T1–T20
