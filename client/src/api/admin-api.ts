import client from './client';
import type { UserDTO } from './auth-api';
import type { MatchDateStatus, MatchDTO, MatchDateDTO } from '../types';
import type { CreateMatchPayload, UpdateMatchDetailsPayload } from '../types';

// ─── DTOs ───────────────────────────────────────────────────────────────────

export interface AdminUserDTO extends UserDTO {
  /** Total accumulated points */
  points: number;
}

/** Payout breakdown winner (from GET /api/admin/tournaments) */
export interface WinnerDTO {
  ticketId: number;
  userId: string;
  username: string;
  /** Cents credited to the winner */
  prize: number;
}

/** Per-date payout info (from GET /api/admin/tournaments) */
export interface TournamentDateDTO {
  id: number;
  dateNumber: number;
  status: MatchDateStatus;
  /** Cents — prize pool snapshot taken at close (includes carryover) */
  pozo: number;
  /** Cents — the bet amount this date was played at */
  betAmount: number;
  /** Commission percentage snapshot taken at close */
  commission: number;
  winners: WinnerDTO[];
}

/** Tournament-level winner (tie at max points, persisted at terminate) */
export interface TournamentWinnerDTO {
  userId: string;
  username: string;
}

export interface AdminTournamentDTO {
  id: number;
  name: string;
  commission: number;
  status: string;
  finishedAt: string | null;
  /** Cents — unpaid pozo rolled to the next date */
  carryover: number;
  createdAt: string;
  tournamentWinners: TournamentWinnerDTO[];
  dates: TournamentDateDTO[];
}

/** Response of POST /api/admin/tournaments/:id/terminate */
export interface TerminateTournamentResult {
  id: number;
  name: string;
  status: string;
  finishedAt: string | null;
  winners: TournamentWinnerDTO & { points: number }[];
  carryover: number;
}

/** Response of POST /api/admin/tournaments/:id/archive */
export interface ArchiveTournamentResult {
  id: number;
  status: string;
  nextTournament: {
    id: number;
    name: string;
    status: string;
  };
}

export interface AdminConfigDTO {
  commission: number;
  allowRegistration: boolean;
  defaultBetAmount: number;
}

/** One date touched by a defaultBetAmount propagation (by dateNumber for UI copy) */
export interface DatePropagationResult {
  id: number;
  dateNumber: number;
  /** Cents — new amount for updated dates, unchanged amount for blocked dates */
  betAmount: number;
}

/** Full PATCH /api/admin/config response body */
export interface ConfigUpdateResult {
  config: AdminConfigDTO;
  updatedDates: DatePropagationResult[];
  blockedDates: DatePropagationResult[];
}

// ─── Request shapes ─────────────────────────────────────────────────────────

export interface CreateUserPayload {
  username: string;
  password: string;
  balance?: number;
}

export interface AdjustBalancePayload {
  amount: number;
  reason: string;
}

export interface CreateTournamentPayload {
  name: string;
  commission?: number;
  betAmount?: number;
}

/** Body for POST /api/admin/dates — the tournament that gets the new date */
export interface CreateDatePayload {
  tournamentId: number;
}

export interface SetMatchResultPayload {
  result: string;
  score?: string;
}

export interface UpdateConfigPayload {
  key: string;
  value: number | boolean;
}

// ─── API functions ──────────────────────────────────────────────────────────

export const adminApi = {
  // ── Users ───────────────────────────────────────────────────────────────

  /** GET /api/admin/users — all users (no password hashes) */
  getUsers() {
    return client.get<{ users: AdminUserDTO[] }>('/admin/users').then((r) => r.data.users);
  },

  /** POST /api/admin/users — create a new user */
  createUser(payload: CreateUserPayload) {
    return client.post<{ user: AdminUserDTO }>('/admin/users', payload).then((r) => r.data.user);
  },

  /** PATCH /api/admin/users/:userId/balance — adjust user balance */
  adjustBalance(userId: string, payload: AdjustBalancePayload) {
    return client.patch<AdminUserDTO>(`/admin/users/${userId}/balance`, payload).then((r) => r.data);
  },

  /** DELETE /api/admin/users/:userId — delete user */
  deleteUser(userId: string) {
    return client.delete(`/admin/users/${userId}`).then((r) => r.data);
  },

  // ── Tournaments & matches ────────────────────────────────────────────────

  /** GET /api/admin/tournaments — all tournaments with their match dates */
  getTournaments() {
    return client
      .get<{ tournaments: AdminTournamentDTO[] }>('/admin/tournaments')
      .then((r) => r.data.tournaments);
  },

  /** POST /api/admin/tournaments — create a new tournament */
  createTournament(payload: CreateTournamentPayload) {
    return client
      .post<{ tournament: AdminTournamentDTO }>('/admin/tournaments', payload)
      .then((r) => r.data.tournament);
  },

  /** POST /api/admin/tournaments/:tournamentId/terminate — freeze the active tournament */
  terminateTournament(tournamentId: number) {
    return client
      .post<TerminateTournamentResult>(`/admin/tournaments/${tournamentId}/terminate`)
      .then((r) => r.data);
  },

  /** POST /api/admin/tournaments/:tournamentId/archive — archive a finished tournament, auto-create the next */
  archiveTournament(tournamentId: number) {
    return client
      .post<ArchiveTournamentResult>(`/admin/tournaments/${tournamentId}/archive`)
      .then((r) => r.data);
  },

  /** PATCH /api/admin/matches/:matchId/result — set match result */
  setMatchResult(matchId: number, payload: SetMatchResultPayload) {
    return client
      .patch(`/admin/matches/${matchId}/result`, payload)
      .then((r) => r.data.match);
  },

  /** POST /api/admin/dates — create the next date for a tournament (open, auto-numbered) */
  createDate(payload: CreateDatePayload) {
    return client
      .post<{ matchDate: MatchDateDTO }>('/admin/dates', payload)
      .then((r) => r.data.matchDate);
  },

  /** POST /api/admin/matches — create a match on an open date */
  createMatch(payload: CreateMatchPayload) {
    return client
      .post<{ match: MatchDTO }>('/admin/matches', payload)
      .then((r) => r.data.match);
  },

  /** PATCH /api/admin/matches/:matchId — partial update of match details (open date only) */
  updateMatchDetails(matchId: number, payload: UpdateMatchDetailsPayload) {
    return client
      .patch<{ match: MatchDTO }>(`/admin/matches/${matchId}`, payload)
      .then((r) => r.data.match);
  },

  /** POST /api/admin/dates/:dateId/close — close a match date and process points */
  closeDate(dateId: number) {
    return client.post(`/admin/dates/${dateId}/close`).then((r) => r.data);
  },

  /** POST /api/admin/dates/:dateId/publish-results — pay winners or roll pozo into carryover */
  publishResults(dateId: number) {
    return client.post(`/admin/dates/${dateId}/publish-results`).then((r) => r.data);
  },

  // ── Config ───────────────────────────────────────────────────────────────

  /** GET /api/admin/config — get system config */
  getConfig() {
    return client
      .get<{ config: AdminConfigDTO }>('/admin/config')
      .then((r) => r.data.config);
  },

  /** PATCH /api/admin/config — update a single config key */
  updateConfig(payload: UpdateConfigPayload) {
    return client
      .patch<ConfigUpdateResult>('/admin/config', payload)
      .then((r) => r.data);
  },
};
