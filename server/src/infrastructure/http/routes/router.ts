import type { FastifyPluginAsync } from 'fastify';
import type { UserRepo } from '../../../domain/ports/user-repo.js';
import type { TournamentRepo } from '../../../domain/ports/tournament-repo.js';
import type { MatchRepo } from '../../../domain/ports/match-repo.js';
import type { TicketRepo } from '../../../domain/ports/ticket-repo.js';
import type { AuditLogRepo } from '../../../domain/ports/audit-log-repo.js';
import type { JwtServiceImpl } from '../../auth/jwt-service.js';
import type { BcryptServiceImpl } from '../../auth/bcrypt-service.js';
import type { SystemConfig } from '../../../application/admin/get-config-use-case.js';
import { createAuthRoutes } from './auth-routes.js';
import { createMatchRoutes } from './match-routes.js';
import { createBetRoutes } from './bet-routes.js';
import { createAdminRoutes } from './admin-routes.js';
import { createRankingRoutes } from './ranking-routes.js';

/**
 * Combines all domain route plugins into one Fastify plugin.
 * Each route group is registered as a scoped Fastify plugin.
 */
export function createRouter(
  userRepo: UserRepo,
  tournamentRepo: TournamentRepo,
  matchRepo: MatchRepo,
  ticketRepo: TicketRepo,
  jwtService: JwtServiceImpl,
  bcryptService: BcryptServiceImpl,
  allowRegistration: boolean,
  auditLogRepo: AuditLogRepo,
  config: SystemConfig,
): FastifyPluginAsync {
  return async (fastify) => {
    await fastify.register(createAuthRoutes(
      userRepo,
      jwtService,
      bcryptService,
      allowRegistration,
    ));

    await fastify.register(createMatchRoutes(
      tournamentRepo,
      matchRepo,
      jwtService,
    ));

    await fastify.register(createBetRoutes(
      userRepo,
      tournamentRepo,
      matchRepo,
      ticketRepo,
      jwtService,
    ));

    await fastify.register(createAdminRoutes(
      userRepo,
      tournamentRepo,
      matchRepo,
      ticketRepo,
      auditLogRepo,
      jwtService,
      bcryptService,
      config,
    ));

    await fastify.register(createRankingRoutes(
      userRepo,
      tournamentRepo,
      matchRepo,
      ticketRepo,
      jwtService,
    ));
  };
}
