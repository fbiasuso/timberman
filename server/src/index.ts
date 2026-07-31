import Fastify from 'fastify';
import cors from '@fastify/cors';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from './config/env.js';
import { JwtServiceImpl } from './infrastructure/auth/jwt-service.js';
import { BcryptServiceImpl } from './infrastructure/auth/bcrypt-service.js';
import { DrizzleUserRepo } from './infrastructure/repositories/drizzle-user-repo.js';
import { DrizzleTournamentRepo } from './infrastructure/repositories/drizzle-tournament-repo.js';
import { DrizzleMatchRepo } from './infrastructure/repositories/drizzle-match-repo.js';
import { DrizzleTicketRepo } from './infrastructure/repositories/drizzle-ticket-repo.js';
import { DrizzleAuditLogRepo } from './infrastructure/repositories/drizzle-audit-log-repo.js';
import { createRouter } from './infrastructure/http/routes/router.js';
import { errorHandler } from './infrastructure/http/middlewares/error-handler.js';
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
const matchRepo = new DrizzleMatchRepo(db);
const ticketRepo = new DrizzleTicketRepo(db);
const auditLogRepo = new DrizzleAuditLogRepo(db);
const jwtService = new JwtServiceImpl();
const bcryptService = new BcryptServiceImpl();
const allowRegistration = true;

// ── System Config (mutable — updated via admin panel) ────────────
const config: SystemConfig = {
  commission: 15.0,
  allowRegistration: true,
  defaultBetAmount: 1500, // cents = $15
};

// ── Routes ───────────────────────────────────────────────────────
await app.register(createRouter(
  userRepo,
  tournamentRepo,
  matchRepo,
  ticketRepo,
  jwtService,
  bcryptService,
  allowRegistration,
  auditLogRepo,
  config,
));

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
