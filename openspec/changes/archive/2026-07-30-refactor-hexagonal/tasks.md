# Tasks: Refactor Timberman to Hexagonal Architecture

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 4000–6000 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Foundation → PR 2: Domain + Auth → PR 3: Betting + Tournament → PR 4: Ranking + Admin → PR 5: Polish |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Monorepo + DB schema + server scaffold | PR 1 | Base: main. Non-breaking infra only. |
| 2 | Domain layer + Auth (use cases, API, login UI) | PR 2 | Base: main. Depends on DB from PR 1. |
| 3 | Betting engine + Tournament (use cases, API, cartelera/tickets UI) | PR 3 | Base: main. Depends on auth from PR 2. |
| 4 | Ranking + Admin (use cases, API, ranking/admin UI) | PR 4 | Base: main. Depends on PR 3. |
| 5 | Tests + polish + legacy archiving | PR 5 | Base: main. Depends on all above. |

## Phase 1: Monorepo Foundation

- [x] 1.1 Create root `package.json` (workspaces), `pnpm-workspace.yaml`, `docker-compose.yml`, `.env.example`
- [x] 1.2 Scaffold `server/` — `package.json`, `tsconfig.json`, `drizzle.config.ts`, `src/index.ts` (Fastify bootstrap)
- [x] 1.3 Scaffold `client/` — `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`
- [x] 1.4 Write Drizzle schema `server/src/infrastructure/db/schema.ts` — all 7 tables + indexes
- [x] 1.5 Write `server/src/config/env.ts` — env validation (DB, JWT, port)

## Phase 2: Domain Layer

- [x] 2.1 Create domain entities: `User`, `Tournament`, `MatchDate`, `Match`, `Ticket`, `TicketPrediction`, `AuditLog`
- [x] 2.2 Create value objects: `Prediction` (union), `Money` (cents), `Commission` (percentage)
- [x] 2.3 Create domain port interfaces: `UserRepo`, `TournamentRepo`, `MatchRepo`, `TicketRepo`, `AuditLogRepo`
- [x] 2.4 Create domain errors: `DomainError` base + specific subclasses

## Phase 3: Auth (Server + Client)

- [x] 3.1 Implement `RegisterUseCase` + `LoginUseCase` — bcrypt hashing, JWT signing
- [x] 3.2 Implement infrastructure: `JwtService`, `BcryptService`, Drizzle `UserRepo`
- [x] 3.3 Create Fastify auth routes: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- [x] 3.4 Implement `AuthMiddleware` (JWT verify + attach user) + `AdminMiddleware`
- [x] 3.5 Client: `api/client.ts` (axios/fetch wrapper) + `hooks/use-auth.ts` + Zustand `authStore`
- [x] 3.6 Client: `LoginPage` + `ProtectedRoute` + `AppShell` with `Header` + `NavTabs`

## Phase 4: Betting Engine + Tournament (Server + Client)

- [x] 4.1 Implement `PlaceBetUseCase` — validates balance, open date, no duplicates
- [x] 4.2 Implement `PozoCalculator` — (bets × amount) × commission
- [x] 4.3 Implement tournament use cases: `CreateDate`, `CloseDate`, `PublishResults`
- [x] 4.4 Implement Drizzle repos: `MatchRepo`, `TicketRepo`, `TournamentRepo`
- [x] 4.5 Create Fastify match/bet routes + error handler setup
- [x] 4.6 Client: `CarteleraPage` + `MatchCard` + `BetButtons` + `Filters` with TanStack Query
- [x] 4.7 Client: `TicketsPage` + `TicketCard` + `TicketModal` (PDF download placeholder)
- [x] 4.8 Client: Zustand `bet-slip-store` — tracks predictions before payment, resets on submit

## Phase 5: Ranking + Admin (Server + Client)

- [x] 5.1 Implement `GetRankingUseCase` + `GetGlobalRankingUseCase` — sorting, tie-breaking
- [x] 5.2 Implement admin use cases: user management, balance adjustment, config CRUD
- [x] 5.3 Implement Drizzle `AuditLogRepo`
- [x] 5.4 Create Fastify ranking + admin routes
- [x] 5.5 Client: `RankingPage` + `RankingRow` with per-date expand
- [x] 5.6 Client: `AdminPage` tabs — `MatchEditor`, `ResultsEntry`, `UserManager`, `ConfigPanel`

## Phase 6: Testing

- [x] 6.1 Unit tests: domain entities + value objects (pure logic, zero infra)
- [x] 6.2 Unit tests: all use cases with mocked repo ports (success + error scenarios per spec)
- [x] 6.3 API tests: Fastify `inject()` for auth, match, bet, ranking, admin routes
- [x] 6.4 Frontend tests: key components with React Testing Library + mocked TanStack Query

## Phase 7: Cleanup

- [x] 7.1 Rename `index.html` → `index.legacy.html`
- [x] 7.2 Write `server/scripts/seed-from-json.ts` — migrate localStorage export to PostgreSQL
- [x] 7.3 Write `server/scripts/seed-dev.ts` — dev/test seed data (users, matches, tickets)
- [x] 7.4 Final integration check: full flow from login → cartelera → place bet → ranking → admin

---

## Summary

**Refactor Timberman to Hexagonal Architecture — COMPLETE ✅**

All 5 PRs have been implemented and 67 tests are passing. The original single-page app (`index.html`) replaced by a modern hexagonal architecture with:

| Component | Technology |
|-----------|-----------|
| Server | Fastify + Drizzle ORM + PostgreSQL |
| Client | React + TanStack Query + Zustand |
| Auth | JWT + bcrypt |
| Architecture | Hexagonal (Domain / Application / Infrastructure) |
| Testing | Vitest (unit, integration, API) |
| Dev workflow | pnpm workspaces, docker-compose DB, tsx watch |

### What was built

- **PR 1**: Monorepo foundation, DB schema, server scaffold
- **PR 2**: Domain entities/value objects/ports, Auth (register + login + JWT middleware)
- **PR 3**: Betting engine (PlaceBet, PozoCalculator), Tournament use cases, Cartelera/Tickets UI
- **PR 4**: Ranking (global + per-user), Admin panel (users, matches, results, config)
- **PR 5**: 67 tests, seed scripts, legacy archiving

### Deliverables

- `index.legacy.html` — original SPA preserved as rollback reference
- `server/scripts/seed-from-json.ts` — imports localStorage JSON backup into PostgreSQL
- `server/scripts/seed-dev.ts` — creates dev data (2 users, tournament, 5 matches, 2 tickets)
