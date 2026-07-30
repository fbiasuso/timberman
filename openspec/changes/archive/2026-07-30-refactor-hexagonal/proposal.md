# Proposal: Refactor Timberman to Hexagonal Architecture

## Intent

Migrate from a monolithic 1393-line HTML+JS+localStorage betting pool app to a production-ready client-server architecture with clean separation of concerns. The current code mixes UI rendering, business logic, auth, and storage in one file — unsustainable for multiple users, real money, and future features.

## Scope

### In Scope
- Full backend with Fastify + TypeScript + Drizzle + PostgreSQL
- Hexagonal architecture: domain entities, value objects, repository ports, use cases, infrastructure adapters
- Frontend with React + Vite + TypeScript consuming REST API
- Auth with JWT + bcrypt, persistent sessions, user self-registration with optional admin-only mode
- All original features: cartelera, ticket history, ranking, admin panel, PDF tickets
- Tournament lifecycle: create dates, set results, close tournaments, start new ones with preserved history
- Configurable bet amount per tournament date
- Pozo calculation: (bets × bet amount) × commission percentage

### Out of Scope
- Real payment gateway integration
- Email notifications
- Mobile native app
- Multi-language support

## Capabilities

### New Capabilities
- `user-auth`: User registration, login, JWT session management, admin-only registration mode toggle
- `betting-engine`: Bet placement, validation, pozo calculation with configurable commission
- `tournament-management`: Tournament date CRUD, lifecycle, historical preservation
- `ranking-calculation`: Points leaderboard with per-tournament breakdown
- `admin-operations`: User management, balance adjustments, match results entry, system config

### Modified Capabilities
- None — this is a ground-up rewrite

## Approach

1. Set up monorepo with npm workspaces: `server/` and `client/`
2. Backend: domain entities first, then repository ports, then application use cases, then infrastructure (Postgres repos, JWT auth, Fastify routes)
3. Frontend: React components per feature, TanStack Query for server state, Zustand only for local bet slip
4. Docker Compose for PostgreSQL in development
5. Gradual data migration from localStorage export to PostgreSQL seed

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `index.html` | Removed | Entire file replaced by client + server |
| `server/src/` | New | Full hexagonal backend |
| `client/src/` | New | React frontend |
| `docker-compose.yml` | New | PostgreSQL dev environment |
| `package.json` (root) | New | npm workspaces config |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Data loss during migration | Low | Export localStorage first, test migration script on copy |
| Feature parity miss | Medium | Feature-by-feature comparison against original behavior |
| Learning curve for hexagonal | Low | User requested it; standard DDD patterns |

## Rollback Plan

Keep the original `index.html` as `index.legacy.html`. If the new system has critical issues, delete `server/` and `client/`, restore `index.legacy.html` to `index.html`.

## Dependencies

- Node.js 20+
- Docker Desktop or PostgreSQL 16 local
- npm workspaces compatible (npm 9+)

## Success Criteria

- [ ] Backend hexagonal architecture with ports/adapters: domain never depends on infrastructure
- [ ] All original features work via React frontend consuming REST API
- [ ] PostgreSQL replaces localStorage: all data survives page refresh and server restart
- [ ] JWT auth with hashed passwords; both self-registration and admin-only modes work
- [ ] Bet slip state in Zustand survives navigation; all other state managed by TanStack Query
- [ ] Tournament dates can be created, closed, and new ones started with full history preserved