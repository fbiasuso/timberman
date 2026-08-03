import client from './client';
import type { MatchDTO, MatchDateDTO } from '../types';

export interface CurrentDateResponse {
  matchDate: MatchDateDTO | null;
  matches: MatchDTO[];
  /** Cents — unpaid pozo accumulated from previous dates without winners */
  carryover: number;
  /** Name of the parent tournament (for the cartelera header) */
  tournamentName: string;
}

export interface DatesResponse {
  dates: MatchDateDTO[];
}

export interface DateMatchesResponse {
  matchDate: MatchDateDTO;
  matches: MatchDTO[];
}

export const matchApi = {
  /** GET /api/matches/current — current open match date with its matches */
  getCurrent() {
    return client.get<CurrentDateResponse>('/matches/current').then((r) => r.data);
  },

  /** GET /api/matches/dates — all match dates across tournaments */
  getDates() {
    return client.get<DatesResponse>('/matches/dates').then((r) => r.data);
  },

  /** GET /api/matches/dates/:dateId — a specific date (any status) with its matches */
  getMatchesByDate(dateId: number) {
    return client.get<DateMatchesResponse>(`/matches/dates/${dateId}`).then((r) => r.data);
  },

  /** GET /api/matches/dates/:dateId/history — sanitized history for any authenticated user */
  getHistory(dateId: number) {
    return client.get<DateMatchesResponse>(`/matches/dates/${dateId}/history`).then((r) => r.data);
  },
};
