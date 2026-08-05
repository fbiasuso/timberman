import type { MatchRepo } from '../../domain/ports/match-repo.js';
import { MatchNotFoundError } from '../../domain/errors/index.js';
import { deriveMatchResult } from './derive-match-result.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface SetMatchResultInput {
  matchId: number;
  localScore: string;
  visitorScore: string;
}

export interface MatchResultDTO {
  id: number;
  matchDateId: number;
  localTeam: string;
  visitorTeam: string;
  result: string | null;
  score: string | null;
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Admin sets the result for a single match by submitting the two raw
 * scores. The server derives the result (L/E/V) and composes the score
 * string — the client never sends a computed result or score. Both empty
 * inputs clear the match back to "Pendiente".
 */
export class SetMatchResultUseCase {
  constructor(private readonly matchRepo: MatchRepo) {}

  async execute(input: SetMatchResultInput): Promise<MatchResultDTO> {
    const match = await this.matchRepo.findById(input.matchId);
    if (!match) {
      throw new MatchNotFoundError(input.matchId);
    }

    const derived = deriveMatchResult(input.localScore, input.visitorScore);
    const updated =
      derived.kind === 'clear'
        ? match.clearResult()
        : match.setResult(derived.result, derived.score);
    const saved = await this.matchRepo.update(updated);
    const snap = saved.toSnapshot();

    return {
      id: snap.id,
      matchDateId: snap.matchDateId,
      localTeam: snap.localTeam,
      visitorTeam: snap.visitorTeam,
      result: snap.result,
      score: snap.score,
    };
  }
}
