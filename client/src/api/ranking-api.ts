import client from './client';
import type { RankingEntry, UserDateBreakdown } from '../types';

export const rankingApi = {
  getRanking(tournamentId?: number): Promise<RankingEntry[]> {
    return client
      .get<{ ranking: RankingEntry[] }>('/ranking', { params: { tournamentId } })
      .then((r) => r.data.ranking);
  },

  getUserDetail(userId: string, tournamentId?: number): Promise<UserDateBreakdown[]> {
    return client
      .get<{ userDetail: UserDateBreakdown[] }>(`/ranking/users/${userId}`, {
        params: { tournamentId },
      })
      .then((r) => r.data.userDetail);
  },
};
