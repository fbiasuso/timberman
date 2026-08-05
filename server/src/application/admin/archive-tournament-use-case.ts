import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { AuditLogRepo } from '../../domain/ports/audit-log-repo.js';
import type { UnitOfWork, TransactionRepos } from '../../domain/ports/unit-of-work.js';
import {
  TournamentNotFoundError,
  TournamentNotFinishedError,
  TournamentNameAlreadyExistsError,
} from '../../domain/errors/index.js';
import { Tournament } from '../../domain/entities/tournament.js';
import type { Tournament as TournamentEntity } from '../../domain/entities/tournament.js';
import { AuditLog } from '../../domain/entities/audit-log.js';
import type { SystemConfig } from '../../domain/entities/system-config.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface NextTournamentDTO {
  id: number;
  name: string;
  status: string;
}

export interface ArchiveTournamentResult {
  id: number;
  status: string;
  nextTournament: NextTournamentDTO;
}

/**
 * Bounded retries for the auto-generated next-tournament name. Each retry
 * re-runs the whole 2-stage archive in a FRESH transaction; after this many
 * consecutive collisions the archive fails terminally (409 TOURNAMENT_NAME_TAKEN).
 */
export const MAX_ARCHIVE_NAME_RETRIES = 25;

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Derive the next tournament's name for a given retry attempt.
 *
 * attempt 0 reproduces the historical behavior exactly: base + 1 ("Torneo
 * N+1"). On a name collision the next attempt bumps the candidate ("Torneo
 * N+2", "Torneo N+3", ...) so the archive can retry safely.
 *
 * base = first `(\d+)` match in the archived name, else `tournament.id`
 * (non-numeric names fall back to "Torneo {id+1+k}").
 */
function candidateName(tournament: TournamentEntity, attempt: number): string {
  const match = tournament.name.match(/(\d+)/);
  const base = match ? Number(match[1]) : tournament.id;
  return `Torneo ${base + 1 + attempt}`;
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Archive a FINISHED tournament and auto-create the next one ("Torneo N+1").
 *
 * This is a compound operation and MUST run inside the UnitOfWork
 * transaction: the archived tournament's `update()` is written BEFORE the
 * next tournament's `save()` so `findActive()` can never observe two
 * 'active' tournaments mid-transaction (the active-flow resolution assumes
 * at most one active tournament). Both writes commit or roll back together.
 *
 * The next tournament starts clean: status 'active', carryover 0 (the
 * archived tournament's carryover stays frozen — it is never transferred),
 * and commission snapshot from the live system config (informational only).
 *
 * Guard: the tournament must exist (404) and be 'finished' (422) — an
 * active tournament cannot be archived (spec admin-operations).
 */
export class ArchiveTournamentUseCase {
  constructor(
    private readonly tournamentRepo: TournamentRepo,
    private readonly auditLogRepo: AuditLogRepo,
    private readonly config: SystemConfig,
    private readonly uow?: UnitOfWork,
  ) {}

  async execute(adminId: string, tournamentId: number): Promise<ArchiveTournamentResult> {
    let attempt = 0;
    while (true) {
      try {
        if (this.uow) {
          return await this.uow.withTransaction((repos) =>
            this.archive(adminId, tournamentId, attempt, repos),
          );
        }
        return await this.archive(adminId, tournamentId, attempt, {
          tournamentRepo: this.tournamentRepo,
          auditLogRepo: this.auditLogRepo,
        });
      } catch (err) {
        if (
          err instanceof TournamentNameAlreadyExistsError &&
          attempt < MAX_ARCHIVE_NAME_RETRIES
        ) {
          // PostgreSQL aborts the failed transaction after 23505, so nothing
          // persisted — the tournament row is still 'finished'. Re-running the
          // full 2-stage op in a FRESH transaction with the next candidate
          // name is state-consistent and safe.
          attempt += 1;
          continue;
        }
        // Non-collision error, or every candidate exhausted — fail loudly.
        throw err;
      }
    }
  }

  private async archive(
    adminId: string,
    tournamentId: number,
    attempt: number,
    repos: Pick<TransactionRepos, 'tournamentRepo' | 'auditLogRepo'>,
  ): Promise<ArchiveTournamentResult> {
    const { tournamentRepo, auditLogRepo } = repos;

    // 1. Lock the tournament row — serializes concurrent terminate/archive on
    //    the SAME tournament.
    const tournament = await tournamentRepo.findByIdForUpdate(tournamentId);
    if (!tournament) {
      throw new TournamentNotFoundError(tournamentId);
    }

    // 2. Finished-only guard — only a frozen tournament can be archived
    if (tournament.status !== 'finished') {
      throw new TournamentNotFinishedError(tournamentId, tournament.status);
    }

    // 3. Archive FIRST (before creating the next one): `findActive()` resolves
    //    status = 'active', so archiving the old row before `save()`ing the
    //    new one guarantees no window where two tournaments are active.
    const archived = tournament.archive();
    const saved = await tournamentRepo.update(archived);

    // 4. Create the next tournament: status 'active', carryover 0, commission
    //    from the live system config (same informational semantics as
    //    CreateTournamentUseCase).
    const next = Tournament.new({
      id: 0,
      name: candidateName(tournament, attempt),
      commission: this.config.commission,
    });
    const savedNext = await tournamentRepo.save(next);

    // 5. Audit trail
    const auditLog = AuditLog.new({
      id: 0,
      adminId,
      action: 'tournament_archived',
      reason: JSON.stringify({
        tournamentId,
        nextTournament: { id: savedNext.id, name: savedNext.name },
      }),
    });
    await auditLogRepo.save(auditLog);

    const nextSnap = savedNext.toSnapshot();
    return {
      id: saved.id,
      status: saved.status,
      nextTournament: {
        id: nextSnap.id,
        name: nextSnap.name,
        status: nextSnap.status,
      },
    };
  }
}
