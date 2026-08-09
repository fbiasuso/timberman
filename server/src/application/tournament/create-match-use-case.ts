import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { MatchRepo } from '../../domain/ports/match-repo.js';
import type { TeamRepo } from '../../domain/ports/team-repo.js';
import { Match } from '../../domain/entities/match.js';
import {
  MatchDateNotFoundError,
  DateNotOpenError,
  TournamentNotFoundError,
  TournamentNotActiveError,
  TeamNotResolvableError,
} from '../../domain/errors/index.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface CreateMatchInput {
  matchDateId: number;
  localTeam: string;
  visitorTeam: string;
  localImg?: string | null;
  visitorImg?: string | null;
  /** Registry team id — enrichment only (design D10); null/absent keeps legacy free text. */
  localTeamId?: number | null;
  /** Registry team id — enrichment only (design D10); null/absent keeps legacy free text. */
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
 * Create a new match on a tournament date (admin action).
 *
 * Guards:
 * 1. The parent date must exist (else `MatchDateNotFoundError`, 404)
 * 2. The parent date must be 'open' (else `DateNotOpenError`, 422) — matches
 *    can only be added while the round is open for betting
 * 3. The parent tournament must be ACTIVE (else `TournamentNotActiveError`,
 *    422) — finished/archived tournaments accept no new matches
 * 4. A provided team id must resolve against the teams registry (else
 *    `TeamNotResolvableError`, 422) — the string is then persisted as that
 *    team's name; free-text-only teams keep a null FK
 *
 * On success: `Match.new` → `matchRepo.save`. The route is responsible for
 * converting the ISO `scheduledAt` string from the request body into a Date.
 */
export class CreateMatchUseCase {
  constructor(
    private readonly tournamentRepo: TournamentRepo,
    private readonly matchRepo: MatchRepo,
    private readonly teamRepo?: TeamRepo,
  ) {}

  async execute(input: CreateMatchInput): Promise<MatchDTO> {
    // 1. Parent date must exist
    const matchDate = await this.tournamentRepo.findMatchDateById(input.matchDateId);
    if (!matchDate) {
      throw new MatchDateNotFoundError(input.matchDateId);
    }

    // 2. Only open dates accept new matches
    if (!matchDate.isOpen()) {
      throw new DateNotOpenError(input.matchDateId, matchDate.status);
    }

    // 3. Lifecycle guard: the tournament backing the date must be active
    const tournament = await this.tournamentRepo.findById(matchDate.tournamentId);
    if (!tournament) {
      throw new TournamentNotFoundError(matchDate.tournamentId);
    }
    if (tournament.status !== 'active') {
      throw new TournamentNotActiveError(tournament.id, tournament.status);
    }

    // 4. Resolve optional team ids against the registry (enrichment only)
    const localTeam = await this.resolveTeam(input.localTeamId, input.localTeam);
    const visitorTeam = await this.resolveTeam(input.visitorTeamId, input.visitorTeam);

    // 5. Build + persist the match
    const match = Match.new({
      id: 0,
      matchDateId: input.matchDateId,
      localTeam: localTeam.name,
      visitorTeam: visitorTeam.name,
      localImg: input.localImg,
      visitorImg: input.visitorImg,
      localTeamId: localTeam.id,
      visitorTeamId: visitorTeam.id,
      scheduledAt: input.scheduledAt,
    });

    const saved = await this.matchRepo.save(match);
    const snap = saved.toSnapshot();

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

  /**
   * Resolve a registry team id to { name, id }. A provided id MUST exist —
   * else TeamNotResolvableError 422 (design D4). Without a teamRepo (legacy
   * wiring) or with a null/absent id, the free text is kept and the FK is null.
   */
  private async resolveTeam(
    teamId: number | null | undefined,
    fallbackName: string,
  ): Promise<{ name: string; id: number | null }> {
    if (teamId === undefined || teamId === null || !this.teamRepo) {
      return { name: fallbackName, id: teamId ?? null };
    }
    const team = await this.teamRepo.findById(teamId);
    if (!team) {
      throw new TeamNotResolvableError(teamId);
    }
    return { name: team.name, id: team.id };
  }
}
