# Design: Refactor Timberman to Hexagonal Architecture

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

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Monorepo | pnpm workspaces | Turborepo, Nx | pnpm is faster, stricter dep management, native workspace protocol. Root `pnpm-workspace.yaml` with `packages: ['server', 'client']` |
| DB access | Drizzle ORM | Prisma, TypeORM | Type-safe SQL, lighter weight, no code gen, same TS-native stack |
| Server state | TanStack Query | RTK Query, SWR | Best-in-class caching, dedup, background refetch — essential for real-time-ish betting |
| Bet slip | Zustand | Redux, Context | Only local temp state before payment; Zustand is minimal, no boilerplate |
| Auth hashing | bcrypt | argon2, scrypt | Node.js native support, sufficient for betting pool security, simple API |
| Ticket to match | join table (ticket_predictions) | JSON column | Relational integrity, queryable (who bet what on a match), audit trail |

## Domain Model

```
User ───1:N──→ Ticket ───1:N──→ TicketPrediction ──N:1──→ Match
  │               │                                           │
  │               └──N:1──→ MatchDate ──1:N────────────────────┘
  │                           │
  │                     N:1──→ Tournament
  │
  └──1:N──→ AuditLog
```

**Entities**: User (id, username, passwordHash, role, balance, createdAt), Tournament (id, name, commission, isActive, createdAt), MatchDate (id, tournamentId, dateNumber, status, pozo, betAmount, createdAt), Match (id, matchDateId, localTeam, visitorTeam, localImg, visitorImg, scheduledAt, result, score), Ticket (id, userId, matchDateId, betAmount, createdAt), TicketPrediction (id, ticketId, matchId, prediction), AuditLog (id, adminId, userId, action, amount, reason, createdAt)

**Value Objects**: Prediction = 'L'|'E'|'V' (union type), Money = number (cents), Commission = number (0-100 percentage)

## Component Architecture

```
React Router:
  /login          → LoginPage
  /               → ProtectedRoute → NavTabs → CarteleraPage (default)
  /tickets        → TicketsPage
  /ranking        → RankingPage
  /admin          → AdminProtectedRoute → AdminPage (tabs: matches | results | system)

Component Tree:
  App
  ├── LoginPage
  └── AppShell (authenticated)
      ├── Header (user bar, balance, logout)
      ├── NavTabs (cartelera | tickets | ranking)
      └── <Outlet>
          ├── CarteleraPage
          │   ├── Filters (search + pills)
          │   └── MatchCard[] → BetButtons (L/E/V)
          ├── TicketsPage
          │   ├── DateFilter
          │   └── TicketCard[] (match predictions + status)
          ├── RankingPage
          │   └── RankingRow[] (expand → per-date breakdown)
          └── AdminPage
              ├── MatchEditor (match CRUD per date)
              ├── ResultsEntry (result select + close date)
              ├── UserManager (list, create, balance adjust, delete)
              └── ConfigPanel (commission, reg mode toggle)
```

## API Contract

### Auth
| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/api/auth/register` | - | `{username, password}` | `{user: {id, username}}` — 201 |
| POST | `/api/auth/login` | - | `{username, password}` | `{token, user: {id, username, role}}` |
| GET | `/api/auth/me` | JWT | - | `{id, username, role, balance}` |

### Matches
| Method | Path | Auth | Query | Response |
|--------|------|------|-------|----------|
| GET | `/api/matches/current` | JWT | - | `{matchDate, matches[]}` |
| GET | `/api/matches/dates` | JWT | - | `{dates[]}` — all match dates with summary |
| GET | `/api/matches/dates/:id` | JWT | - | Full date with matches and pozo |

### Bets
| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/api/bets` | JWT | `{matchDateId, predictions: {matchId: Prediction}}` | Ticket created — 201 |
| GET | `/api/bets` | JWT | `?matchDateId=` | User's tickets |
| GET | `/api/bets/:id` | JWT | - | Single ticket detail |

### Ranking
| Method | Path | Auth | Query | Response |
|--------|------|------|-------|----------|
| GET | `/api/ranking` | JWT | `?tournamentId=` | Sorted ranking with position |
| GET | `/api/ranking/global` | JWT | - | All-tournament cumulative ranking |
| GET | `/api/ranking/users/:id` | JWT | - | Per-user breakdown per date |

### Admin
| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| GET | `/api/admin/users` | JWT+Admin | - | All users (no passwords) |
| POST | `/api/admin/users` | JWT+Admin | `{username, password, balance?}` | Created user |
| PATCH | `/api/admin/users/:id/balance` | JWT+Admin | `{amount, reason}` | Updated user |
| DELETE | `/api/admin/users/:id` | JWT+Admin | - | 204 |
| GET | `/api/admin/tournaments` | JWT+Admin | - | All tournaments |
| POST | `/api/admin/tournaments` | JWT+Admin | `{name, commission?, betAmount?}` | Created tournament |
| POST | `/api/admin/tournaments/:id/dates` | JWT+Admin | `{dateNumber, betAmount?}` | Created match date |
| PATCH | `/api/admin/matches/:id/result` | JWT+Admin | `{result, score?}` | Updated match — triggers points |
| POST | `/api/admin/dates/:id/close` | JWT+Admin | - | Closes date, calculates pozo |
| GET | `/api/admin/config` | JWT+Admin | - | Config key-value pairs |
| PATCH | `/api/admin/config` | JWT+Admin | `{key, value}` | Updated config |

## Data Model (Drizzle Schema)

```typescript
// server/src/infrastructure/db/schema.ts

const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: text('username').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['user', 'admin'] }).default('user').notNull(),
  balance: integer('balance').default(0).notNull(),  // cents
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

const tournaments = pgTable('tournaments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  commission: numeric('commission', { precision: 5, scale: 2 }).default('15.00').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

const matchDates = pgTable('match_dates', {
  id: serial('id').primaryKey(),
  tournamentId: integer('tournament_id').references(() => tournaments.id),
  dateNumber: integer('date_number').notNull(),
  status: text('status', { enum: ['open', 'closed', 'results'] }).default('open').notNull(),
  pozo: integer('pozo').default(0).notNull(),
  betAmount: integer('bet_amount').default(1500).notNull(),  // cents
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  matchDateId: integer('match_date_id').references(() => matchDates.id).notNull(),
  localTeam: text('local_team').notNull(),
  visitorTeam: text('visitor_team').notNull(),
  localImg: text('local_img'),
  visitorImg: text('visitor_img'),
  scheduledAt: timestamp('scheduled_at'),
  result: text('result', { enum: ['L', 'E', 'V'] }),
  score: text('score'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

const tickets = pgTable('tickets', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  matchDateId: integer('match_date_id').references(() => matchDates.id).notNull(),
  betAmount: integer('bet_amount').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

const ticketPredictions = pgTable('ticket_predictions', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id').references(() => tickets.id).notNull(),
  matchId: integer('match_id').references(() => matches.id).notNull(),
  prediction: text('prediction', { enum: ['L', 'E', 'V'] }).notNull(),
});

const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  adminId: uuid('admin_id').references(() => users.id).notNull(),
  userId: uuid('user_id').references(() => users.id),
  action: text('action').notNull(),
  amount: integer('amount'),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Indexes
createIndex('idx_tickets_user_date').on(tickets, tickets.userId, tickets.matchDateId);
createIndex('idx_predictions_ticket').on(ticketPredictions, ticketPredictions.ticketId);
createIndex('idx_matches_date').on(matches, matches.matchDateId);
createIndex('idx_match_dates_tournament').on(matchDates, matchDates.tournamentId);
createIndex('idx_audit_admin').on(auditLogs, auditLogs.adminId);
```

## Data Flow: Place Bet (end-to-end)

```
User clicks L/E/V → Zustand betSlipStore.setPrediction(matchId, pred)
User clicks "Pagar" → CarteleraPage calls placeBet mutation
  → useMutation via TanStack Query
  → POST /api/bets { matchDateId, predictions }
  → Fastify route → authMiddleware (decode JWT, attach req.user)
  → PlaceBetUseCase.execute({ userId, matchDateId, predictions })

Use case orchestrates:
  1. Repo.getMatchDate(id) → check status === 'open'
  2. Repo.getUser(id) → check balance >= betAmount
  3. Repo.getMatchesByDate(id) → validate all matches have predictions
  4. Repo.findTicketByUserAndDate(userId, dateId) → ensure no duplicate
  5. Ticket.create(userId, dateId, predictions, betAmount) [domain entity]
  6. User.deductBalance(betAmount) [domain entity method]
  7. Repo.saveTicket(ticket) + Repo.updateUser(user) [transaction]
  8. Return TicketDTO

  → Response 201 with ticket
  → TanStack Query invalidates: ['matches'], ['user', userId]
  → Zustand betSlipStore.reset()
  → UI shows TicketModal (with PDF download)
```

## Auth Flow

```
Registration: 
  POST /api/auth/register → check admin-only mode → bcrypt.hash(password, 10)
  → UserRepo.create({ username, passwordHash: hash, role: 'user' })

Login:
  POST /api/auth/login → findUser(username) → bcrypt.compare(password, hash)
  → generate JWT { sub: user.id, role: user.role, username: user.username }
  → expiresIn: process.env.JWT_EXPIRES_IN (default '7d')

Middleware chain (protected routes):
  Request → [AuthMiddleware: extract Bearer, jwt.verify(), attach req.user]
  → [AdminMiddleware: check req.user.role === 'admin'] (admin routes only)
  → Route handler

Config: JWT_SECRET from env, JWT_EXPIRES_IN configurable, admin-only mode toggle 
  from config table
```

## File Structure

```
timberman/
├── package.json                    # root scripts only
├── pnpm-workspace.yaml             # packages: ['server', 'client']
├── docker-compose.yml              # PostgreSQL + pgAdmin
├── .env.example
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── drizzle.config.ts
│   └── src/
│       ├── index.ts                # Fastify bootstrap
│       ├── config/env.ts
│       ├── domain/
│       │   ├── entities/           # user, tournament, match-date, match, ticket
│       │   ├── value-objects/      # prediction, money, commission
│       │   ├── ports/              # user-repo, ticket-repo, match-repo, etc.
│       │   └── errors/             # domain-error.ts
│       ├── application/
│       │   ├── auth/               # register, login, auth-service
│       │   ├── betting/            # place-bet, pozo-calculator, points-calculator
│       │   ├── tournament/         # create-date, close-date, publish-results
│       │   ├── ranking/            # get-ranking
│       │   └── admin/              # manage-users, adjust-balance, config
│       ├── infrastructure/
│       │   ├── db/                 # schema.ts, connection.ts, migrations/
│       │   ├── repositories/       # drizzle-{user,tournament,match,ticket,audit}-repo
│       │   ├── auth/               # jwt-service, bcrypt-service
│       │   └── http/
│       │       ├── routes/         # auth, match, bet, ranking, admin
│       │       ├── middlewares/    # auth-middleware, admin-middleware
│       │       └── errors/         # error-handler
│       └── shared/                 # types.ts, dto schemas
└── client/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api/                    # client.ts, {auth, match, bet, ranking, admin}-api.ts
        ├── stores/                 # bet-slip-store.ts (Zustand)
        ├── hooks/                  # use-{auth, matches, bets, ranking, admin}
        ├── components/
        │   ├── layout/             # Header, NavTabs, Footer
        │   ├── auth/               # LoginPage, ProtectedRoute
        │   ├── matches/            # CarteleraPage, MatchCard, BetButtons, Filters
        │   ├── bets/               # TicketsPage, TicketCard, TicketModal
        │   ├── ranking/            # RankingPage, RankingRow
        │   └── admin/             # AdminPage, MatchEditor, ResultsEntry, UserManager, ConfigPanel
        ├── types/                  # index.ts (shared TS types)
        └── utils/                  # format.ts (currency, date, etc.)
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Domain | Entities + value objects pure logic | Vitest, no infrastructure deps. Test entity constructors, invariants, balance deduction |
| Application | Use case orchestration | Vitest + mocked repo ports. Test success + error paths per spec scenario |
| Infrastructure | Drizzle repos + JWT/bcrypt | Integration tests with testcontainers or in-memory SQLite (Drizzle supports both) |
| API | Routes + middlewares | Fastify `inject()` method — fast HTTP-level tests without network |
| Frontend | Components + hooks | Vitest + React Testing Library. Mock TanStack Query hooks |

## Migration / Rollout

No migration — this is a greenfield replacement. Data from localStorage will be exported via the existing backup feature and imported into PostgreSQL via a one-time seed script (`server/scripts/seed-from-json.ts`). Old `index.html` preserved as `index.legacy.html` per rollback plan.

## Open Questions

None resolved now — all spec requirements are covered in this design.
