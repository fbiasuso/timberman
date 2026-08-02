# Proposal: Date Creation & History

## Intent

Admins can't create date 2 after closing date 1: `CreateDateUseCase` exists with passing tests but has no HTTP route, so new dates only come from the seed script. `MatchEditor` only renders the current open date with a fake, non-persisting save, and users see no historical dates once the active date closes ("No hay cartelera disponible"). This change wires date/match creation and match-details editing on the server, turns Partidos into an all-dates accordion with real saves, and adds a user-facing "Fechas anteriores" section.

## Scope

### In Scope

- **Server routes**: wire existing `CreateDateUseCase` → `POST /api/admin/dates` (dateNumber auto = max+1 for tournament); `POST /api/admin/matches` (guarded: open dates only); `PATCH /api/admin/matches/:matchId` (teams, imgs, scheduledAt — separate from `/result`); `GET /api/matches/dates/:dateId/history` (auth-only, non-admin).
- **Sanitization rule** (user decision): closed dates → matches with `result`/`score` = null; results-published dates → full results.
- **Domain**: new immutable `Match.withDetails()` (pattern like `setResult`).
- **Client admin Partidos**: accordion of all dates (`useAdminTournaments` → TournamentDateDTO) with lock/$ icons; open date expanded = editable matches (real save via PATCH details) + "Agregar partido" form; closed/paid = view-only matches+results; "Nueva fecha" button on top.
- **Client Cartelera**: "Fechas anteriores" section below active date (or below the no-cartelera message); rows expand to read-only matches via the history route.
- **Tests**: server vitest (use cases, routes, sanitization rule); client vitest (CarteleraPage, MatchEditor accordion, history rows).
- **No DB schema change** — existing tables only.

### Out of Scope

- Editing results via the new PATCH (stays on `/result`).
- Deleting dates/matches; editing matches on closed dates.
- Betting on historical dates (read-only).
- PDF tickets, ranking, payout changes.

## Capabilities

### New Capabilities

- `date-history`: user-facing historical dates/matches; `GET /api/matches/dates/:dateId/history`; closed hides results, results-published shows them.

### Modified Capabilities

- `tournament-management`: Create Tournament Date rewired to `POST /api/admin/dates` (auto-incremented dateNumber); new Match Creation + Match Details Editing requirements (immutable `withDetails()`, open-date-only guard).
- `admin-operations`: Partidos accordion UI requirements — create date/match actions, PATCH-details save, view-only closed/paid dates.

## Approach

Wire the existing `CreateDateUseCase`; add `CreateMatchUseCase` and `UpdateMatchDetailsUseCase` plus `Match.withDetails()`; add the history route reusing DTO mapping with a `sanitizeMatches(status)` helper. Client: extend `admin-api`/`matchApi` and hooks, rewrite `MatchEditor` around `useAdminTournaments`, add the historical section to `CarteleraPage`, reuse `MatchCard` with a `showResults` flag.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/src/infrastructure/http/routes/admin-routes.ts` | Modified | POST create date; POST create match; PATCH match details |
| `server/src/infrastructure/http/routes/match-routes.ts` | Modified | New `/dates/:dateId/history` + sanitization |
| `server/src/application/tournament/create-date-use-case.ts` | Modified | Wired (no logic change) |
| `server/src/application/tournament/create-match-use-case.ts` | New | Create match, open-date guard |
| `server/src/application/tournament/update-match-details-use-case.ts` | New | Edit teams/imgs/scheduledAt |
| `server/src/domain/entities/match.ts` | Modified | `withDetails()` |
| `client/src/components/admin/MatchEditor.tsx` | Modified | All-dates accordion + create/save flows |
| `client/src/components/matches/CarteleraPage.tsx` | Modified | Fechas anteriores section |
| `client/src/api/admin-api.ts`, `client/src/hooks/use-admin.ts` | Modified | createDate/createMatch/updateMatchDetails |
| `client/src/components/matches/MatchCard.tsx` | Modified | `showResults` flag |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Results leak on closed dates via history route | Med | Server-side sanitization + dedicated tests |
| MatchEditor rewrite regresses admin flow | Med | Keep ResultsEntry unchanged; client tests per accordion state |
| Duplicate/racing dateNumber on create | Low | Auto-increment computed from max within save flow; tests |
| PR exceeds 400-line review budget (~755 lines est.) | Med | Split into chained PRs: server endpoints first, then client |

## Rollback Plan

Revert the added routes/use cases and client changes; no schema change means no migration or data repair. Fallback is today's behavior (seed-script dates, single open-date editor). History route removal restores admin-only access to `/dates/:dateId`.

## Dependencies

- Existing `CreateDateUseCase` + tests; `MatchRepo.save`/`saveMany`; `MatchDateDTO`/`MatchDTO`; existing `useAdminTournaments`/`useMatchDates` hooks.

## Success Criteria

- [ ] POST create date/match and PATCH details persist (server API tests).
- [ ] History route: closed → null results, results-published → full results, non-admin allowed.
- [ ] Partidos accordion: create date 2 after publishing date 1, edit open-date matches, closed/paid view-only.
- [ ] Cartelera shows Fechas anteriores; expanding a closed date shows no results, a results date shows results.
- [ ] All existing + new vitest suites pass; push to main auto-redeploys Render + Netlify.
