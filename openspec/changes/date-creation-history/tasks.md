# Tasks: Date Creation & History

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,640 (26 files: 8 new, 18 modified) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1a → PR1b → PR2 → PR3 → PR4a → PR4b → PR5 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (design: each PR targets previous branch; confirm with user) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Domain `withDetails`, OpenDateExistsError, CreateMatch/UpdateMatchDetails use cases, sanitize + new unit tests | PR1a | ~265Δ; base main; no breaking deps |
| 2 | CreateDateUseCase wiring (auto dateNumber, open-guard, config betAmount) + existing-test updates | PR1b | ~180Δ; base main; signature change breaks tests — same PR |
| 3 | Server routes: admin-routes (3 mutations) + match-routes history + api.test.ts | PR2 | ~285Δ; depends on PR1a+1b |
| 4 | Client api + hooks + types (admin-api, match-api, use-admin, use-matches) | PR3 | ~140Δ; depends on PR2 (endpoint contract) |
| 5 | Admin accordion shell: MatchEditor rewrite + AddMatchForm + create flows + tests | PR4a | ~260Δ; depends on PR3 |
| 6 | MatchRow editable save (PATCH) + view-only + tests | PR4b | ~240Δ; same branch as PR4a |
| 7 | Cartelera: HistorySection + CarteleraPage + tests | PR5 | ~280Δ; depends on PR3 (history hook) |

## Phase 1: Server Core — Domain + New Use Cases (PR1a)

- [x] 1.1 `Match.withDetails(details)` immutable method in `server/src/domain/entities/match.ts` (pattern like `setResult`; null clears imgs/scheduledAt; NEVER touches result/score). AC: snapshot differs only in edited fields; result/score preserved. PR1a
- [x] 1.2 `OpenDateExistsError` (409, `OPEN_DATE_EXISTS`) in `server/src/domain/errors/index.ts`. AC: extends DomainError, status 409. PR1a
- [x] 1.3 Pure `sanitizeMatches(status, matches)` in new `server/src/application/tournament/sanitize-matches.ts`: status !== 'results' → result/score null. AC: closed→null, open→null, results→unchanged. PR1a
- [x] 1.4 `CreateMatchUseCase` in new `server/src/application/tournament/create-match-use-case.ts`: load date → guard open (`DateNotOpenError` 422) → `Match.new` → `repo.save`; `MatchDateNotFoundError` (404). AC: open creates+persists; closed/results→422; unknown date→404. PR1a
- [x] 1.5 `UpdateMatchDetailsUseCase` in new `server/src/application/tournament/update-match-details-use-case.ts`: load match (404) → load date → guard open (422) → `withDetails` → `repo.update`. AC: partial change only; empty body no-op; 404/422. PR1a
- [x] 1.6 Extend `server/src/domain/__tests__/match.test.ts` (withDetails merge, null-clear, immutability); new `server/src/application/__tests__/sanitize-matches.test.ts` (spec scenarios). AC: suites green. PR1a
- [x] 1.7 Extend `server/src/application/__tests__/tournament-use-cases.test.ts`: CreateMatch + UpdateMatchDetails suites (repo mocks). AC: guard/404 scenarios green. PR1a

## Phase 2: CreateDate Wiring (PR1b — signature change)

- [x] 2.1 Modify `create-date-use-case.ts`: input `{ tournamentId, betAmount? }`, auto `dateNumber = max+1`, reject when open date exists (OpenDateExistsError 409), ctor gains `SystemConfig` for default betAmount. AC: next-after-results → number 2 open pozo 0; open exists → 409; betAmount from config. PR1b
- [x] 2.2 Update existing CreateDate tests in `tournament-use-cases.test.ts` to new signature (auto/guard/config). AC: no broken tests — full suite green. PR1b

## Phase 3: Server Routes (PR2)

- [ ] 3.1 `admin-routes.ts`: `POST /api/admin/dates` (zod `{tournamentId}`), `POST /api/admin/matches` (createMatchSchema), `PATCH /api/admin/matches/:matchId` (updateMatchDetailsSchema `.partial()`) + error mapping (403/409/422/404). AC: 201/403/422/404/409 route tests. PR2
- [ ] 3.2 `match-routes.ts`: `GET /api/matches/dates/:dateId/history` auth-only (non-admin OK, 401 no token, 404 unknown) + `sanitizeMatches(status, ...)`. AC: closed→null, results→full via history. PR2
- [ ] 3.3 Extend `server/src/infrastructure/http/__tests__/api.test.ts`: all 4 endpoints + history sanitization. AC: api suite green. PR2

## Phase 4: Client API + Hooks (PR3)

- [ ] 4.1 `client/src/api/admin-api.ts`: `createDate`, `createMatch`, `updateMatchDetails` + payload interfaces; `match-api.ts`: `getHistory(dateId)` (DateMatchesResponse). AC: typed calls hit right endpoints. PR3
- [ ] 4.2 `client/src/types/index.ts`: `CreateMatchPayload`, `UpdateMatchDetailsPayload`. AC: compiles. PR3
- [ ] 4.3 `use-admin.ts`: `useCreateDate`/`useCreateMatch`/`useUpdateMatchDetails` (invalidate `['admin','tournaments']` + `['matches']`); `use-matches.ts`: `useMatchHistory(dateId?)`. AC: mutations invalidate both prefixes (matches byDate/history/dates/current). PR3

## Phase 5: Admin Accordion UI (PR4a shell + PR4b row)

- [ ] 5.1 Rewrite `MatchEditor.tsx` as accordion of ALL dates via `useAdminTournaments` (default-expand open date; lock icon closed, $ icon results; "Nueva fecha" → `useCreateDate`). AC: all dates listed with icons; Nueva fecha creates + refetches. PR4a
- [ ] 5.2 New `AddMatchForm.tsx` (open date only) → `useCreateMatch`; new match appears in expanded date. AC: form only on open date; POST on submit. PR4a
- [ ] 5.3 New `MatchRow.tsx`: editable fields + per-row save → `useUpdateMatchDetails` (open); view-only matches+results for closed/results, no edit/add controls. AC: PATCH only on open; closed renders read-only. PR4b
- [ ] 5.4 Tests `MatchEditor.test.tsx` (accordion, Nueva fecha, add match — PR4a) + `MatchRow.test.tsx` (save mutation, view-only — PR4b); closed view-only scenario in PR4b. AC: client suite green per PR. PR4a/PR4b

## Phase 6: Cartelera History UI (PR5)

- [ ] 6.1 New `HistorySection.tsx`: "Fechas anteriores" rows (Fecha N + lock/$ icons), expand → `useMatchHistory(dateId)` → read-only rows (closed: teams only, no results). AC: closed hides results; results shows full; expand fetches history. PR5
- [ ] 6.2 `CarteleraPage.tsx`: render `<HistorySection/>` below active content AND below no-cartelera branch. AC: both branches show section. PR5
- [ ] 6.3 Tests `HistorySection.test.tsx` (icons, expand, hidden results) + update `CarteleraPage.test.tsx` (both branches, mock useMatchHistory). AC: green. PR5

## Phase 7: Integration Verification (final)

- [ ] 7.1 Full server + client vitest suites + typecheck/build both apps; confirm no schema change. AC: 0 failures, 0 migrations. Final PR
