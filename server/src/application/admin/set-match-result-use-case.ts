import type { MatchRepo } from '../../domain/ports/match-repo.js';
import { MatchNotFoundError } from '../../domain/errors/index.js';
import { assertPrediction } from '../../domain/value-objects/prediction.js';
import type { Prediction } from '../../domain/value-objects/prediction.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface SetMatchResultInput {
  matchId: number;
  result: Prediction;
  score?: string | null;
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
 * Admin sets the result and optional score for a single match.
 */
export class SetMatchResultUseCase {
  constructor(private readonly matchRepo: MatchRepo) {}

  async execute(input: SetMatchResultInput): Promise<MatchResultDTO> {
    const match = await this.matchRepo.findById(input.matchId);
    if (!match) {
      throw new MatchNotFoundError(input.matchId);
    }

    assertPrediction(input.result);
    const updated = match.setResult(input.result, input.score ?? null);
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
