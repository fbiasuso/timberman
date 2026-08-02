# Design: Date Creation & History

## Technical Approach

Wire the orphaned `CreateDateUseCase` to `POST /api/admin/dates` (extending it with auto-increment + open-date guard per the tournament-management delta), add two new use cases (`CreateMatchUseCase`, `UpdateMatchDetailsUseCase`) + immutable `Match.withDetails()`, and add a sanitized public history route `GET /api/matches/dates/:dateId/history`. Client: rewrite `MatchEditor` as an all-dates accordion over `useAdminTournaments` with real saves, and add a "Fechas anteriores" `HistorySection` to `CarteleraPage` backed by a new `useMatchHistory` hook. No schema change.

## Architecture Decisions

| # | Decision | Choice | Alternatives | Rationale |
|---|----------|--------|--------------|-----------|
| D1 | Sanitization placement | Pure helper `sanitizeMatches(status, matches)` in new `server/src/application/tournament/sanitize-matches.ts` | Inline in route handler; full use case | Spec defines it as endpoint rule, not business logic. Pure function is trivially unit-testable and keeps route thin. Route stays the only consumer. |
| D2 | Route placement | History in `match-routes.ts` (auth-only); create date/match + PATCH details in `admin-routes.ts` (admin) | All in admin-routes | `/api/matches/*` is the user-facing namespace (auth-only precedent: `/current`, `/dates`); admin mutations belong with existing admin routes + middlewares. |
| D3 | Guard error reuse | `DateNotOpenError` (422) for match create/update guards — same as `place-bet-use-case.ts` guard precedent | New error class | Existing "not open" semantic, correct 422 per spec scenario. Avoids error-class proliferation. |
| D4 | Open-date-exists error | New `OpenDateExistsError` (409, `OPEN_DATE_EXISTS`) in `errors/index.ts` | Reuse 422 `DateNotOpenError` | Distinct state conflict (a date already open), not "this date not open". 409 matches `DuplicateBetError` conflict convention. |
| D5 | `CreateDateUseCase` change | Input `{ tournamentId, betAmount? }`; computes `dateNumber = max(existing)+1`, rejects if an open date exists, `betAmount` defaults to `config.defaultBetAmount` (constructor gains `SystemConfig`) | Pure wiring, route computes dateNumber | Spec (MODIFIED Create Tournament Date) requires auto-increment + one-open-round rule at system level, not route level. `betAmount?` kept as optional override (existing tests use it). |
| D6 | Match create/update DTOs | Each use case declares its own full `MatchDTO` (snapshot shape, `scheduledAt: Date \| null`); routes map to ISO via existing `toMatchDTO` pattern | Shared app-level mapper | Matches codebase convention (per-use-case DTOs, see `SetMatchResultUseCase`/`CreateDateUseCase`); routes already own string-ification. |
| D7 | Admin expanded dates | Admin uses existing `useMatchesByDate` (admin route → full data incl. results) for ALL date statuses | New admin hook | Admin needs raw results on closed dates (ResultsEntry precedent); no new endpoint needed. |
| D8 | User history fetch | New hook `useMatchHistory(dateId?)` → `matchApi.getHistory()` hitting `/history`; `useMatchesByDate` stays admin-only | Reuse `useMatchesByDate` | It hits the admin-only `/matches/dates/:dateId` — a non-admin would get 403. |
| D9 | History rows rendering | Dedicated read-only `HistoryMatchRow` inside `HistorySection` | Reuse `MatchCard` with `showResults` flag | `MatchCard` couples to `BetButtons` + bet-slip store; history is read-only (no betting). Deviation from proposal — noted. |
| D10 | Empty PATCH body | Allowed → no-op update (returns current match) | 400 reject | Spec silent; no-op is safe and keeps `.partial()` zod schema simple. |

## Data Flow

```
Create date (admin):  MatchEditor "Nueva fecha" → useCreateDate → POST /api/admin/dates
                      → CreateDateUseCase (max+1, open-guard, config betAmount) → repo.saveMatchDate
                      → invalidate ['admin','tournaments'] + ['matches'] → accordion refetch

Create match (admin): MatchEditor "Agregar partido" (open date expanded) → useCreateMatch
                      → POST /api/admin/matches → CreateMatchUseCase (open-guard) → repo.save
                      → invalidate ['matches'] → expanded date refetch

Edit details (admin): MatchRow field save → useUpdateMatchDetails → PATCH /api/admin/matches/:id
                      → UpdateMatchDetailsUseCase (open-guard) → match.withDetails → repo.update
                      → invalidate ['matches'] → row refetch

User expand (cartelera): HistorySection row → useMatchHistory(dateId) → GET /api/matches/dates/:id/history
                      → sanitizeMatches(status, matches) → read-only rows (closed: result/score null)
```

## File Changes (with est. line deltas)

| File | Action | Δ lines | Description |
|------|--------|---------|-------------|
| `server/src/domain/entities/match.ts` | Modify | +18 | `withDetails()` (below) |
| `server/src/domain/errors/index.ts` | Modify | +12 | `OpenDateExistsError` (409) |
| `server/src/application/tournament/create-date-use-case.ts` | Modify | +40/−10 | Auto dateNumber, open-date guard, config betAmount |
| `server/src/application/tournament/create-match-use-case.ts` | Create | +70 | Open-date guard, `Match.new` → `repo.save` |
| `server/src/application/tournament/update-match-details-use-case.ts` | Create | +75 | Load match (404) → load date → guard → `withDetails` → `repo.update` |
| `server/src/application/tournament/sanitize-matches.ts` | Create | +25 | Pure `sanitizeMatches(status, matches)` |
| `server/src/infrastructure/http/routes/admin-routes.ts` | Modify | +70 | 3 routes + zod schemas (`createDateSchema`, `createMatchSchema`, `updateMatchDetailsSchema`) |
| `server/src/infrastructure/http/routes/match-routes.ts` | Modify | +45 | `/dates/:dateId/history` (auth-only) + sanitize call |
| `server/src/domain/__tests__/match.test.ts` | Modify | +25 | `withDetails` suite |
| `server/src/application/__tests__/tournament-use-cases.test.ts` | Modify | +130 | CreateDate (auto/guard/config) + CreateMatch + UpdateMatchDetails suites |
| `server/src/application/__tests__/sanitize-matches.test.ts` | Create | +40 | closed→null, results→full, open→null |
| `server/src/infrastructure/http/__tests__/api.test.ts` | Modify | +170 | Route tests: 201/403/422/404/401, sanitization via history |
| `client/src/api/admin-api.ts` | Modify | +55 | `createDate`, `createMatch`, `updateMatchDetails` + payload interfaces |
| `client/src/api/match-api.ts` | Modify | +8 | `getHistory(dateId)` → `DateMatchesResponse` (reused) |
| `client/src/types/index.ts` | Modify | +10 | `CreateMatchPayload`/`UpdateMatchDetailsPayload` (client MatchDTO already fits) |
| `client/src/hooks/use-admin.ts` | Modify | +55 | `useCreateDate`, `useCreateMatch`, `useUpdateMatchDetails` |
| `client/src/hooks/use-matches.ts` | Modify | +12 | `useMatchHistory(dateId?)` |
| `client/src/components/admin/MatchEditor.tsx` | Rewrite | ~±250 | Accordion container (active tournament via `useAdminTournaments`, default-expand open date) |
| `client/src/components/admin/MatchRow.tsx` | Create | +150 | Editable row (open) / view-only (closed/results) + per-row save |
| `client/src/components/admin/AddMatchForm.tsx` | Create | +80 | "Agregar partido" form (open date only) |
| `client/src/components/matches/HistorySection.tsx` | Create | +120 | Rows (lock/$ icons) + expand → `useMatchHistory` + read-only rows |
| `client/src/components/matches/CarteleraPage.tsx` | Modify | +30 | Render `<HistorySection/>` below content AND below no-cartelera branch |
| `client/src/components/__tests__/MatchEditor.test.tsx` | Create | +180 | Accordion, nueva fecha, add match, closed view-only |
| `client/src/components/__tests__/MatchRow.test.tsx` | Create | +80 | Edit + save mutation, view-only mode |
| `client/src/components/__tests__/HistorySection.test.tsx` | Create | +90 | Icons, expand, closed hides results |
| `client/src/components/__tests__/CarteleraPage.test.tsx` | Modify | +40 | HistorySection renders in both branches (mock `useMatchHistory`) |

**Total ≈ 1,640 lines (additions+deletions).**

## Interfaces / Contracts

```ts
// Match.withDetails — immutable, mirrors setResult; NEVER touches result/score
withDetails(details: {
  localTeam?: string;
  visitorTeam?: string;
  localImg?: string | null;   // null clears
  visitorImg?: string | null;
  scheduledAt?: Date | null;  // null clears
}): Match
// impl: new Match(this.id, this.matchDateId,
//   details.localTeam ?? this.localTeam, ... rest unchanged, this._result, this._score, this.createdAt)

// sanitizeMatches — pure
function sanitizeMatches(status: MatchDateStatus, matches: MatchDTO[]): MatchDTO[]
// status !== 'results' → result: null, score: null; 'results' → unchanged

// API contract
POST   /api/admin/dates                 { tournamentId }                    → 201 { matchDate }      403|409|404
POST   /api/admin/matches               { matchDateId, localTeam, visitorTeam, localImg?, visitorImg?, scheduledAt? } → 201 { match }  403|422|404
PATCH  /api/admin/matches/:matchId      partial { localTeam?, visitorTeam?, localImg?, visitorImg?, scheduledAt? } → 200 { match }  403|422|404
GET    /api/matches/dates/:dateId/history                                    → 200 { matchDate, matches }  401|404
// zod: createMatchSchema = z.object({ matchDateId: z.number().int().positive(),
//   localTeam: z.string().min(1), visitorTeam: z.string().min(1),
//   localImg: z.string().nullable().optional(), visitorImg: z.string().nullable().optional(),
//   scheduledAt: z.string().nullable().optional() })
// updateMatchDetailsSchema = same without matchDateId, .partial()
```

Client mutation invalidation: all three invalidate `['admin','tournaments']` + `['matches']` (prefix covers `byDate`/`history`/`dates`/`current`) — same pattern as `useSetMatchResult`/`useCloseDate`.

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Domain unit | `withDetails` merge, null-clear, immutability, result/score untouched | Extend `domain/__tests__/match.test.ts` |
| App unit | CreateDate (max+1, open-guard, config bet), CreateMatch (guard), UpdateMatchDetails (partial, 404, guard) | Extend `tournament-use-cases.test.ts` (repo mocks pattern) |
| App unit | `sanitizeMatches` closed/results/open | New `sanitize-matches.test.ts` |
| HTTP route | 201/403/422/404/401 for all 4 endpoints; history sanitization (closed→null, results→full, non-admin OK, no-token 401) | Extend `api.test.ts` (inject + mocked repos pattern) |
| Client unit | MatchEditor accordion states, Nueva fecha, add match, closed view-only; MatchRow save/view-only; HistorySection icons + expand + hidden results; CarteleraPage renders section both branches | New/extended component tests (react-query hook mocks, as in `CarteleraPage.test.tsx`) |

## Migration / Rollout

No migration — existing tables only. Rollback = revert routes/use cases/client changes (proposal Rollback Plan).

## Chained PR Split (400-line budget)

| PR | Scope | Δ est. | Risk |
|----|-------|--------|------|
| PR1 | Server core: match.ts, errors, create-date modify, create-match, update-match-details, sanitize + unit tests | ~430 | Medium — if >400, move `tournament-use-cases.test.ts` additions to PR2 |
| PR2 | Server routes: admin-routes.ts, match-routes.ts + api.test.ts route tests | ~285 | Low |
| PR3 | Client api + hooks: admin-api, match-api, use-admin, use-matches, types | ~140 | Low |
| PR4 | Client admin accordion: MatchEditor rewrite, MatchRow, AddMatchForm + tests | ~500 | **High** — split: PR4a UI shell + create flows (~260), PR4b MatchRow save + tests (~240) |
| PR5 | Client cartelera: HistorySection + CarteleraPage + tests | ~280 | Low |

Recommended: 5–6 chained PRs, each targeting the previous branch until merged. `Decision needed before apply: Yes` (PR4 split), `Chained PRs recommended: Yes`, `400-line budget risk: High` (total ~1,640).

## Open Questions

- [x] `POST /api/admin/dates` body carries `tournamentId` explicitly (client knows active tournament) — **RESOLVED: yes** — the design's assumption held; implementation sends `{ tournamentId }` (zod `createDateSchema` in `admin-routes.ts`, verified in `api.test.ts`). No spec change needed.
- [x] HistorySection tournament scope when multiple tournaments exist (design: filter to active-date tournament, fallback all non-open) — **RESOLVED: all non-open dates across tournaments, sorted chronologically** (the design's fallback) — `HistorySection` lists every non-open date regardless of tournament; the open-date tournament is NOT used to filter. Verified in `HistorySection.tsx` + tests.

## Post-Delivery Notes & Deviations (PR #18, commit `6403102`)

Post-delivery fixes landed after the original 7 PRs (#10–#16). They are code fixes with **no spec behavior change**; all date-history scenarios remain compliant (see verify-report).

| # | Note | Detail |
|---|------|--------|
| N1 | Audit/tournament repo id-strip | `drizzle-audit-log-repo.ts` / `drizzle-tournament-repo.ts` strip the `id: 0` sentinel on insert so the serial PK assigns the id — root cause of the close-date 500 on a second insert. Repo-layer fix; use cases unchanged. |
| N2 | ConfigPanel pesos units | Bet amount edited/displayed in pesos (cents ÷ 100) with validation — fixes units, aligns with the `betAmount` from config requirement. |
| N3 | HistorySection L/E/V layout | Centered "L/E/V" score layout between team names + user's own bet badge (already-bet flow) — matches the date-history read-only rows with results scenarios. |
| N4 | MatchEditor date order | Date ordering: open date first, then descending — matches the "default-expand open date" scenario intent. |
| N5 | CarteleraPage already-bet flow | "ya hiciste tu jugada - ver ticket" lock flow — consistent with the out-of-scope note that betting is read-only once placed. |
| N6 | Line forecast undershoot | design.md file-change forecast (~1,640 Δ) undershot the actual diff (3,859+/202− across 34 files incl. artifacts) — forecast-only, no design impact. |

D9 remains the only design decision that deviates from the proposal (`HistoryMatchRow` instead of `MatchCard` + `showResults`), already recorded in the Architecture Decisions table above.
