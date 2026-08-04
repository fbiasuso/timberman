import { useQuery } from '@tanstack/react-query';
import { tournamentsApi } from '../api/tournaments-api';

/**
 * Fetch all tournaments (active first) for the ranking selector.
 * Used by RankingPage to switch between per-tournament views.
 */
export function useTournaments() {
  return useQuery({
    queryKey: ['tournaments'],
    queryFn: () => tournamentsApi.getTournaments(),
    staleTime: 60_000,
  });
}
