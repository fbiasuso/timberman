import { useQuery } from '@tanstack/react-query';
import { matchApi } from '../api/match-api';

/**
 * Fetch the current open match date with its matches.
 * Used by CarteleraPage to display available bets.
 */
export function useCurrentMatches() {
  return useQuery({
    queryKey: ['matches', 'current'],
    queryFn: () => matchApi.getCurrent(),
    staleTime: 30_000,
    refetchInterval: 60_000, // auto-refresh every minute for live data
  });
}

/**
 * Fetch all match dates across tournaments.
 * Used by TicketsPage for the date filter dropdown.
 */
export function useMatchDates() {
  return useQuery({
    queryKey: ['matches', 'dates'],
    queryFn: () => matchApi.getDates(),
    staleTime: 60_000,
  });
}

/**
 * Fetch a SPECIFIC match date (any status) with its matches.
 * Used by ResultsEntry to review/correct a closed date's results
 * before publishing — /matches/current only reaches the open date.
 * Disabled until a dateId is provided.
 */
export function useMatchesByDate(dateId?: number) {
  return useQuery({
    queryKey: ['matches', 'byDate', dateId],
    queryFn: () => matchApi.getMatchesByDate(dateId!),
    enabled: dateId != null,
    staleTime: 30_000,
  });
}
