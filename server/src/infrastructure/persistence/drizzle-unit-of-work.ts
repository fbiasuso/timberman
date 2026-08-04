import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { UnitOfWork, TransactionRepos } from '../../domain/ports/unit-of-work.js';
import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { TournamentPointsRepo } from '../../domain/ports/tournament-points-repo.js';
import type { MatchRepo } from '../../domain/ports/match-repo.js';
import type { TicketRepo } from '../../domain/ports/ticket-repo.js';
import type { UserRepo } from '../../domain/ports/user-repo.js';
import type { AuditLogRepo } from '../../domain/ports/audit-log-repo.js';

/**
 * Drizzle-backed transaction boundary.
 *
 * `withTransaction` opens a single database transaction and rebuilds every
 * repository bound to the transaction client, so all writes performed by
 * the callback are atomic: a thrown error rolls everything back.
 *
 * The repos are reconstructed from factory functions instead of being
 * passed in directly because a Drizzle transaction client is not the same
 * object as the main database handle — each repo must target the `tx`.
 */
export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(
    private readonly db: PostgresJsDatabase<any>,
    private readonly repos: {
      tournamentRepo: (db: PostgresJsDatabase<any>) => TournamentRepo;
      tournamentPointsRepo: (db: PostgresJsDatabase<any>) => TournamentPointsRepo;
      matchRepo: (db: PostgresJsDatabase<any>) => MatchRepo;
      ticketRepo: (db: PostgresJsDatabase<any>) => TicketRepo;
      userRepo: (db: PostgresJsDatabase<any>) => UserRepo;
      auditLogRepo: (db: PostgresJsDatabase<any>) => AuditLogRepo;
    },
  ) {}

  async withTransaction<T>(
    fn: (repos: TransactionRepos) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      const txDb = tx as unknown as PostgresJsDatabase<any>;
      return fn({
        tournamentRepo: this.repos.tournamentRepo(txDb),
        tournamentPointsRepo: this.repos.tournamentPointsRepo(txDb),
        matchRepo: this.repos.matchRepo(txDb),
        ticketRepo: this.repos.ticketRepo(txDb),
        userRepo: this.repos.userRepo(txDb),
        auditLogRepo: this.repos.auditLogRepo(txDb),
      });
    });
  }
}
