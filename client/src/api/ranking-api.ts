import client from './client';
import type { RankingEntry, UserDateBreakdown } from '../types';

export const rankingApi = {
  getRanking(tournamentId?: number): Promise<RankingEntry[]> {
    return client
      .get<RankingEntry[]>('/ranking', { params: { tournamentId } })
      .then((r) => r.data);
  },

  getUserDetail(userId: string): Promise<UserDateBreakdown[]> {
    return client
      .get<UserDateBreakdown[]>(`/ranking/users/${userId}`)
      .then((r) => r.data);
  },
};
