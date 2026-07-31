import client from './client';
import type { UserDTO } from './auth-api';

// ─── DTOs ───────────────────────────────────────────────────────────────────

export interface AdminUserDTO extends UserDTO {
  /** Total accumulated points */
  points: number;
}

export interface AdminTournamentDTO {
  id: number;
  name: string;
  commission: number;
  betAmount: number;
  createdAt: string;
}

export interface AdminConfigDTO {
  commission: number;
  allowRegistration: boolean;
  defaultBetAmount: number;
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

  /** PATCH /api/admin/matches/:matchId/result — set match result */
  setMatchResult(matchId: number, payload: SetMatchResultPayload) {
    return client
      .patch(`/admin/matches/${matchId}/result`, payload)
      .then((r) => r.data.match);
  },

  /** POST /api/admin/dates/:dateId/close — close a match date and process points */
  closeDate(dateId: number) {
    return client.post(`/admin/dates/${dateId}/close`).then((r) => r.data);
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
      .patch<{ config: AdminConfigDTO }>('/admin/config', payload)
      .then((r) => r.data.config);
  },
};
