# Timberman — Project Spec

## Overview

Full-stack betting pool (prode) application: React + Vite + TypeScript client, Fastify + TypeScript + Drizzle + PostgreSQL server on a hexagonal architecture. JWT auth, admin panel, match scheduling, bet placement, points calculation, ranking, PDF tickets, and a leagues + teams registry.

## Capabilities

- `admin-operations`: Admin functions — user management, balance adjustments, match results entry, system configuration, Partidos date accordion with match editing, Equipos tab for league/team registry CRUD, tournament lifecycle UI.
- `betting-engine`: Bet placement, validation, pozo (prize pool) calculation, and commission configuration.
- `date-history`: Read-only access to historical tournament dates and matches with server-side sanitization of unpublished results.
- `prize-payouts`: Winner determination, equal pozo split, balance credits, unpaid-pozo carryover, and payout visibility.
- `ranking-calculation`: Points leaderboard with per-tournament breakdown and historical ranking.
- `system-config`: Persisted system-wide configuration (commission rate, registration mode, default bet amount).
- `team-image-hosting`: Self-hosted team shield pipeline — download, validate, store under `public/logos/`, serve statically with long-lived cache; manual URL fallback retained.
- `team-registry`: Leagues and teams registry — CRUD with normalized-unique names, many-to-many league memberships, guarded deletes, team autocomplete, seeded Primera A/B rosters.
- `tournament-management`: Tournament date lifecycle (open → closed → results-published), match creation/editing with team-id enrichment, status model, terminate/archive, carryover.
- `user-auth`: User registration, login, JWT session management, and admin-only registration mode.
