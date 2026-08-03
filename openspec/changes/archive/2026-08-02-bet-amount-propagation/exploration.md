# Exploration: bet-amount-propagation

> Change: propagate `defaultBetAmount` config changes to open dates without bets.
> Status: complete
> Date: 2026-08-02

## Current State

Today `PATCH /api/admin/config` routes to `UpdateConfigUseCase.execute(key, value)`,
which validates the value, upserts the single `system_config` row, mutates the
shared in-memory config reference, and returns `{ config }`. It performs NO date
propagation — `defaultBetAmount` only affects dates created AFTER the change
(`CreateDateUseCase` snapshots `betAmount` from config at creation time). The
verified bug: an open date created when config was 500 cents keeps `betAmount = 5`
cents-equivalent confusion; changing config afterwards leaves the open date stale.

`MatchDate.betAmount` is a `private readonly` field with no mutator — the entity
offers `withPozo`, `withCommission`, `close`, `publishResults`, but no
`withBetAmount`. Persistence already supports it: `DrizzleTournamentRepo.updateMatchDate`
writes `bet_amount`, and the column exists in `match_dates` (default 1500).

Tickets carry their OWN `bet_amount` column, so existing bets are unaffected by a
date's betAmount change — only future bets (placed after propagation) would use
the new amount. `TicketRepo.countByMatchDateId(id)` exists to decide "has bets".

## Findings

1. **Config update flow**
   - Use case: `server/src/application/admin/update-config-use-case.ts` — `class UpdateConfigUseCase { constructor(config: SystemConfig, repo: SystemConfigRepo); async execute(key: string, value: unknown): Promise<SystemConfig> }`. No date logic today.
   - Route: `server/src/infrastructure/http/routes/admin-routes.ts` lines 344–351 — `PATCH /api/admin/config`, body schema `updateConfigSchema = { key: z.enum(['commission','allowRegistration','defaultBetAmount']), value: z.union([string, number, boolean]) }`, returns `reply.send({ config: conf })`. Route receives `tournamentRepo`, `ticketRepo`, `uow` already (createAdminRoutes signature lines 158–169) — all needed ports are in scope.

2. **Date/ticket relationship (ports)**
   - `server/src/domain/ports/tournament-repo.ts`:
     - `findOpenMatchDates(): Promise<MatchDate[]>` — generic "all open dates" (already used by `GET /api/matches/current`).
     - `updateMatchDate(matchDate: MatchDate): Promise<MatchDate>` — persists `betAmount` (drizzle impl `drizzle-tournament-repo.ts` lines 189–203).
     - Also `findMatchDateByIdForUpdate(id)` for transactional row locks.
   - `server/src/domain/ports/ticket-repo.ts`: `countByMatchDateId(matchDateId: number): Promise<number>`.
   - **Entity gap**: `server/src/domain/entities/match-date.ts` — no `withBetAmount`; needs one following the `withPozo(Money)` immutable pattern (returns new MatchDate, `Money` VO for cents).

3. **409 / one-open-date rule**
   - `OpenDateExistsError` (`server/src/domain/errors/index.ts` lines 93–100, code `OPEN_DATE_EXISTS`, 409) is enforced ONLY in `CreateDateUseCase` (per-tournament check `dates.some(d => d.isOpen())`). So one open date per tournament is guaranteed at creation, but cross-tournament multiple open dates are possible (`findOpenMatchDates` returns all; `/current` picks the newest). Propagation must iterate ALL open dates generically — `findOpenMatchDates()` is the right primitive.

4. **Error types & HTTP mapping**
   - `DomainError` base class (errors/index.ts) exposes `code` + `statusCode`; `error-handler.ts` maps any `instanceof DomainError` → `{ error: code, message }` with `statusCode`. Client surfaces `error.response.data.message` verbatim (ConfigPanel line 233).
   - **Design note**: per-date blocking is PARTIAL SUCCESS, not a thrown error — the config must always persist (requirement 3), so blocked dates should be returned as data (e.g. `blockedDates`), not thrown. A thrown DomainError would abort the whole request. Existing 409-style classes are a precedent only for the error-message wording, not for flow control here.

5. **DTO shape**
   - Config route today returns only `{ config: AdminConfigDTO }` (commission, allowRegistration, defaultBetAmount) — no per-date info. Needs a new shape: e.g. `{ config, updatedDates: [{ id, dateNumber, betAmount }], blockedDates: [{ id, dateNumber }] }`.
   - Admin tournaments DTO (`server/src/application/admin/list-tournaments-use-case.ts` `TournamentDateDTO` lines 14–21 and client `admin-api.ts` lines 23–32) **omits `betAmount`** per date (only id, dateNumber, status, pozo, commission, winners). The PUBLIC match DTO (`match-routes.ts` MatchDateDTO) DOES include `betAmount`. Recommendation: add `betAmount` to the admin TournamentDateDTO so the Partidos accordion can display the per-date amount post-propagation; the propagation response itself can carry date ids/numbers for messages.

6. **Tests**
   - Use case: `server/src/application/__tests__/admin-use-cases.test.ts` — `describe('UpdateConfigUseCase')` lines 442–534 with `createConfigRepoMocks()` helper; assertions on `repo.upsert` calls and shared-ref immutability.
   - Routes: `server/src/infrastructure/http/__tests__/api.test.ts` — `describe('registration live toggle (system config reference)')` lines 178–233 covers PATCH `/api/admin/config`. Mock factory `createMockServices()` (line 21) already stubs `findOpenMatchDates`, `updateMatchDate`, `countByMatchDateId` — no mock surgery needed for route tests.
   - Date creation: `server/src/application/__tests__/tournament-use-cases.test.ts` (betAmount-from-config assertions lines 159–194).
   - Commands: server `pnpm test` = `vitest run`, `pnpm lint` = `tsc --noEmit`, `pnpm build` = `tsc`.

## Client Findings

7. **ConfigPanel** — `client/src/components/admin/ConfigPanel.tsx`
   - Saves each changed field individually: `updateConfig.mutate({ key: 'defaultBetAmount', value: betAmountCents })` (lines 107–134). Bet amount edited in PESOS, converted to integer cents (`betAmountToCents`, EPSILON-guarded).
   - Feedback: inline red box on error (`updateConfig.error.response.data.message`), button text flips to "✓ Configuración Guardada" on success. NO toast. Spanish (Rioplatense neutral) UI strings.
   - `useUpdateConfig` (`client/src/hooks/use-admin.ts` lines 155–163) invalidates ONLY `['admin','config']` — a propagated date change would leave the Partidos accordion stale unless `['admin','tournaments']` is also invalidated.
   - No per-date message surface exists — grouped vs per-date UI is new work (recommendation below).

8. **Admin tournaments UI** — `client/src/components/admin/MatchEditor.tsx` (Partidos tab of `AdminPage.tsx`)
   - Accordion of ALL tournament dates from `useAdminTournaments()`. Each header shows "Fecha {dateNumber}" + lock/paid icons; betAmount is NOT displayed today. Natural place to show updated per-date amounts once `betAmount` is added to the admin DTO.

9. **API client** — `client/src/api/admin-api.ts`
   - `updateConfig(payload: UpdateConfigPayload): Promise<AdminConfigDTO>` → `client.patch<{ config: AdminConfigDTO }>('/admin/config', payload).then(r => r.data.config)`. Return type discards any new propagation payload; must be widened (e.g. `ConfigUpdateResult`).

10. **Test commands** (exact)
    - Server: `pnpm test` (vitest run), `pnpm lint` (tsc --noEmit), `pnpm build` (tsc) — run in `server/`.
    - Client: `pnpm test`, `pnpm lint` (tsc --noEmit), `pnpm build` (tsc && vite build) — run in `client/`.
    - Root: `pnpm --recursive run lint` / `build`; no root test script (tests run per-package).

11. **Specs to amend**
    - `openspec/specs/admin-operations/spec.md` — Requirement "System Configuration" (line 71): add defaultBetAmount propagation scenarios.
    - `openspec/specs/system-config/spec.md` — Requirements "Config Update Persists" and "Default Bet Amount in Cents": document propagation semantics.
    - `openspec/specs/tournament-management/spec.md` — Requirement "Create Tournament Date": unchanged behavior (snapshot at creation), but cross-referenced.
    - `date-history` spec: unaffected.

## Approaches

1. **Extend `UpdateConfigUseCase` in place** — add optional `tournamentRepo`/`ticketRepo` deps; when `key === 'defaultBetAmount'`, run propagation before returning.
   - Pros: single use case, route change minimal; existing tests keep passing (new deps optional).
   - Cons: use case grows two responsibilities; config validation + propagation coupling.
   - Effort: Low-Medium.

2. **New `PropagateBetAmountUseCase` composed by the route** — keep `UpdateConfigUseCase` pure; route (or a small orchestrator) calls config update, then propagation when key matches.
   - Pros: SRP preserved; propagation logic independently testable; config persist guaranteed before/independent of date updates (requirement 3).
   - Cons: route gains orchestration logic (or needs a composite); two use cases to wire.
   - Effort: Medium. **Recommended.**

3. **Strict single transaction (extend `UnitOfWork` with `systemConfigRepo`)** — config upsert + all date updates atomic.
   - Pros: all-or-nothing consistency.
   - Cons: CONTRADICTS requirement 3 (config MUST always persist even when dates block); needs `TransactionRepos` + `DrizzleUnitOfWork` changes and a `findOpenMatchDatesForUpdate`; race-guard overkill for a single-admin panel.
   - Effort: High. **Rejected** for this change; document as future hardening.

### Grouped vs per-date success messages

- **Grouped success** (one line, e.g. "Exito: se modificó el monto de la apuesta en las fechas 45, 46") scales if multiple open dates ever exist and keeps ConfigPanel compact; loses per-date granularity.
- **Per-date success** matches the requested example ("Exito: ... fecha 46") and the existing per-date error message pattern, but can flood the panel when many dates are open.
- **Recommendation**: server returns structured arrays (`updatedDates`, `blockedDates`); UI shows ONE grouped success line when ≥1 updated, and ONE error line PER blocked date (blocked dates need individual attention with their date number). Error wording follows the request's example; both surfaces live in ConfigPanel under the bet-amount field.

## Recommendation

Approach 2 (new `PropagateBetAmountUseCase` / `PropagateBetAmountResult`), invoked from the config route only when `key === 'defaultBetAmount'`, with `findOpenMatchDates()` + `countByMatchDateId()` per date + `updateMatchDate` for ticket-free dates. Add `MatchDate.withBetAmount(Money)` following the `withPozo` immutable pattern. Extend the config PATCH response to `{ config, updatedDates, blockedDates }`; widen client `updateConfig` return type; add `betAmount` to the admin `TournamentDateDTO`; invalidate `['admin','tournaments']` alongside `['admin','config']` in `useUpdateConfig`. Config upsert runs BEFORE/independently of date propagation (requirement 3: config always saves).

## Risks

- **Race**: a bet placed between ticket-count check and date update — low risk (single admin, per-tournament single open date); note `findMatchDateByIdForUpdate` as future hardening if needed.
- **Response shape change** is a breaking client contract for `updateConfig` — must update `admin-api.ts` return type and any consumers (only ConfigPanel today).
- **Stale UI**: without the extra query invalidation, Partidos shows outdated betAmount after propagation.
- **Entity mutation gap**: forgetting `withBetAmount` blocks the whole change (persistence is ready; domain API is not).
- **Message wording** must match the requested Spanish examples exactly (verify in proposal/spec phase with user).

## Ready for Proposal

Yes — scope, ports, response shape, and test strategy are all identified. Orchestrator should confirm: (a) grouped vs per-date success message wording, (b) whether the admin date DTO should expose `betAmount` (recommended yes), (c) whether propagation should write an `audit_log` entry (recommended out of scope; table has no date entity ref).
