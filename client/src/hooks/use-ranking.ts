import { useQuery } from '@tanstack/react-query';
import { rankingApi } from '../api/ranking-api';

/**
 * Fetch the full ranking, optionally filtered by tournament.
 */
export function useRanking(tournamentId?: number) {
  return useQuery({
    queryKey: ['ranking', tournamentId],
    queryFn: () => rankingApi.getRanking(tournamentId),
  });
}

/**
 * Fetch a single user's per-date points breakdown.
 * Enabled only when a valid userId is provided.
 */
export function useUserDetail(userId: string) {
  return useQuery({
    queryKey: ['ranking', 'detail', userId],
    queryFn: () => rankingApi.getUserDetail(userId),
    enabled: !!userId,
  });
}
