import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { UserRepo } from '../../../domain/ports/user-repo.js';
import type { TournamentRepo } from '../../../domain/ports/tournament-repo.js';
import type { MatchRepo } from '../../../domain/ports/match-repo.js';
import type { TicketRepo } from '../../../domain/ports/ticket-repo.js';
import type { AuditLogRepo } from '../../../domain/ports/audit-log-repo.js';
import type { TournamentPointsRepo } from '../../../domain/ports/tournament-points-repo.js';
import type { SystemConfigRepo } from '../../../domain/ports/system-config-repo.js';
import type { LeagueRepo } from '../../../domain/ports/league-repo.js';
import type { TeamRepo } from '../../../domain/ports/team-repo.js';
import type { ImageService } from '../../../domain/ports/image-service.js';
import type { UnitOfWork } from '../../../domain/ports/unit-of-work.js';
import type { JwtServiceImpl } from '../../auth/jwt-service.js';
import type { BcryptServiceImpl } from '../../auth/bcrypt-service.js';
import type { SystemConfig } from '../../../domain/entities/system-config.js';
import { ListUsersUseCase } from '../../../application/admin/list-users-use-case.js';
import { CreateUserUseCase } from '../../../application/admin/create-user-use-case.js';
import { AdjustBalanceUseCase } from '../../../application/admin/adjust-balance-use-case.js';
import { DeleteUserUseCase } from '../../../application/admin/delete-user-use-case.js';
import { GetConfigUseCase } from '../../../application/admin/get-config-use-case.js';
import { UpdateConfigUseCase } from '../../../application/admin/update-config-use-case.js';
import { PropagateBetAmountUseCase } from '../../../application/admin/propagate-bet-amount-use-case.js';
import { Money } from '../../../domain/value-objects/money.js';
import { ListTournamentsUseCase } from '../../../application/admin/list-tournaments-use-case.js';
import { CreateTournamentUseCase } from '../../../application/admin/create-tournament-use-case.js';
import { TerminateTournamentUseCase } from '../../../application/admin/terminate-tournament-use-case.js';
import { ArchiveTournamentUseCase } from '../../../application/admin/archive-tournament-use-case.js';
import { SetMatchResultUseCase } from '../../../application/admin/set-match-result-use-case.js';
import { PointsCalculator } from '../../../application/tournament/points-calculator.js';
import { CloseDateUseCase } from '../../../application/tournament/close-date-use-case.js';
import { PublishResultsUseCase } from '../../../application/tournament/publish-results-use-case.js';
import { CreateDateUseCase } from '../../../application/tournament/create-date-use-case.js';
import type { MatchDateDTO as CreatedMatchDateDTO } from '../../../application/tournament/create-date-use-case.js';
import { CreateMatchUseCase } from '../../../application/tournament/create-match-use-case.js';
import { UpdateMatchDetailsUseCase } from '../../../application/tournament/update-match-details-use-case.js';
import type { MatchDTO as MatchDetailsDTO } from '../../../application/tournament/update-match-details-use-case.js';
import { PozoCalculator } from '../../../application/betting/pozo-calculator.js';
import { CreateLeagueUseCase } from '../../../application/teams/create-league-use-case.js';
import { UpdateLeagueUseCase } from '../../../application/teams/update-league-use-case.js';
import { DeleteLeagueUseCase } from '../../../application/teams/delete-league-use-case.js';
import { ListLeaguesUseCase } from '../../../application/teams/list-leagues-use-case.js';
import { ListTeamsByLeagueUseCase } from '../../../application/teams/list-teams-by-league-use-case.js';
import { CreateTeamUseCase } from '../../../application/teams/create-team-use-case.js';
import { UpdateTeamUseCase } from '../../../application/teams/update-team-use-case.js';
import { DeleteTeamUseCase } from '../../../application/teams/delete-team-use-case.js';
import { SetTeamLogoUseCase } from '../../../application/teams/set-team-logo-use-case.js';
import type { LeagueDTO, LeagueWithTeamsDTO, TeamDTO } from '../../../application/teams/dto.js';
import { createAuthMiddleware } from '../middlewares/auth-middleware.js';
import { createAdminMiddleware } from '../middlewares/admin-middleware.js';

// ── Validation Schemas ────────────────────────────────────────────

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
  balance: z.number().int().min(0).optional(),
});

const adjustBalanceSchema = z.object({
  amount: z.number().int(),
  reason: z.string().min(1).max(500),
});

const createTournamentSchema = z.object({
  name: z.string().min(1).max(100),
  commission: z.number().min(0).max(100).optional(),
});

// Shape-only validation: raw score strings (empty allowed so a clear request
// reaches the use case). Semantic rules live in deriveMatchResult → 422.
const setMatchResultSchema = z.object({
  localScore: z.string(),
  visitorScore: z.string(),
});

const updateConfigSchema = z.object({
  key: z.enum(['commission', 'allowRegistration', 'defaultBetAmount']),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const dateParamsSchema = z.object({
  dateId: z.coerce.number().int().positive(),
});

const tournamentParamsSchema = z.object({
  tournamentId: z.coerce.number().int().positive(),
});

const createDateSchema = z.object({
  tournamentId: z.number().int().positive(),
});

// Shared editable match fields — used by create (all required except the
// optionals) and by the details PATCH (partial).
const matchDetailsFields = {
  localTeam: z.string().min(1),
  visitorTeam: z.string().min(1),
  localImg: z.string().nullable().optional(),
  visitorImg: z.string().nullable().optional(),
  localTeamId: z.number().int().positive().nullable().optional(),
  visitorTeamId: z.number().int().positive().nullable().optional(),
  scheduledAt: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Must be a valid ISO date string')
    .nullable()
    .optional(),
};

const createMatchSchema = z.object({
  matchDateId: z.number().int().positive(),
  ...matchDetailsFields,
});

const updateMatchDetailsSchema = z.object(matchDetailsFields).partial();

// Non-blank text: min(1) rejects '', the refine rejects whitespace-only.
// Values are stored AS TYPED (no trim transform — tournament convention).
const nonBlankText = (max: number) =>
  z.string().min(1).max(max).refine((v) => v.trim().length > 0, { message: 'Must not be blank' });

const leagueParamsSchema = z.object({
  leagueId: z.coerce.number().int().positive(),
});

const teamParamsSchema = z.object({
  teamId: z.coerce.number().int().positive(),
});

const createLeagueSchema = z.object({
  name: nonBlankText(100),
  country: nonBlankText(100),
  format: z.enum(['liga', 'copa']),
});

const updateLeagueSchema = createLeagueSchema.partial();

// Team aliases: at most 20 short strings (design server-layers note).
const aliasesField = z.array(z.string().min(1).max(100)).max(20).nullable().optional();

const createTeamSchema = z.object({
  name: nonBlankText(100),
  aliases: aliasesField,
  logoUrl: z.string().url().nullable().optional(),
  // A team MUST belong to at least one league (spec "Membership required").
  leagueIds: z.array(z.number().int().positive()).min(1),
});

const updateTeamSchema = z.object({
  name: nonBlankText(100).optional(),
  aliases: aliasesField,
  logoUrl: z.string().url().nullable().optional(),
  // On PATCH, leagueIds is optional — but when present it must keep ≥1 league.
  leagueIds: z.array(z.number().int().positive()).min(1).optional(),
});

// Re-upload a team shield: the URL is validated by zod (absolute http(s)),
// then downloaded/validated/stored by the image service (see design D5/D6).
const setTeamLogoSchema = z.object({
  url: z.string().url(),
});

// ── DTOs (shape of API responses) ─────────────────────────────────

interface MatchDTO {
  id: number;
  matchDateId: number;
  localTeam: string;
  visitorTeam: string;
  localImg: string | null;
  visitorImg: string | null;
  localTeamId: number | null;
  visitorTeamId: number | null;
  scheduledAt: string | null;
  result: string | null;
  score: string | null;
}

interface MatchDateDTO {
  id: number;
  tournamentId: number;
  dateNumber: number;
  status: string;
  pozo: number;
  betAmount: number;
  commission: number; // percent — snapshot taken at close (0 for a fresh date)
  carryover: number; // cents — accumulated pozo from unpaid previous dates
  createdAt: string;
}

function toMatchDTO(match: MatchDetailsDTO): MatchDTO {
  return {
    id: match.id,
    matchDateId: match.matchDateId,
    localTeam: match.localTeam,
    visitorTeam: match.visitorTeam,
    localImg: match.localImg,
    visitorImg: match.visitorImg,
    localTeamId: match.localTeamId,
    visitorTeamId: match.visitorTeamId,
    scheduledAt: match.scheduledAt?.toISOString() ?? null,
    result: match.result,
    score: match.score,
  };
}

function toMatchDateDTO(md: CreatedMatchDateDTO, carryover: number): MatchDateDTO {
  return {
    id: md.id,
    tournamentId: md.tournamentId,
    dateNumber: md.dateNumber,
    status: md.status,
    pozo: md.pozo,
    betAmount: md.betAmount,
    commission: 0, // fresh date — commission is snapshotted at close
    carryover,
    createdAt: md.createdAt.toISOString(),
  };
}

interface LeagueAPIDTO {
  id: number;
  name: string;
  country: string;
  format: 'liga' | 'copa';
  createdAt: string;
}

interface TeamAPIDTO {
  id: number;
  name: string;
  aliases: string[] | null;
  logo: string | null;
  leagueIds: number[];
  createdAt: string;
}

function toLeagueAPIDTO(league: LeagueDTO): LeagueAPIDTO {
  return {
    id: league.id,
    name: league.name,
    country: league.country,
    format: league.format,
    createdAt: league.createdAt.toISOString(),
  };
}

function toTeamAPIDTO(team: TeamDTO): TeamAPIDTO {
  return {
    id: team.id,
    name: team.name,
    aliases: team.aliases,
    logo: team.logo,
    leagueIds: team.leagueIds,
    createdAt: team.createdAt.toISOString(),
  };
}

function toLeagueWithTeamsAPIDTO(league: LeagueWithTeamsDTO) {
  return {
    ...toLeagueAPIDTO(league),
    teams: league.teams.map(toTeamAPIDTO),
  };
}

/**
 * Convert an ISO `scheduledAt` string from the request body into the use case
 * input: `undefined` keeps the current value (PATCH), `null` clears it, and a
 * string becomes a Date (both endpoints).
 */
function toDateOrUndefined(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

// ── Routes ────────────────────────────────────────────────────────

export function createAdminRoutes(
  userRepo: UserRepo,
  tournamentRepo: TournamentRepo,
  matchRepo: MatchRepo,
  ticketRepo: TicketRepo,
  auditLogRepo: AuditLogRepo,
  tournamentPointsRepo: TournamentPointsRepo,
  jwtService: JwtServiceImpl,
  bcryptService: BcryptServiceImpl,
  config: SystemConfig,
  configRepo: SystemConfigRepo,
  leagueRepo: LeagueRepo,
  teamRepo: TeamRepo,
  imageService: ImageService,
  uow?: UnitOfWork,
): FastifyPluginAsync {
  return async (fastify) => {
    const authMiddleware = createAuthMiddleware(jwtService);
    const adminMiddleware = createAdminMiddleware();

    // ── Use Cases ──────────────────────────────────────────────
    const pointsCalculator = new PointsCalculator();
    const listUsersUseCase = new ListUsersUseCase(userRepo, ticketRepo, matchRepo, pointsCalculator);
    const createUserUseCase = new CreateUserUseCase(userRepo, bcryptService);
    const adjustBalanceUseCase = new AdjustBalanceUseCase(userRepo, auditLogRepo, uow);
    const deleteUserUseCase = new DeleteUserUseCase(userRepo);
    const getConfigUseCase = new GetConfigUseCase(config);
    const updateConfigUseCase = new UpdateConfigUseCase(config, configRepo);
    const propagateBetAmountUseCase = new PropagateBetAmountUseCase(
      tournamentRepo,
      ticketRepo,
      auditLogRepo,
      uow,
    );
    const listTournamentsUseCase = new ListTournamentsUseCase(
      tournamentRepo,
      ticketRepo,
      userRepo,
      tournamentPointsRepo,
    );
    const createTournamentUseCase = new CreateTournamentUseCase(tournamentRepo, config);
    const terminateTournamentUseCase = new TerminateTournamentUseCase(
      tournamentRepo,
      tournamentPointsRepo,
      userRepo,
      auditLogRepo,
      uow,
    );
    const archiveTournamentUseCase = new ArchiveTournamentUseCase(
      tournamentRepo,
      auditLogRepo,
      config,
      uow,
    );
    const setMatchResultUseCase = new SetMatchResultUseCase(matchRepo);
    const closeDateUseCase = new CloseDateUseCase(
      tournamentRepo,
      ticketRepo,
      new PozoCalculator(),
      config,
      userRepo,
      auditLogRepo,
      uow,
    );
    const publishResultsUseCase = new PublishResultsUseCase(
      tournamentRepo,
      matchRepo,
      ticketRepo,
      pointsCalculator,
      userRepo,
      tournamentPointsRepo,
      uow,
    );
    const createDateUseCase = new CreateDateUseCase(tournamentRepo, config);
    const createMatchUseCase = new CreateMatchUseCase(tournamentRepo, matchRepo, teamRepo);
    const updateMatchDetailsUseCase = new UpdateMatchDetailsUseCase(matchRepo, tournamentRepo, teamRepo);

    // ── Teams & Leagues (registry) ─────────────────────────────
    const createLeagueUseCase = new CreateLeagueUseCase(leagueRepo);
    const updateLeagueUseCase = new UpdateLeagueUseCase(leagueRepo);
    const deleteLeagueUseCase = new DeleteLeagueUseCase(leagueRepo);
    const listLeaguesUseCase = new ListLeaguesUseCase(leagueRepo, teamRepo);
    const listTeamsByLeagueUseCase = new ListTeamsByLeagueUseCase(teamRepo, leagueRepo);
    const createTeamUseCase = new CreateTeamUseCase(teamRepo, leagueRepo, imageService);
    const updateTeamUseCase = new UpdateTeamUseCase(teamRepo, leagueRepo, imageService);
    const deleteTeamUseCase = new DeleteTeamUseCase(teamRepo);
    const setTeamLogoUseCase = new SetTeamLogoUseCase(teamRepo, imageService);

    // ── GET /api/admin/users ─────────────────────────────────────
    fastify.get('/api/admin/users', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (_request, _reply) => {
      const users = await listUsersUseCase.execute();
      return { users };
    });

    // ── POST /api/admin/users ────────────────────────────────────
    fastify.post('/api/admin/users', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const body = createUserSchema.parse(request.body);
      const user = await createUserUseCase.execute({
        username: body.username,
        password: body.password,
        balance: body.balance,
      });
      return reply.status(201).send({ user });
    });

    // ── PATCH /api/admin/users/:userId/balance ───────────────────
    fastify.patch('/api/admin/users/:userId/balance', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const body = adjustBalanceSchema.parse(request.body);

      const result = await adjustBalanceUseCase.execute({
        userId,
        adminId: request.user!.sub,
        amount: body.amount,
        reason: body.reason,
      });
      return reply.send(result);
    });

    // ── DELETE /api/admin/users/:userId ──────────────────────────
    fastify.delete('/api/admin/users/:userId', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const { userId } = request.params as { userId: string };
      await deleteUserUseCase.execute(userId);
      return reply.status(204).send();
    });

    // ── GET /api/admin/tournaments ───────────────────────────────
    fastify.get('/api/admin/tournaments', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (_request, _reply) => {
      const tournaments = await listTournamentsUseCase.execute();
      return { tournaments };
    });

    // ── POST /api/admin/tournaments ──────────────────────────────
    fastify.post('/api/admin/tournaments', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const body = createTournamentSchema.parse(request.body);
      const tournament = await createTournamentUseCase.execute({
        name: body.name,
        commission: body.commission,
      });
      return reply.status(201).send({ tournament });
    });

    // ── POST /api/admin/tournaments/:tournamentId/terminate ────────
    fastify.post('/api/admin/tournaments/:tournamentId/terminate', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const { tournamentId } = tournamentParamsSchema.parse(request.params);
      const result = await terminateTournamentUseCase.execute(
        request.user!.sub,
        tournamentId,
      );
      return reply.send(result);
    });

    // ── POST /api/admin/tournaments/:tournamentId/archive ──────────
    fastify.post('/api/admin/tournaments/:tournamentId/archive', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const { tournamentId } = tournamentParamsSchema.parse(request.params);
      const result = await archiveTournamentUseCase.execute(
        request.user!.sub,
        tournamentId,
      );
      return reply.send(result);
    });

    // ── PATCH /api/admin/matches/:matchId/result ─────────────────
    fastify.patch('/api/admin/matches/:matchId/result', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const { matchId } = request.params as { matchId: string };
      const body = setMatchResultSchema.parse(request.body);

      const result = await setMatchResultUseCase.execute({
        matchId: Number(matchId),
        localScore: body.localScore,
        visitorScore: body.visitorScore,
      });
      return reply.send({ match: result });
    });

    // ── POST /api/admin/dates ──────────────────────────────────────
    fastify.post('/api/admin/dates', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const body = createDateSchema.parse(request.body);
      const matchDate = await createDateUseCase.execute({ tournamentId: body.tournamentId });

      // The API DTO carries the parent tournament's carryover (same shape as
      // the admin date read in match-routes). A fresh date has no commission
      // snapshot yet.
      const tournament = await tournamentRepo.findById(body.tournamentId);
      return reply.status(201).send({
        matchDate: toMatchDateDTO(matchDate, tournament?.carryover ?? 0),
      });
    });

    // ── POST /api/admin/matches ────────────────────────────────────
    fastify.post('/api/admin/matches', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const body = createMatchSchema.parse(request.body);
      const match = await createMatchUseCase.execute({
        matchDateId: body.matchDateId,
        localTeam: body.localTeam,
        visitorTeam: body.visitorTeam,
        localImg: body.localImg,
        visitorImg: body.visitorImg,
        localTeamId: body.localTeamId,
        visitorTeamId: body.visitorTeamId,
        scheduledAt: toDateOrUndefined(body.scheduledAt),
      });
      return reply.status(201).send({ match: toMatchDTO(match) });
    });

    // ── PATCH /api/admin/matches/:matchId ──────────────────────────
    fastify.patch('/api/admin/matches/:matchId', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const { matchId } = request.params as { matchId: string };
      const body = updateMatchDetailsSchema.parse(request.body);
      const match = await updateMatchDetailsUseCase.execute({
        matchId: Number(matchId),
        localTeam: body.localTeam,
        visitorTeam: body.visitorTeam,
        localImg: body.localImg,
        visitorImg: body.visitorImg,
        localTeamId: body.localTeamId,
        visitorTeamId: body.visitorTeamId,
        scheduledAt: toDateOrUndefined(body.scheduledAt),
      });
      return reply.send({ match: toMatchDTO(match) });
    });

    // ── GET /api/admin/config ────────────────────────────────────
    fastify.get('/api/admin/config', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (_request, _reply) => {
      const conf = getConfigUseCase.execute();
      return { config: conf };
    });

    // ── PATCH /api/admin/config ──────────────────────────────────
    fastify.patch('/api/admin/config', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const body = updateConfigSchema.parse(request.body);
      const conf = await updateConfigUseCase.execute(body.key, body.value);

      // A defaultBetAmount update propagates to every open, ticket-free date
      // (ticketed dates keep their amount and are reported as blocked — the
      // config itself is already persisted and must not be rolled back).
      if (body.key === 'defaultBetAmount') {
        const result = await propagateBetAmountUseCase.execute(
          request.user!.sub,
          Money.fromCents(conf.defaultBetAmount),
        );
        return reply.send({ config: conf, ...result });
      }

      return reply.send({ config: conf, updatedDates: [], blockedDates: [] });
    });

    // ── POST /api/admin/dates/:dateId/close ──────────────────────
    fastify.post('/api/admin/dates/:dateId/close', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const { dateId } = dateParamsSchema.parse(request.params);
      const result = await closeDateUseCase.execute(dateId, request.user!.sub);
      return reply.send(result);
    });

    // ── POST /api/admin/dates/:dateId/publish-results ─────────────
    fastify.post('/api/admin/dates/:dateId/publish-results', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const { dateId } = dateParamsSchema.parse(request.params);
      const result = await publishResultsUseCase.execute(dateId);
      return reply.send(result);
    });

    // ── POST /api/admin/leagues ────────────────────────────────────
    fastify.post('/api/admin/leagues', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const body = createLeagueSchema.parse(request.body);
      const league = await createLeagueUseCase.execute(body);
      return reply.status(201).send({ league: toLeagueAPIDTO(league) });
    });

    // ── GET /api/admin/leagues ─────────────────────────────────────
    fastify.get('/api/admin/leagues', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (_request, _reply) => {
      const leagues = await listLeaguesUseCase.execute();
      return { leagues: leagues.map(toLeagueWithTeamsAPIDTO) };
    });

    // ── PATCH /api/admin/leagues/:leagueId ─────────────────────────
    fastify.patch('/api/admin/leagues/:leagueId', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const { leagueId } = leagueParamsSchema.parse(request.params);
      const body = updateLeagueSchema.parse(request.body);
      const league = await updateLeagueUseCase.execute({ leagueId, ...body });
      return reply.send({ league: toLeagueAPIDTO(league) });
    });

    // ── DELETE /api/admin/leagues/:leagueId ────────────────────────
    fastify.delete('/api/admin/leagues/:leagueId', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const { leagueId } = leagueParamsSchema.parse(request.params);
      await deleteLeagueUseCase.execute(leagueId);
      return reply.status(204).send();
    });

    // ── GET /api/admin/leagues/:leagueId/teams ─────────────────────
    fastify.get('/api/admin/leagues/:leagueId/teams', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const { leagueId } = leagueParamsSchema.parse(request.params);
      const teams = await listTeamsByLeagueUseCase.execute(leagueId);
      return { teams: teams.map(toTeamAPIDTO) };
    });

    // ── POST /api/admin/teams ──────────────────────────────────────
    fastify.post('/api/admin/teams', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const body = createTeamSchema.parse(request.body);
      const team = await createTeamUseCase.execute(body);
      return reply.status(201).send({ team: toTeamAPIDTO(team) });
    });

    // ── PATCH /api/admin/teams/:teamId ─────────────────────────────
    fastify.patch('/api/admin/teams/:teamId', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const { teamId } = teamParamsSchema.parse(request.params);
      const body = updateTeamSchema.parse(request.body);
      const team = await updateTeamUseCase.execute({ teamId, ...body });
      return reply.send({ team: toTeamAPIDTO(team) });
    });

    // ── DELETE /api/admin/teams/:teamId ────────────────────────────
    fastify.delete('/api/admin/teams/:teamId', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const { teamId } = teamParamsSchema.parse(request.params);
      await deleteTeamUseCase.execute(teamId);
      return reply.status(204).send();
    });

    // ── POST /api/admin/teams/:teamId/logo ─────────────────────────
    // Re-upload a team shield: download → validate → store → persist path.
    // A failed download/store NEVER throws — the team is returned unchanged
    // (existing logo kept) and the failure is logged (image-service contract).
    fastify.post('/api/admin/teams/:teamId/logo', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const { teamId } = teamParamsSchema.parse(request.params);
      const body = setTeamLogoSchema.parse(request.body);
      const team = await setTeamLogoUseCase.execute({ teamId, url: body.url });
      return reply.send({ team: toTeamAPIDTO(team) });
    });
  };
}
