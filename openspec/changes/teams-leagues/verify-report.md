# Verification Report — teams-leagues (Phase 1: Server)

**Change**: teams-leagues
**Version**: N/A (branch `feature/teams-leagues`, commits 161a661 → 1b78b4b)
**Mode**: Standard
**Scope**: SERVER ONLY (tasks T1–T5, work units U1–U5). Client work (T6–T9) is out of current scope — not implemented, NOT flagged as defects.

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total (Phase 1) | 5 |
| Tasks implemented | 5 (T1 ✓, T2 ✓, T3 ✓, T4 ✓, T5 ✓ — commits exist for all) |
| Tasks checked in tasks.md | 3 (T1–T3; **T4/T5 checkboxes stale** — implementation committed but boxes unchecked) |
| Tasks incomplete | 0 |

## Build & Tests Execution

**Build (tsc --noEmit)**: ✅ Passed (exit 0)

**Tests (`pnpm vitest run`, workdir `server`)**: ✅ 469 passed / 0 failed / 0 skipped — 34 test files

```text
Test Files  34 passed (34)
Tests       469 passed (469)
Duration    41.73s
```

Relevant new/updated suites:
- `drizzle-teams-repo.test.ts` — 15 tests (unique mapping, membership tx, join, cascade)
- `teams-use-cases.test.ts` — 24 tests (global dup 409, empty leagueIds 400, unknown league 404, last-membership 400, delete guards 409, logo failure → null)
- `api.test.ts` — 115 tests incl. registry routes (201/400/403/404/409) + match enrichment (422, FK null semantics)
- `local-file-image-service.test.ts` — 6 tests (magic-byte sniffing only)
- `match.test.ts` — withDetails team-id semantics
- `team.test.ts` / `league.test.ts` — entity invariants
- Tournament/betting/ranking suites unregressed (all green)

**Coverage**: ➖ Not available (no coverage run configured in this verification).

## Spec Compliance Matrix

### team-registry (authoritative)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| League Creation | Create league (201) | `api.test.ts` > POST /api/admin/leagues (201) | ✅ COMPLIANT |
| League Creation | Normalized duplicate → 409 | `api.test.ts` (409 LEAGUE_NAME_TAKEN); `drizzle-league-repo.test.ts` (23505 map) | ✅ COMPLIANT |
| League Creation | Empty name → 400 | `api.test.ts` (400 VALIDATION_ERROR) | ✅ COMPLIANT |
| League Creation | Non-admin → 403 | `api.test.ts` (403 FORBIDDEN) | ✅ COMPLIANT |
| League Listing | List ordered by name, nested teams | `api.test.ts` GET /leagues (nested teams); repo `findAll` orderBy name | ✅ COMPLIANT |
| League Editing | Rename persists | `api.test.ts` PATCH (200) | ✅ COMPLIANT |
| League Editing | Rename collision → 409 | `drizzle-league-repo.test.ts` (update maps 23505) | ✅ COMPLIANT |
| League Deletion Guard | Delete empty league (204) | `api.test.ts` DELETE (204); UC test | ✅ COMPLIANT |
| League Deletion Guard | League with teams → 409 | `api.test.ts` (409 LEAGUE_HAS_TEAMS); UC test | ✅ COMPLIANT |
| Team Creation | Create with membership (201) | `api.test.ts` POST /teams (201) | ✅ COMPLIANT |
| Team Creation | Duplicate globally → 409 | `api.test.ts` (409 TEAM_NAME_TAKEN); repo 23505 map | ✅ COMPLIANT |
| Team Creation | Membership required → 400 | `api.test.ts` (400, empty leagueIds); UC `TeamNeedsLeagueError` | ✅ COMPLIANT |
| Team Creation | Empty name → 400 | zod `nonBlankText` (admin-routes.ts:120); covered by pattern | ✅ COMPLIANT |
| Team Creation | Non-admin → 403 | adminMiddleware on all routes (shared, tested on leagues/matches) | ✅ COMPLIANT |
| Team Editing | Partial rename keeps fields | `api.test.ts` PATCH (200); UC test | ✅ COMPLIANT |
| Team Editing | Rename collision → 409 | repo 23505 map (drizzle-teams-repo.test.ts) | ✅ COMPLIANT |
| Team Editing | Add membership | `teams-use-cases.test.ts` (replaces membership set) | ✅ COMPLIANT |
| Team Editing | Remove last membership → 400 | `api.test.ts` (400); UC `TeamNeedsLeagueError` | ✅ COMPLIANT |
| Team Deletion Guard | Delete unreferenced team + memberships | `api.test.ts` (204); `drizzle-teams-repo.test.ts` (CASCADE) | ✅ COMPLIANT |
| Team Deletion Guard | Referenced team → 409 | `api.test.ts` (409 TEAM_REFERENCED_BY_MATCHES); UC test | ✅ COMPLIANT |
| Team Autocomplete | Filter by league, ordered by name | `api.test.ts` GET /leagues/:id/teams; repo `findByLeagueId` join | ✅ COMPLIANT |
| Team Autocomplete | Empty league → empty list | UC + repo join (by construction; empty result path) | ✅ COMPLIANT |
| Team Autocomplete | Team in multiple leagues in both | `teams-use-cases.test.ts` (ListLeaguesUseCase shared team) | ✅ COMPLIANT |
| Seeded Rosters | Seed loads rosters | `seed-leagues-teams.ts` (30 + 36 teams, aliases, memberships) — no runtime test | ⚠️ PARTIAL |
| Seeded Rosters | Re-run is idempotent | **static defect: lookup asymmetric — re-run crashes 23505** (see Issues) | ❌ FAILING (static proof) |

### team-image-hosting

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Shield Acquisition | Valid shield stored + relative path | `teams-use-cases.test.ts` (mocked service stores `logos/7.png`); code: service writes `logos/{id}.{ext}` | ⚠️ PARTIAL (service mocked; real download/write path untested) |
| Shield Acquisition | Invalid MIME does not block | `local-file-image-service.test.ts` (HTML rejected by sniff); UC null-logo test | ✅ COMPLIANT |
| Shield Acquisition | Oversized does not block | code: `MAX_IMAGE_BYTES` check (service:87) — **no covering test** | ❌ UNTESTED |
| Shield Acquisition | Unreachable URL does not block | UC null-logo test (mocked); service download try/catch — no service-level test | ⚠️ PARTIAL |
| Shield Serving | Served with long cache | code: `@fastify/static` `maxAge: '30d'` non-immutable (index.ts:39-43) — **no route/cache test** | ❌ UNTESTED |
| Shield Serving | DB stores relative paths only | UC test asserts `logos/7.png`; service returns relative path | ✅ COMPLIANT |
| Shield Fallback | Manual URL still accepted | `localImg`/`visitorImg` retained in match schema + routes + zod | ✅ COMPLIANT |

### tournament-management (server portion)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Team Reference Enrichment | Legacy match keeps working | `api.test.ts` (free-text only → null FKs); `match.test.ts` | ✅ COMPLIANT |
| Team Reference Enrichment | Registry match stores both | `api.test.ts` (201 with teamIds); UC tests | ✅ COMPLIANT |
| Match Creation (modified) | Create on open date | `api.test.ts` (201) | ✅ COMPLIANT |
| Match Creation | Non-open date → 422 | `api.test.ts` (422 DATE_NOT_OPEN) | ✅ COMPLIANT |
| Match Creation | Non-active tournament rejected | `api.test.ts` (422 TOURNAMENT_NOT_ACTIVE) | ✅ COMPLIANT |
| Match Creation | Non-admin → 403 | `api.test.ts` (403) | ✅ COMPLIANT |
| Match Creation | Registry teams stored + strings set | `api.test.ts` (201 with teamIds, names set) | ✅ COMPLIANT |
| Match Creation | Unknown team id → 422, no match | `api.test.ts` (422 TEAM_NOT_RESOLVABLE, save not called); UC | ✅ COMPLIANT |
| Match Creation | Free text stays legacy (null ids) | `api.test.ts` (null FKs, findById not called) | ✅ COMPLIANT |
| Match Details Editing | Partial update via withDetails | `api.test.ts` (200, other fields untouched); `match.test.ts` | ✅ COMPLIANT |
| Match Details Editing | Non-open date → 422 | `api.test.ts` (422 DATE_NOT_OPEN) | ✅ COMPLIANT |
| Match Details Editing | Unknown match → 404 | `api.test.ts` (404 MATCH_NOT_FOUND) | ✅ COMPLIANT |
| Match Details Editing | Update via registry (id → name + FK) | `api.test.ts` (localTeamId:7 → River Plate) | ✅ COMPLIANT |
| Match Details Editing | Free text clears FK | `api.test.ts` (string-only → FK null, other side kept) | ✅ COMPLIANT |

### admin-operations

All requirements (Equipos tab, Match Team Selection UI, Open Date Match Editing UI) are CLIENT-side → **NOT-APPLICABLE** in this server-only verification (out of current scope).

## Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Migration 0005 schema | ✅ Implemented | leagues/teams/team_leagues per design D1/D3; matches FK SET NULL + idxs; UNIQUE pair + league idx; teams pre-flight DO block (mirrors 0003); leagues index without DO block (new table — vacuous) |
| League + Team entities | ✅ Implemented | Immutable, `new/create/toSnapshot`, Team carries `leagueIds` (D12) |
| DrizzleLeagueRepo / DrizzleTeamRepo | ✅ Implemented | 23505→domain errors via mapNameViolation; membership tx replace; findByLeagueId join; countTeams/countMatchesReferencing; CASCADE delete |
| 8 league/team use cases | ✅ Implemented | leagueIds ≥1 invariant (empty→400, last-membership→400), guards→409, resolve leagues→404 |
| Routes + zod | ✅ Implemented | all 9 endpoints; z.coerce params; admin middleware; errorHandler maps DomainError statusCodes |
| Match enrichment | ✅ Implemented | resolveTeam: id→findById→422; string:=team.name; string-only→FK null; MatchDTO includes team ids (admin + public match-routes + bet-routes) |
| Image pipeline | ✅ Implemented | @fastify/static registered (30d non-immutable); magic-byte sniff (PNG/JPEG/WebP); 1 MiB cap; 10s timeout; never throws; relative path only; SetTeamLogoUseCase + POST /teams/:teamId/logo |
| Seed script | ⚠️ Implemented with defect | rosters real 2026 (30+36), aliases, membership onConflictDoNothing, graceful shield path — but idempotent re-run broken (see CRITICAL) |

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 flat teams global unique | ✅ Yes | `teams.name` functional index |
| D2 SET NULL + app guard 409 | ✅ Yes | FK set null; countMatchesReferencing pre-check |
| D3 junction CASCADE/RESTRICT + UNIQUE pair + league idx | ✅ Yes | exactly as DDL sketch |
| D4 422/404 split | ✅ Yes | TeamNotResolvableError 422; CRUD 404 |
| D5 download after insert, never blocks | ✅ Yes | attachLogo after repo.save; null on failure |
| D6 magic bytes, 1 MiB cap | ✅ Yes | sniffImageType + MAX_IMAGE_BYTES |
| D7 30d non-immutable | ✅ Yes | `maxAge: '30d'`, no immutable flag |
| D8 nested teams in GET /leagues | ✅ Yes | ListLeaguesUseCase groups in memory |
| D9 flat team endpoints with leagueIds | ✅ Yes | POST/PATCH /api/admin/teams |
| D10 write-once enrichment | ✅ Yes | rename/delete never rewrites match strings |
| D11 league selector UI-only | ✅ (server) | no league id in match payloads; client part out of scope |
| D12 memberships inside TeamRepo | ✅ Yes | one transactional boundary |
| Seed: one db.transaction | ❌ No | implementation runs sequential statements without a transaction |
| Seed: file name `seed-teams.ts` + `seed:teams` script | ❌ No | file is `seed-leagues-teams.ts`; **no `seed:teams` entry in package.json** |

## Issues Found

**CRITICAL**
1. **Seed re-run crashes (idempotency broken) — statically provable** — `scripts/seed-leagues-teams.ts:147-159,161-181`: lookup builds `normalize(name)` = lower + **whitespace-stripped** (line 46-48), but the SQL compares `lower(<column>) = <key>` (lines 150, 164) WITHOUT stripping whitespace from the column side. Stored 'Primera A' → `lower()` = 'primera a' ≠ 'primeraa' → lookup misses → INSERT re-runs → functional unique index computes 'primeraa' → **23505 crash, exit 1**. Violates spec scenario "Re-run is idempotent" and T5 AC "run twice creates no dup leagues/teams/memberships". Fix: reuse `findByName` from the repos (both sides regexp_replace-normalized) instead of the inline `db.query` lookup. *(Runtime confirmation requires a DB; per instructions the seed was NOT run — but the defect is provable from source without a DB.)*

**WARNING**
2. **tasks.md checkbox drift** — T4/T5 implemented (commits abd3f07, 1b78b4b) but marked `[ ]` in tasks.md. Task tracking must be updated; not missing implementation.
3. **T4 test coverage gaps** — `local-file-image-service.test.ts` covers ONLY `sniffImageType`; no tests for size cap, timeout→null, unreachable-URL→null, file write+relative path. No route test for `POST /api/admin/teams/:teamId/logo`. No static cache-header test. tasks.md T4 AC explicitly required "(magic-byte, size cap, timeout→null)" and "logo/static cache route tests".
4. **package.json missing `seed:teams`** — T5 AC requires "+ package.json `seed:teams`"; script exists as `seed-leagues-teams.ts` but no npm entry was added.
5. **Seed not wrapped in `db.transaction`** — design.md:150 specifies one transaction; implementation runs sequential inserts (partial failure leaves inconsistent state).

**SUGGESTION**
6. Seed rosters include NO `logoUrl` on any of the 66 teams — the graceful shield-download path is dead code in the shipped data (never exercised).
7. Leagues unique index in 0005 lacks the pre-flight DO block that teams has — both tables are new so it is vacuous, but the pattern is inconsistent with the verify checklist item.
8. File name `seed-leagues-teams.ts` deviates from design/tasks `seed-teams.ts` (cosmetic).

## Verdict

**PASS WITH WARNINGS** — server Phase 1 implementation is complete and the production code (schema, entities, repos, use cases, routes, match enrichment, image pipeline) is verified by 469 passing tests + clean tsc. **Blocking before archive: fix the seed idempotency lookup (CRITICAL #1)**; T4 test-coverage gaps and the missing `seed:teams` script should be addressed in the same pass. Client work (T6–T9) is out of current scope — not a defect.
