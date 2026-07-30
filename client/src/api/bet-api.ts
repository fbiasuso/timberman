import client from './client';
import type { TicketDTO } from '../types';

export interface PlaceBetInput {
  matchDateId: number;
  predictions: Record<string, 'L' | 'E' | 'V'>;
}

export interface PlaceBetResponse {
  ticket: TicketDTO;
}

export interface ListBetsResponse {
  tickets: TicketDTO[];
}

export const betApi = {
  /** POST /api/bets — place a bet on an open match date */
  placeBet(data: PlaceBetInput) {
    return client.post<PlaceBetResponse>('/bets', data).then((r) => r.data);
  },

  /** GET /api/bets — list authenticated user's tickets */
  listBets(matchDateId?: number) {
    const params = matchDateId ? { matchDateId } : {};
    return client.get<ListBetsResponse>('/bets', { params }).then((r) => r.data);
  },
};
