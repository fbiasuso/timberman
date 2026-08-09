import type { Match } from '../../domain/entities/match.js';
import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { MatchRepo } from '../../domain/ports/match-repo.js';
import type { TeamRepo } from '../../domain/ports/team-repo.js';
import {
  MatchNotFoundError,
  MatchDateNotFoundError,
  DateNotOpenError,
  TeamNotResolvableError,
} from '../../domain/errors/index.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface UpdateMatchDetailsInput {
  matchId: number;
  localTeam?: string;
  visitorTeam?: string;
  localImg?: string | null;
  visitorImg?: string | null;
  /** Registry team id — resolving it sets the FK and overwrites the string with the team's name. */
  localTeamId?: number | null;
  /** Registry team id — resolving it sets the FK and overwrites the string with the team's name. */
  visitorTeamId?: number | null;
  scheduledAt?: Date | null;
}

export interface MatchDTO {
  id: number;
  matchDateId: number;
  localTeam: string;
  visitorTeam: string;
  localImg: string | null;
  visitorImg: string | null;
  localTeamId: number | null;
  visitorTeamId: number | null;
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
 * 4. Resolve team ids against the registry (design D4): a provided id must
 *    exist (else `TeamNotResolvableError`, 422) and the string is persisted
 *    as that team's name; a string provided WITHOUT an id clears the FK
 *    (spec "Free text clears the team id"); neither → keep the current value
 * 5. Apply the partial change via the immutable `Match.withDetails()` and
 *    persist with `matchRepo.update`
 *
 * Partial semantics: `undefined` fields are left unchanged; `null` clears
 * localImg/visitorImg/localTeamId/visitorTeamId/scheduledAt. An empty body
 * (no field provided) is a no-op — the current match is returned and nothing
 * is written.
 */
export class UpdateMatchDetailsUseCase {
  constructor(
    private readonly matchRepo: MatchRepo,
    private readonly tournamentRepo: TournamentRepo,
    private readonly teamRepo?: TeamRepo,
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
      input.localTeamId !== undefined ||
      input.visitorTeamId !== undefined ||
      input.scheduledAt !== undefined;

    // 5. Resolve team ids → details patch (id wins over string; string-only clears FK)
    const localTeam = await this.resolveTeamField(input, 'local');
    const visitorTeam = await this.resolveTeamField(input, 'visitor');

    const updated = hasChanges
      ? await this.matchRepo.update(match.withDetails({
          localTeam: localTeam.name,
          visitorTeam: visitorTeam.name,
          localTeamId: localTeam.id,
          visitorTeamId: visitorTeam.id,
          localImg: input.localImg,
          visitorImg: input.visitorImg,
          scheduledAt: input.scheduledAt,
        }))
      : match;

    return this.toDTO(updated);
  }

  /**
   * Resolve the team field for one side. Returns the pair to apply:
   * - id provided (number) → MUST exist (else TeamNotResolvableError 422);
   *   string := team.name, FK := id
   * - string provided without id → FK := null (spec "Free text clears the
   *   team id"), string := typed value
   * - nothing provided → keep the CURRENT string + FK
   */
  private async resolveTeamField(
    input: UpdateMatchDetailsInput,
    side: 'local' | 'visitor',
  ): Promise<{ name?: string; id?: number | null }> {
    const teamId = side === 'local' ? input.localTeamId : input.visitorTeamId;
    const freeText = side === 'local' ? input.localTeam : input.visitorTeam;

    if (teamId !== undefined) {
      if (teamId === null) {
        return { id: null };
      }
      if (!this.teamRepo) {
        throw new TeamNotResolvableError(teamId);
      }
      const team = await this.teamRepo.findById(teamId);
      if (!team) {
        throw new TeamNotResolvableError(teamId);
      }
      return { name: team.name, id: team.id };
    }
    if (freeText !== undefined) {
      return { name: freeText, id: null };
    }
    return {};
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
      localTeamId: snap.localTeamId,
      visitorTeamId: snap.visitorTeamId,
      scheduledAt: snap.scheduledAt,
      result: snap.result,
      score: snap.score,
      createdAt: snap.createdAt,
    };
  }
}
