import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { betApi } from '../api/bet-api';
import type { PlaceBetInput } from '../api/bet-api';
import { useBetSlipStore } from '../stores/bet-slip-store';

/**
 * Fetch the authenticated user's tickets.
 * Optional matchDateId filter to view tickets for a specific date.
 */
export function useBets(matchDateId?: number) {
  return useQuery({
    queryKey: ['bets', matchDateId],
    queryFn: () => betApi.listBets(matchDateId),
    staleTime: 30_000,
  });
}

/**
 * Place a bet on an open match date.
 * On success: invalidates relevant queries and resets the bet slip.
 */
export function usePlaceBet() {
  const queryClient = useQueryClient();
  const reset = useBetSlipStore((s) => s.reset);

  return useMutation({
    mutationFn: (input: PlaceBetInput) => betApi.placeBet(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['bets'] });
      reset();
    },
  });
}
