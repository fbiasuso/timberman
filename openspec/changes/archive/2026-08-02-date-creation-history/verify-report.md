## Verification Report

**Change**: date-creation-history
**Version**: N/A
**Mode**: Standard (strict_tdd: false, vitest)
**Verified at**: main @ `6403102` (PRs #10–#16 + post-delivery PR #18 merged)

## Summary

**Status: PASS.** All 23/23 tasks complete, both test suites green, both builds exit 0, no DB schema change. The implementation was previously verified (Engram topic `sdd/date-creation-history/verify-report`) and this report re-confirms it on the current head with fresh runtime evidence, including the post-delivery fixes from PR #18.

| Metric | Result |
|--------|--------|
| Tasks total | 23 |
| Tasks complete | 23 |
| Tasks incomplete | 0 |
| Server tests | ✅ 230 passed (24 files), 0 errors |
| Server build (`tsc`) | ✅ exit 0 |
| Client tests | ✅ 100 passed (11 files), 0 errors |
| Client build (`tsc && vite build`) | ✅ exit 0 |
| DB migrations | 0 (only pre-existing `0000`/`0001` in `server/drizzle`) |

### Execution Evidence

```text
# server (pnpm test) — vitest run
Test Files  24 passed (24)
     Tests  230 passed (230)

# server (pnpm build) — tsc
exit 0 (no output)

# client (pnpm test) — vitest run
Test Files  11 passed (11)
     Tests  100 passed (100)

# client (pnpm build) — tsc && vite build
✓ 182 modules transformed
✓ built in 20.15s
```

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 23 |
| Tasks complete | 23 |
| Tasks incomplete | 0 |

All task phases confirmed by source inspection: domain (`withDetails`, `OpenDateExistsError`, `sanitizeMatches`, `CreateMatchUseCase`, `UpdateMatchDetailsUseCase`), CreateDate wiring (auto dateNumber, open-guard, config betAmount), server routes (3 admin mutations + history), client API/hooks (admin-api, match-api, use-admin, use-matches, types), admin accordion UI (MatchEditor, AddMatchForm, MatchRow), cartelera history UI (HistorySection, CarteleraPage), and integration (7.1) — both suites + builds green, 0 migrations.

## Requirements Coverage

### Admin Operations (specs/admin-operations/spec.md)

| Requirement | Scenario | Evidence | Result |
|-------------|----------|----------|--------|
| Partidos Date Accordion | Accordion lists all dates | `MatchEditor.test.tsx` (renders every date as accordion row with status icon; orders open first then descending) | ✅ COMPLIANT |
| Partidos Date Accordion | Nueva fecha button creates date | `MatchEditor.test.tsx` (useCreateDate mutation, new date appears after refetch) + `POST /api/admin/dates` 201 route test | ✅ COMPLIANT |
| Open Date Match Editing | Edit open-date match and save | `MatchRow.test.tsx` (save mutation via useUpdateMatchDetails) + PATCH 200 route test | ✅ COMPLIANT |
| Open Date Match Editing | Add match to open date | `MatchEditor.test.tsx` (add-match form submits via useCreateMatch; new match shown after refetch) + `POST /api/admin/matches` 201 | ✅ COMPLIANT |
| Open Date Match Editing | Closed date is view-only | `MatchRow.test.tsx` (view-only mode, no edit controls) + `MatchEditor.test.tsx` (closed date read-only with results) | ✅ COMPLIANT |

### Date History (specs/date-history/spec.md)

| Requirement | Scenario | Evidence | Result |
|-------------|----------|----------|--------|
| Date History Endpoint | User fetches date history | `api.test.ts` (history returns date + sanitized matches for non-admin) + `HistorySection.test.tsx` (expand fetches history) | ✅ COMPLIANT |
| Date History Endpoint | Unauthenticated request rejected | `api.test.ts` (401 UNAUTHORIZED without token) | ✅ COMPLIANT |
| Date History Endpoint | Unknown date | `api.test.ts` (404 MATCH_DATE_NOT_FOUND) | ✅ COMPLIANT |
| Results Sanitization | Closed date hides results | `api.test.ts` (closed → result/score null) + `sanitize-matches.test.ts` (closed→null) + `HistorySection.test.tsx` (no results on closed) | ✅ COMPLIANT |
| Results Sanitization | Results date shows full results | `api.test.ts` (results → full) + `sanitize-matches.test.ts` (results→unchanged) + `HistorySection.test.tsx` | ✅ COMPLIANT |
| Cartelera Fechas Anteriores | Section below active date content | `CarteleraPage.test.tsx` (HistorySection below active content) | ✅ COMPLIANT |
| Cartelera Fechas Anteriores | Section below no-cartelera message | `CarteleraPage.test.tsx` (no active date branch renders HistorySection) | ✅ COMPLIANT |
| Cartelera Fechas Anteriores | Expand closed date row | `HistorySection.test.tsx` (teams only, no results) | ✅ COMPLIANT |
| Cartelera Fechas Anteriores | Expand results date row | `HistorySection.test.tsx` (teams + score) | ✅ COMPLIANT |

### Tournament Management (specs/tournament-management/spec.md)

| Requirement | Scenario | Evidence | Result |
|-------------|----------|----------|--------|
| Match Creation | Create match on open date | `api.test.ts` (201 creates + persists) + `tournament-use-cases.test.ts` (CreateMatch suite) | ✅ COMPLIANT |
| Match Creation | Create match on non-open date rejected | `api.test.ts` (422 DATE_NOT_OPEN) + use-case guard test | ✅ COMPLIANT |
| Match Creation | Non-admin rejected | `api.test.ts` (403 FORBIDDEN) | ✅ COMPLIANT |
| Match Details Editing | Partial details update | `api.test.ts` (partial PATCH 200) + `tournament-use-cases.test.ts` (partial change, empty body no-op) | ✅ COMPLIANT |
| Match Details Editing | Edit on non-open date rejected | `api.test.ts` (422) + use-case guard test | ✅ COMPLIANT |
| Match Details Editing | Unknown match | `api.test.ts` (404 MATCH_NOT_FOUND) + use-case test | ✅ COMPLIANT |
| Create Tournament Date | Create next date after publishing | `api.test.ts` (201: dateNumber 2, open, pozo 0, config betAmount) + `tournament-use-cases.test.ts` (auto max+1) | ✅ COMPLIANT |
| Create Tournament Date | Reject when an open date exists | `api.test.ts` (409 OPEN_DATE_EXISTS) + use-case test | ✅ COMPLIANT |
| Create Tournament Date | Non-admin rejected | `api.test.ts` (403) | ✅ COMPLIANT |

**Compliance summary: 17/17 scenarios compliant** (9 admin-operations/date-history + 8 tournament-management; all backed by runtime tests).

## Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| `Match.withDetails()` immutable, result/score untouched | ✅ Implemented | `server/src/domain/entities/match.ts` — mirrors `setResult`; `undefined` keeps, `null` clears |
| `OpenDateExistsError` 409 `OPEN_DATE_EXISTS` | ✅ Implemented | `domain/errors/index.ts` |
| `sanitizeMatches` pure helper | ✅ Implemented | `application/tournament/sanitize-matches.ts` — non-'results' → result/score null |
| `CreateMatchUseCase` open-guard (422) + 404 | ✅ Implemented | `application/tournament/create-match-use-case.ts` |
| `UpdateMatchDetailsUseCase` partial, no-op empty body, 404/422 | ✅ Implemented | `application/tournament/update-match-details-use-case.ts` |
| `CreateDateUseCase` auto dateNumber, open-guard, config betAmount | ✅ Implemented | `application/tournament/create-date-use-case.ts` |
| `POST /api/admin/dates` (201/403/409/404/400) | ✅ Implemented | `admin-routes.ts` + zod `createDateSchema` |
| `POST /api/admin/matches` (201/422/404/403/400) | ✅ Implemented | `admin-routes.ts` + `createMatchSchema` |
| `PATCH /api/admin/matches/:matchId` (200/422/404/403) | ✅ Implemented | `admin-routes.ts` + `updateMatchDetailsSchema .partial()` |
| `GET /api/matches/dates/:dateId/history` (auth-only, 401/404, sanitized) | ✅ Implemented | `match-routes.ts` — non-admin OK, sanitize applied |
| Client API + hooks (createDate/createMatch/updateMatchDetails/getHistory, invalidation) | ✅ Implemented | `admin-api.ts`, `match-api.ts`, `use-admin.ts`, `use-matches.ts`, `types/index.ts` |
| MatchEditor accordion, icons, Nueva fecha, AddMatchForm on open only | ✅ Implemented | `MatchEditor.tsx`, `AddMatchForm.tsx` |
| MatchRow editable (PATCH save) / view-only closed+results | ✅ Implemented | `MatchRow.tsx` |
| HistorySection Fechas anteriores, lock/$ icons, expand → history, read-only rows | ✅ Implemented | `HistorySection.tsx` |
| CarteleraPage renders HistorySection both branches; already-bet flow | ✅ Implemented | `CarteleraPage.tsx` |

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 sanitization placement (pure helper, route-only consumer) | ✅ Yes | `sanitize-matches.ts`, called only in `match-routes.ts` history |
| D2 route placement (history in match-routes; admin mutations in admin-routes) | ✅ Yes | |
| D3 guard error reuse (`DateNotOpenError` 422) | ✅ Yes | `create-match` + `update-match-details` |
| D4 new `OpenDateExistsError` 409 | ✅ Yes | |
| D5 CreateDate input `{tournamentId, betAmount?}`, auto max+1, config default | ✅ Yes | |
| D6 per-use-case DTOs, routes map to ISO | ✅ Yes | `toMatchDTO` in both route files |
| D7 admin uses admin route for all date statuses | ✅ Yes | `useMatchesByDate` in MatchEditor |
| D8 new `useMatchHistory` → `/history` (admin route not reused) | ✅ Yes | disabled query until expand |
| D9 dedicated read-only history row | ✅ Yes | `HistoryMatchRow` inside HistorySection — documented deviation from proposal (`MatchCard` + `showResults`) |
| D10 empty PATCH body no-op | ✅ Yes | `hasChanges` check in update use case; covered by test |

## Deviations

1. **D9 (documented design deviation)**: History rows use a dedicated read-only `HistoryMatchRow` instead of the proposal's `MatchCard` + `showResults` flag — correct call (MatchCard couples to BetButtons/bet-slip store); noted in design.md.
2. **PR #18 post-delivery fixes** (commit `6403102`, not part of the original 7 PRs) — code fixes, **no spec behavior changed**:
   - `drizzle-audit-log-repo.ts` / `drizzle-tournament-repo.ts`: strip the `id: 0` sentinel on insert so the serial PK assigns the id — this was the root cause of the close-date 500 on a second insert (spec-required flows were erroring at the repo layer, not the use cases).
   - `ConfigPanel.tsx`: bet amount now edited/displayed in pesos (cents ÷ 100) with validation — fixes units; aligns with the `betAmount` from config requirement, no spec change.
   - `HistorySection.tsx`: centered "L/E/V" score layout between team names + user's own bet badge (already-bet flow) — matches the date-history scenarios' "read-only rows with results"; spec-accurate.
   - `MatchEditor.tsx`: date ordering (open date first, then descending) — matches the "default-expand open date" scenario intent; spec-accurate.
   - `CarteleraPage.tsx`: already-bet lock flow ("ya hiciste tu jugada - ver ticket") — an addition consistent with the out-of-scope note that betting is read-only once placed; no spec contradiction.
3. **Open items for archive** (documentation-only, no spec impact):
   - design.md line forecast (~1,640) undershot the actual diff (3,859+/202− across 34 files incl. artifacts) — forecast-only.
   - design.md **Open Questions OQ1/OQ2 remain unchecked**: OQ1 (create-date body shape) resolved in code as `{ tournamentId }` (matches the design's assumption and api.test.ts); OQ2 (HistorySection tournament scope) resolved in code as "all non-open dates across tournaments, sorted chronologically" (the design's fallback). Both should be closed during archive.

## Artifacts Updated

- `openspec/changes/date-creation-history/verify-report.md` — **created** (this file).
- Engram topic `sdd/date-creation-history/verify-report` — prior verify exists (observation #637, `architecture`); this report re-confirms on head @ 6403102.

## Next Recommended

**archive** — the native SDD dispatcher requires `verify-report.md` in the change root before ARCHIVE; it now exists with an explicit PASS signal. During archive: close design.md OQ1/OQ2, fold the PR #18 fixes and the deviation list into design.md, and handle Issue #9 (reopened on each merge, archive/close step next).

## Verdict

PASS

**Status: PASS** — change verified: 23/23 tasks complete, 230 server + 100 client tests passing, both builds exit 0, 0 migrations, 17/17 spec scenarios compliant with runtime test evidence. No blocking issues.
