# Archive Report: Refactor Timberman to Hexagonal Architecture

**Change**: refactor-hexagonal
**Archived at**: 2026-07-30
**Status**: ✅ Complete — all 7 phases implemented, 138 tests passing

---

## Change Summary

Migrated from a monolithic 1393-line HTML+JS+localStorage betting pool app to a production-ready full-stack application with clean hexagonal architecture. The original single-file app (`index.html`) was replaced by a modern client-server architecture with full separation of concerns — domain never depends on infrastructure.

### What Changed

| Before | After |
|--------|-------|
| Single `index.html` with vanilla JS + localStorage | React + Vite + TypeScript frontend |
| Data in localStorage (unsustainable for multi-user) | PostgreSQL via Drizzle ORM |
| Auth via hardcoded admin password | JWT + bcrypt with full auth flow |
| Business logic mixed with UI rendering | Hexagonal architecture: Domain / Application / Infrastructure layers |
| No tests | 138 tests (unit + integration + API + frontend) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT (React)                     │
│  React Router → Pages → TanStack Query ←→ Zustand   │
│                          │                           │
│                     HTTP/REST                         │
├─────────────────────────────────────────────────────┤
│                  SERVER (Fastify)                     │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Infrastructure Layer                            │ │
│  │  Routes → Middlewares (JWT, Admin) → Error Hdlr │ │
│  │  Drizzle Repos    JWT/Bcrypt Srv    DB Conn     │ │
│  └────────────┬────────────────────────────────────┘ │
│               │ (depends on ports/interfaces)         │
│  ┌────────────┴────────────────────────────────────┐ │
│  │  Application Layer                               │ │
│  │  Use Cases (auth, betting, tournament, ranking)  │ │
│  │  → orchestrates domain entities + repos          │ │
│  └────────────┬────────────────────────────────────┘ │
│               │ (depends on interfaces)               │
│  ┌────────────┴────────────────────────────────────┐ │
│  │  Domain Layer (ZERO infrastructure deps)         │ │
│  │  Entities: User, Tournament, MatchDate, Match,   │ │
│  │    Ticket                                         │ │
│  │  Value Objects: Prediction, Money, Commission     │ │
│  │  Ports: UserRepo, TicketRepo, MatchRepo, etc.    │ │
│  └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│                   PostgreSQL                           │
│        (via Drizzle ORM, containerized dev)           │
└─────────────────────────────────────────────────────┘
```

**Dependency rule**: Domain → nothing. Application → Domain interfaces only. Infrastructure → Application + Domain.

---

## Stats

| Metric | Value |
|--------|-------|
| Files created (server) | ~40+ (entities, use cases, repos, routes, middlewares) |
| Files created (client) | ~25+ (pages, components, hooks, stores, API) |
| Database tables | 7 (users, tournaments, match_dates, matches, tickets, ticket_predictions, audit_logs) |
| Use cases implemented | 10+ (register, login, place-bet, create-date, close-date, publish-results, get-ranking, manage-users, adjust-balance, config) |
| API endpoints | 20+ REST endpoints |
| Tests | 138 (unit + integration + API inject + frontend) |
| Pull Requests | 5 (chained: Foundation → Domain+Auth → Betting+Tournament → Ranking+Admin → Tests+Polish) |
| Total implementation time | Phase 1-7 across 5 PRs |

---

## Source of Truth Specs

The following main specs now reflect the new behavior:

| Domain | Path | Requirements |
|--------|------|-------------|
| User Auth | `openspec/specs/user-auth/spec.md` | Registration, Login, JWT validation, Admin toggle |
| Betting Engine | `openspec/specs/betting-engine/spec.md` | Place bet, Validation, Immutability, Pozo calc, Commission |
| Tournament Management | `openspec/specs/tournament-management/spec.md` | Date lifecycle, Match results, Historical preservation |
| Ranking Calculation | `openspec/specs/ranking-calculation/spec.md` | Points calculation, Global ranking, Tie-breaking |
| Admin Operations | `openspec/specs/admin-operations/spec.md` | Authorization, User management, Balance, Config |

All 5 specs were copied as full specs (no delta merge needed — the main specs directory was empty).

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo | pnpm workspaces | Faster, stricter dep management, native workspace protocol |
| DB access | Drizzle ORM | Type-safe SQL, no code gen, lighter than Prisma |
| Server state | TanStack Query | Best caching, dedup, background refetch for real-time-ish betting |
| Bet slip state | Zustand | Minimal, no boilerplate for local-only temp state |
| Auth hashing | bcrypt | Sufficient for betting pool, simple Node.js native API |
| Ticket-to-match relation | join table (ticket_predictions) | Relational integrity, queryable, audit trail |
| Delivery strategy | Chained PRs (stacked-to-main) | 5 PRs to stay under 400-line review budget |
| Testing approach | Vitest + Fastify inject() | Full coverage: pure domain, mocked use cases, HTTP-level API, frontend components |

---

## Migration Notes

The original `index.html` was renamed to `index.legacy.html` and preserved in the repository root as a rollback reference.

### Data Migration

1. Use the existing localStorage export feature in the original app to create a JSON backup
2. Run `server/scripts/seed-from-json.ts` to import the backup into PostgreSQL
3. Run `server/scripts/seed-dev.ts` for dev/test seed data (2 users, tournament, 5 matches, 2 tickets)

### Environment Setup

```
cp .env.example .env
docker compose up -d          # Start PostgreSQL
pnpm install                  # Install all workspace dependencies
pnpm --filter server dev      # Start dev server
pnpm --filter client dev      # Start dev client
```

---

## Rollback Instructions

If the new system has critical issues:

1. Stop the server and client dev servers
2. Delete (or move aside) the `server/` and `client/` directories
3. Restore `index.legacy.html` → `index.html`
4. The original single-file app works with localStorage — no database needed
5. Downgrade `package.json` root and `pnpm-workspace.yaml` to pre-refactor state

> **Note**: Rollback loses multi-user data in PostgreSQL. Backup the DB first if needed: `docker compose exec db pg_dump -U postgres timberman > backup.sql`

---

## Verification

- All 7 phases implemented with all tasks marked complete
- 138 tests passing across all layers
- Full integration flow verified: login → cartelera → place bet → ranking → admin
- Original app preserved as `index.legacy.html`
- Seed scripts available for data migration and dev setup

---

## Engram Artifacts

This archive report was persisted to Engram as `sdd/refactor-hexagonal/archive-report`.
