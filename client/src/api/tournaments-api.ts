import client from './client';

/** Tournament summary (from GET /api/tournaments — public, auth required) */
export interface TournamentDTO {
  id: number;
  name: string;
  status: 'active' | 'finished' | 'archived';
  finishedAt: string | null;
  createdAt: string;
}

export const tournamentsApi = {
  /** GET /api/tournaments — all tournaments, active first (ranking selector) */
  getTournaments(): Promise<TournamentDTO[]> {
    return client
      .get<{ tournaments: TournamentDTO[] }>('/tournaments')
      .then((r) => r.data.tournaments);
  },
};
