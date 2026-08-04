import { useQuery } from '@tanstack/react-query';
import { rankingApi } from '../api/ranking-api';

/**
 * Fetch the full ranking, optionally filtered by tournament.
 * `tournamentId` undefined ⇒ server defaults to the active tournament.
 */
export function useRanking(tournamentId?: number) {
  return useQuery({
    queryKey: ['ranking', tournamentId],
    queryFn: () => rankingApi.getRanking(tournamentId),
  });
}

/**
 * Fetch a single user's per-date points breakdown, optionally scoped to a
 * tournament (`tournamentId` undefined ⇒ active tournament).
 * Enabled only when a valid userId is provided.
 */
export function useUserDetail(userId: string, tournamentId?: number) {
  return useQuery({
    queryKey: ['ranking', 'detail', userId, tournamentId],
    queryFn: () => rankingApi.getUserDetail(userId, tournamentId),
    enabled: !!userId,
  });
}
