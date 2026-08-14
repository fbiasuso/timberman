# Timberman — Project Spec

## Overview

Full-stack betting pool (prode) application: React + Vite + TypeScript client, Fastify + TypeScript + Drizzle + PostgreSQL server on a hexagonal architecture. JWT auth, admin panel, match scheduling, bet placement, points calculation, ranking, PDF tickets, and a leagues + teams registry.

## Capabilities

- `admin-operations`: Admin functions — user management, balance adjustments, match results entry, system configuration, Partidos date accordion with match editing, Equipos tab for league/team registry CRUD, tournament lifecycle UI, team shield upload via native file picker (preview + client-side validation).
- `android-apk-distribution`: Capacitor 8 WebView shell (appId `com.timberman.prode`, committed `client/android/`), hardware back-button navigation, signed release APK pipeline via GitHub Actions (keystore from secrets, HTTPS `VITE_API_URL` at build), central app-version constant, and a Netlify `/install` sideload page.
- `betting-engine`: Bet placement, validation, pozo (prize pool) calculation, and commission configuration.
- `date-history`: Read-only access to historical tournament dates and matches with server-side sanitization of unpublished results.
- `prize-payouts`: Winner determination, equal pozo split, balance credits, unpaid-pozo carryover, and payout visibility.
- `ranking-calculation`: Points leaderboard with per-tournament breakdown and historical ranking.
- `system-config`: Persisted system-wide configuration (commission rate, registration mode, default bet amount).
- `team-image-hosting`: Durable team shield pipeline — shared validated write path (magic-byte sniff PNG/JPEG/WebP, 1 MiB cap) storing through an active backend (`local` static `public/logos/` with long-lived cache, default; or Supabase public bucket `logos` with cache-control 30d, opt-in via `IMAGE_STORAGE`); `storeFromBuffer` port; multipart upload and URL fallback both accepted; idempotent `seed-shields` population script (Wikimedia → TheSportsDB).
- `team-registry`: Leagues and teams registry — CRUD with normalized-unique names, many-to-many league memberships, guarded deletes, team autocomplete, shield logo upload endpoint (multipart + JSON `{url}`), seeded Primera A/B rosters.
- `tournament-management`: Tournament date lifecycle (open → closed → results-published), match creation/editing with team-id enrichment, status model, terminate/archive, carryover.
- `user-auth`: User registration, login, JWT session management, and admin-only registration mode.
