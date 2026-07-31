# Timberman

Betting pool (prode) web app: users pick L/E/V outcomes on a match card, pay per ticket, and earn points when results are published. Admins manage tournaments, match dates, results, users, and balances.

## Stack

- **Client**: React 19, Vite, TypeScript, TanStack Query (server state), Zustand (local bet slip)
- **Server**: Fastify 5, TypeScript, Drizzle ORM, PostgreSQL 17
- **Auth**: JWT (persistent sessions) + bcrypt
- **Monorepo**: pnpm workspaces (`server/`, `client/`)

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 17 running locally (see `server/.env` for the connection — that file is gitignored, do not commit real credentials)

## Setup

```bash
pnpm install                  # install all workspace deps
cp .env.example server/.env   # then edit server/.env with your real DB credentials
```

> The server reads its env from `server/.env`. `drizzle.config.ts` also loads it via dotenv, so DB commands work from the package directory.

## Create the database

```bash
psql -U <superuser> -d postgres -c "CREATE DATABASE timberman_dev;"
```

## Database commands

```bash
pnpm --filter server db:push        # push schema to DB (dev)
pnpm --filter server db:generate    # generate a migration from schema changes
pnpm --filter server db:migrate     # apply generated migrations
pnpm --filter server db:studio      # open Drizzle Studio
```

## Seed

```bash
pnpm --filter server seed:dev          # dev data (tournament, users, matches, tickets)
pnpm --filter server seed:from-json    # migrate data from an old localStorage JSON export
```

## Run

```bash
pnpm --recursive dev      # server on :3001 + client on :5173 (Vite proxies /api → :3001)
```

## Test users (seed)

| Role  | Username | Password | Notes               |
|-------|----------|----------|---------------------|
| Admin | `admin`  | `admin77`| Full admin panel    |
| User  | `test`   | `test123`| $150.00 balance, 2 sample tickets |

## Tests

```bash
pnpm --recursive test          # run all (server + client)
pnpm --filter server test      # server only
pnpm --filter client test      # client only
```

## Scripts (server)

| Command | Description |
|---------|-------------|
| `pnpm --filter server dev` | Run server with hot reload (tsx watch) |
| `pnpm --filter server build` | TypeScript compile |
| `pnpm --filter server start` | Run compiled output (`node dist/index.js`) |
| `pnpm --filter server lint` | Type-check only (`tsc --noEmit`) |

## Project structure

```
server/src/
├── domain/          # entities, value objects, repository ports, errors
├── application/     # use cases (auth, betting, tournament, ranking, admin)
└── infrastructure/  # drizzle schema + repos, JWT/bcrypt, Fastify routes/middleware
client/src/
├── api/             # typed API clients
├── hooks/           # TanStack Query hooks
├── stores/          # Zustand stores (auth, bet slip)
└── components/      # feature components (matches, bets, ranking, admin, layout)
```

## API surface

| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Matches | `GET /api/matches/current`, `GET /api/matches/dates` |
| Bets | `POST /api/bets`, `GET /api/bets` |
| Ranking | `GET /api/ranking`, `GET /api/ranking/users/:userId` |
| Admin | `GET|POST /api/admin/users`, `PATCH /api/admin/users/:id/balance`, `DELETE /api/admin/users/:id`, `GET|POST /api/admin/tournaments`, `PATCH /api/admin/matches/:id/result`, `GET|PATCH /api/admin/config`, `POST /api/admin/dates/:id/close` |

## Legacy

The original single-file prototype is preserved at `index.legacy.html` for reference/rollback.
