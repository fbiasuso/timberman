import type { Match } from '../../domain/entities/match.js';
import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { MatchRepo } from '../../domain/ports/match-repo.js';
import {
  MatchNotFoundError,
  MatchDateNotFoundError,
  DateNotOpenError,
} from '../../domain/errors/index.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface UpdateMatchDetailsInput {
  matchId: number;
  localTeam?: string;
  visitorTeam?: string;
  localImg?: string | null;
  visitorImg?: string | null;
  scheduledAt?: Date | null;
}

export interface MatchDTO {
  id: number;
  matchDateId: number;
  localTeam: string;
  visitorTeam: string;
  localImg: string | null;
  visitorImg: string | null;
  scheduledAt: Date | null;
  result: string | null;
  score: string | null;
  createdAt: Date;
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Edit a match's editable details (teams, images, scheduled time) — admin.
 *
 * Flow:
 * 1. Match must exist (else `MatchNotFoundError`, 404)
 * 2. Parent date must exist (else `MatchDateNotFoundError`, 404 — defensive,
 *    a persisted match always has one)
 * 3. Parent date must be 'open' (else `DateNotOpenError`, 422) — editing is
 *    locked once the round closes; results are edited via the separate
 *    set-result flow
 * 4. Apply the partial change via the immutable `Match.withDetails()` and
 *    persist with `matchRepo.update`
 *
 * Partial semantics: `undefined` fields are left unchanged; `null` clears
 * localImg/visitorImg/scheduledAt. An empty body (no field provided) is a
 * no-op — the current match is returned and nothing is written.
 */
export class UpdateMatchDetailsUseCase {
  constructor(
    private readonly matchRepo: MatchRepo,
    private readonly tournamentRepo: TournamentRepo,
  ) {}

  async execute(input: UpdateMatchDetailsInput): Promise<MatchDTO> {
    // 1. Match must exist
    const match = await this.matchRepo.findById(input.matchId);
    if (!match) {
      throw new MatchNotFoundError(input.matchId);
    }

    // 2. Parent date must exist
    const matchDate = await this.tournamentRepo.findMatchDateById(match.matchDateId);
    if (!matchDate) {
      throw new MatchDateNotFoundError(match.matchDateId);
    }

    // 3. Only open dates accept edits
    if (!matchDate.isOpen()) {
      throw new DateNotOpenError(match.matchDateId, matchDate.status);
    }

    // 4. Empty body is a no-op — return the current match without writing
    const hasChanges =
      input.localTeam !== undefined ||
      input.visitorTeam !== undefined ||
      input.localImg !== undefined ||
      input.visitorImg !== undefined ||
      input.scheduledAt !== undefined;

    const updated = hasChanges
      ? await this.matchRepo.update(match.withDetails(input))
      : match;

    return this.toDTO(updated);
  }

  private toDTO(match: Match): MatchDTO {
    const snap = match.toSnapshot();
    return {
      id: snap.id,
      matchDateId: snap.matchDateId,
      localTeam: snap.localTeam,
      visitorTeam: snap.visitorTeam,
      localImg: snap.localImg,
      visitorImg: snap.visitorImg,
      scheduledAt: snap.scheduledAt,
      result: snap.result,
      score: snap.score,
      createdAt: snap.createdAt,
    };
  }
}
