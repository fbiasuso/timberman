# Timberman

Betting pool (prode) web app: users pick L/E/V outcomes on a match card, pay per ticket, and earn points when results are published. Admins manage tournaments, match dates, results, users, and balances.

## Stack

- **Client**: React 19, Vite, TypeScript, TanStack Query (server state), Zustand (local bet slip)
- **Server**: Fastify 5, TypeScript, Drizzle ORM, PostgreSQL 17
- **Auth**: JWT (persistent sessions) + bcrypt
- **Monorepo**: pnpm workspaces (`server/`, `client/`)

## Prerequisites

- Node.js 22+ (see `.nvmrc` — required by Capacitor 8)
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

## App sections

The app is mobile-first (max-width 480px) and organized into these views:

### Player views (any authenticated user)

| Section | Route | Purpose |
|---------|-------|---------|
| **Cartelera** | `/` | Match card for the active tournament date. Search by team, filter by state (Todos / Pendientes / Cerrados). Pick **L** (local), **E** (empate) or **V** (visita) on each match — selections are kept locally in the bet slip until you pay. Expired matches (date/time passed or result published) are locked. |
| **Mis Tickets** | `/tickets` | Bet history. Filter by tournament date and review each ticket's predictions with status: pending close, in progress (partial results), or finalized with hit count. |
| **Top Ranking** | `/ranking` | Global leaderboard ordered by total points (top 3 get 🥇🥈🥉). Click a row to expand the per-date breakdown (best ticket points per tournament date). |

### Admin views (role `admin` only)

| Section | Tab | Purpose |
|---------|-----|---------|
| **Admin** | Partidos | Edit the active date's matches: team names, shield image URLs, date/time. Save changes for the current tournament date. |
| **Admin** | Resultados | Enter results per match (score + L/E/V outcome) and close the tournament date — closing calculates the pozo and finalizes points. |
| **Admin** | Sistema | User management (create users, adjust balances with audit log, delete users), system config (commission %, self-registration toggle, default bet amount), tournament date management (create/switch/delete dates), and danger-zone resets (points or balances). |

### Shared UI

| Piece | Purpose |
|-------|---------|
| **Header** | Logged-in user, balance, logout. |
| **Pozo** | Prize pool = (tickets × bet amount) − commission, shown for the active date. |
| **Ticket modal / PDF** | Receipt shown after paying a bet, with match predictions and a PDF download. |

## Splash screen logo

The app shows a brief splash on start (dark BET-green background, pulsing **TIMBERMAN** text, yellow spinner). The original `logotipo timberman.png` from the legacy prototype was never committed to the repo, so the splash currently renders the brand as styled text.

To add the real logo later:

1. Copy the PNG to `client/public/logotipo-timberman.png`.
2. In `client/src/components/layout/SplashScreen.tsx`, replace the text logo `<div className="splash-logo">TIMBERMAN</div>` with `<img src="/logotipo-timberman.png" className="splash-logo" alt="TIMBERMAN" />`, and in `client/src/styles/global.css` change the `.splash-logo` rule from `font-size: 2rem; font-weight: 900; ...` to `width: 60%; max-width: 240px;` (keep the `pulse` animation).

The splash timing already matches the legacy: fade-out at ~2.2s, unmount at ~2.8s.

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
