import type { Prediction } from '../value-objects/prediction.js';

export interface MatchSnapshot {
  id: number;
  matchDateId: number;
  localTeam: string;
  visitorTeam: string;
  localImg: string | null;
  visitorImg: string | null;
  /** Registry team id — enrichment only; the string remains the display source of truth. */
  localTeamId: number | null;
  /** Registry team id — enrichment only; the string remains the display source of truth. */
  visitorTeamId: number | null;
  scheduledAt: Date | null;
  result: Prediction | null;
  score: string | null;
  createdAt: Date;
}

export class Match {
  private constructor(
    public readonly id: number,
    public readonly matchDateId: number,
    public readonly localTeam: string,
    public readonly visitorTeam: string,
    public readonly localImg: string | null,
    public readonly visitorImg: string | null,
    public readonly localTeamId: number | null,
    public readonly visitorTeamId: number | null,
    public readonly scheduledAt: Date | null,
    private readonly _result: Prediction | null,
    private readonly _score: string | null,
    public readonly createdAt: Date,
  ) {}

  get result(): Prediction | null {
    return this._result;
  }

  get score(): string | null {
    return this._score;
  }

  // ── Behavior ─────────────────────────────────────────────────

  hasResult(): boolean {
    return this._result !== null;
  }

  /** Set result — returns a NEW Match instance (immutable) */
  setResult(result: Prediction, score: string | null): Match {
    return new Match(
      this.id,
      this.matchDateId,
      this.localTeam,
      this.visitorTeam,
      this.localImg,
      this.visitorImg,
      this.localTeamId,
      this.visitorTeamId,
      this.scheduledAt,
      result,
      score,
      this.createdAt,
    );
  }

  /** Clear result and score — returns a NEW Match instance (immutable) */
  clearResult(): Match {
    return new Match(
      this.id,
      this.matchDateId,
      this.localTeam,
      this.visitorTeam,
      this.localImg,
      this.visitorImg,
      this.localTeamId,
      this.visitorTeamId,
      this.scheduledAt,
      null,
      null,
      this.createdAt,
    );
  }

  /**
   * Update editable match details — returns a NEW Match instance (immutable).
   *
   * Only localTeam, visitorTeam, localImg, visitorImg, localTeamId,
   * visitorTeamId and scheduledAt can be edited here. Passing `null` for
   * localImg/visitorImg/localTeamId/visitorTeamId/scheduledAt CLEARS the
   * value; leaving a field `undefined` keeps the current value. Result and
   * score are NEVER touched by this method — results are set via setResult.
   */
  withDetails(details: {
    localTeam?: string;
    visitorTeam?: string;
    localImg?: string | null;
    visitorImg?: string | null;
    localTeamId?: number | null;
    visitorTeamId?: number | null;
    scheduledAt?: Date | null;
  }): Match {
    return new Match(
      this.id,
      this.matchDateId,
      details.localTeam !== undefined ? details.localTeam : this.localTeam,
      details.visitorTeam !== undefined ? details.visitorTeam : this.visitorTeam,
      details.localImg !== undefined ? details.localImg : this.localImg,
      details.visitorImg !== undefined ? details.visitorImg : this.visitorImg,
      details.localTeamId !== undefined ? details.localTeamId : this.localTeamId,
      details.visitorTeamId !== undefined ? details.visitorTeamId : this.visitorTeamId,
      details.scheduledAt !== undefined ? details.scheduledAt : this.scheduledAt,
      this._result,
      this._score,
      this.createdAt,
    );
  }

  /** Check if a given prediction matches the actual result */
  isCorrect(prediction: Prediction): boolean {
    return this._result !== null && this._result === prediction;
  }

  // ── Factory ──────────────────────────────────────────────────

  static create(snapshot: MatchSnapshot): Match {
    return new Match(
      snapshot.id,
      snapshot.matchDateId,
      snapshot.localTeam,
      snapshot.visitorTeam,
      snapshot.localImg,
      snapshot.visitorImg,
      snapshot.localTeamId,
      snapshot.visitorTeamId,
      snapshot.scheduledAt,
      snapshot.result,
      snapshot.score,
      snapshot.createdAt,
    );
  }

  static new(props: {
    id: number;
    matchDateId: number;
    localTeam: string;
    visitorTeam: string;
    localImg?: string | null;
    visitorImg?: string | null;
    localTeamId?: number | null;
    visitorTeamId?: number | null;
    scheduledAt?: Date | null;
  }): Match {
    return new Match(
      props.id,
      props.matchDateId,
      props.localTeam,
      props.visitorTeam,
      props.localImg ?? null,
      props.visitorImg ?? null,
      props.localTeamId ?? null,
      props.visitorTeamId ?? null,
      props.scheduledAt ?? null,
      null,
      null,
      new Date(),
    );
  }

  toSnapshot(): MatchSnapshot {
    return {
      id: this.id,
      matchDateId: this.matchDateId,
      localTeam: this.localTeam,
      visitorTeam: this.visitorTeam,
      localImg: this.localImg,
      visitorImg: this.visitorImg,
      localTeamId: this.localTeamId,
      visitorTeamId: this.visitorTeamId,
      scheduledAt: this.scheduledAt,
      result: this._result,
      score: this._score,
      createdAt: this.createdAt,
    };
  }
}
