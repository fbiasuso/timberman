import Fastify from 'fastify';
import cors from '@fastify/cors';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from './config/env.js';
import { JwtServiceImpl } from './infrastructure/auth/jwt-service.js';
import { BcryptServiceImpl } from './infrastructure/auth/bcrypt-service.js';
import { DrizzleUserRepo } from './infrastructure/repositories/drizzle-user-repo.js';
import { DrizzleTournamentRepo } from './infrastructure/repositories/drizzle-tournament-repo.js';
import { DrizzleTournamentPointsRepo } from './infrastructure/repositories/drizzle-tournament-points-repo.js';
import { DrizzleMatchRepo } from './infrastructure/repositories/drizzle-match-repo.js';
import { DrizzleTicketRepo } from './infrastructure/repositories/drizzle-ticket-repo.js';
import { DrizzleAuditLogRepo } from './infrastructure/repositories/drizzle-audit-log-repo.js';
import { DrizzleSystemConfigRepo } from './infrastructure/repositories/drizzle-system-config-repo.js';
import { DrizzleLeagueRepo } from './infrastructure/repositories/drizzle-league-repo.js';
import { DrizzleTeamRepo } from './infrastructure/repositories/drizzle-team-repo.js';
import { DrizzleUnitOfWork } from './infrastructure/persistence/drizzle-unit-of-work.js';
import { ensureInitialTournament } from './infrastructure/bootstrap.js';
import { createRouter } from './infrastructure/http/routes/router.js';
import { errorHandler } from './infrastructure/http/middlewares/error-handler.js';
import { DEFAULT_SYSTEM_CONFIG } from './domain/entities/system-config.js';
import type { SystemConfig } from './domain/entities/system-config.js';

const app = Fastify({ logger: true });

// ── Plugins ──────────────────────────────────────────────────────
await app.register(cors, { origin: true });

// ── Error Handler ─────────────────────────────────────────────────
app.setErrorHandler(errorHandler);

// ── Infrastructure ───────────────────────────────────────────────
const queryClient = postgres(env.DATABASE_URL);
const db = drizzle(queryClient);

const userRepo = new DrizzleUserRepo(db);
const tournamentRepo = new DrizzleTournamentRepo(db);
const tournamentPointsRepo = new DrizzleTournamentPointsRepo(db);
const matchRepo = new DrizzleMatchRepo(db);
const ticketRepo = new DrizzleTicketRepo(db);
const auditLogRepo = new DrizzleAuditLogRepo(db);
const systemConfigRepo = new DrizzleSystemConfigRepo(db);
const leagueRepo = new DrizzleLeagueRepo(db);
const teamRepo = new DrizzleTeamRepo(db);
const jwtService = new JwtServiceImpl();
const bcryptService = new BcryptServiceImpl();

// ── Transaction boundary (financial flows: close + publish results) ──
// Repos are rebuilt bound to the transaction client inside the callback,
// so every write in those flows is atomic and rolls back on failure.
const uow = new DrizzleUnitOfWork(db, {
  tournamentRepo: (tx) => new DrizzleTournamentRepo(tx),
  tournamentPointsRepo: (tx) => new DrizzleTournamentPointsRepo(tx),
  matchRepo: (tx) => new DrizzleMatchRepo(tx),
  ticketRepo: (tx) => new DrizzleTicketRepo(tx),
  userRepo: (tx) => new DrizzleUserRepo(tx),
  auditLogRepo: (tx) => new DrizzleAuditLogRepo(tx),
});

// ── System Config (persisted single row, live-loaded at boot) ────
// Load the persisted config; when no row exists yet, seed the built-in
// defaults so databases created before the system_config table work.
let config: SystemConfig;
try {
  const persisted = await systemConfigRepo.get();
  if (persisted) {
    config = persisted;
  } else {
    config = { ...DEFAULT_SYSTEM_CONFIG };
    await systemConfigRepo.upsert(config);
  }
} catch (err) {
  app.log.error({ err }, 'Failed to load system config at boot');
  process.exit(1);
}

// ── Routes ───────────────────────────────────────────────────────
await app.register(createRouter(
  userRepo,
  tournamentRepo,
  matchRepo,
  ticketRepo,
  jwtService,
  bcryptService,
  auditLogRepo,
  config,
  systemConfigRepo,
  tournamentPointsRepo,
  leagueRepo,
  teamRepo,
  uow,
));

// ── Boot: ensure an active tournament exists ─────────────────────
// A fresh database has no tournament; every active flow (ranking,
// matches, propagation) depends on one. Auto-create "Torneo 1" when the
// table is empty — never when a tournament already exists (idempotent).
// The app cannot operate without a tournament, so fail fast on error.
try {
  await ensureInitialTournament(tournamentRepo, config.commission);
} catch (err) {
  app.log.error({ err }, 'Failed to ensure initial tournament at boot');
  process.exit(1);
}

// ── Health check ────────────────────────────────────────────────
app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Start ───────────────────────────────────────────────────────
const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Server listening on http://localhost:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
