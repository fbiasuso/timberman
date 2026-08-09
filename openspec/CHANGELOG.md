# Changelog

## 2026-08-09 — teams-leagues

Archived change: Teams & Leagues (Phase 1) on branch `feature/teams-leagues`.

### Features

- **Leagues + teams registry (M2M)**: `leagues` and `teams` entities with many-to-many `team_leagues` memberships; normalized-unique league and team names (global for teams) with 409 collisions; guarded deletes (league with memberships, team referenced by matches); team autocomplete per league.
- **Self-hosted team logos**: download → magic-byte validation (PNG/JPEG/WebP, 1 MiB cap) → store under `public/logos/`; served via `@fastify/static` with ~30d cache; DB stores relative paths only; failures never block team creation (null logo); manual URL fallback retained.
- **Admin Equipos tab**: league create/edit/delete and team create/edit/delete with league multi-select memberships; blocked deletes and last-membership errors surfaced in the UI.
- **Match form team selection**: AddMatchForm and MatchRow editable rows use a UI-only league selector + team autocomplete; picking a team fills name, auto-fills the shield, and submits `localTeamId`/`visitorTeamId`; free text removed from create/edit; legacy string-only matches keep rendering and editing (nullable FKs, strings remain display source of truth).
- **Seed**: real Primera A + Primera B (Nacional) rosters with aliases and memberships; idempotent re-run; shield download failures skip gracefully.

### Scope

Server + client (both fully implemented and verified). Out of scope for Phase 1: API-FOOTBALL fixture ingestion and multi-league match dates (Phase 2).

### Verification

- Server: 475 tests passed (34 files), `tsc --noEmit` clean.
- Client: 253 tests passed (18 files), `tsc --noEmit` clean, `pnpm build` clean.
- Verdict: PASS — zero CRITICAL/WARNING issues; 2 PARTIAL items are test-coverage refinements only.
