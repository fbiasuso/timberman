import client from './client';
import type { UserDTO } from './auth-api';
import type { MatchDateStatus, MatchDTO, MatchDateDTO } from '../types';
import type { CreateMatchPayload, UpdateMatchDetailsPayload } from '../types';
import type { LeagueDTO, LeagueFormat, TeamDTO } from '../types';

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

/** Body for PATCH /api/admin/matches/:matchId/result — raw scores; the server derives L/E/V + composes "l-v" */
export interface SetMatchResultPayload {
  localScore: string;
  visitorScore: string;
}

export interface UpdateConfigPayload {
  key: string;
  value: number | boolean;
}

// ─── Teams & Leagues (registry) ─────────────────────────────────────────────

/** Body for POST /api/admin/leagues */
export interface CreateLeaguePayload {
  name: string;
  country: string;
  format: LeagueFormat;
}

/** Body for PATCH /api/admin/leagues/:leagueId — partial */
export type UpdateLeaguePayload = Partial<CreateLeaguePayload>;

/** Body for POST /api/admin/teams — at least one league membership required */
export interface CreateTeamPayload {
  name: string;
  aliases?: string[] | null;
  /** Remote shield URL — downloaded/validated/stored by the server */
  logoUrl?: string | null;
  leagueIds: number[];
}

/** Body for PATCH /api/admin/teams/:teamId — partial */
export interface UpdateTeamPayload {
  name?: string;
  aliases?: string[] | null;
  logoUrl?: string | null;
  /** When present it must keep ≥1 league (removing the last → 400) */
  leagueIds?: number[];
}

/** Result of POST /api/admin/teams/:teamId/logo (multipart or JSON) */
export interface SetTeamLogoResult {
  /** The team after the attempt — unchanged when `stored` is false */
  team: TeamDTO;
  /** false when the store backend rejected the bytes (team NOT updated) */
  stored: boolean;
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

  // ── Teams & Leagues (registry) ───────────────────────────────────────────

  /** GET /api/admin/leagues — all leagues with nested member teams (design D8) */
  getLeagues() {
    return client
      .get<{ leagues: LeagueDTO[] }>('/admin/leagues')
      .then((r) => r.data.leagues);
  },

  /** POST /api/admin/leagues — create a league */
  createLeague(payload: CreateLeaguePayload) {
    return client
      .post<{ league: LeagueDTO }>('/admin/leagues', payload)
      .then((r) => r.data.league);
  },

  /** PATCH /api/admin/leagues/:leagueId — update league fields */
  updateLeague(leagueId: number, payload: UpdateLeaguePayload) {
    return client
      .patch<{ league: LeagueDTO }>(`/admin/leagues/${leagueId}`, payload)
      .then((r) => r.data.league);
  },

  /** DELETE /api/admin/leagues/:leagueId — 409 while the league has memberships */
  deleteLeague(leagueId: number) {
    return client.delete(`/admin/leagues/${leagueId}`).then((r) => r.data);
  },

  /** GET /api/admin/leagues/:leagueId/teams — league member teams, ordered by name */
  getLeagueTeams(leagueId: number) {
    return client
      .get<{ teams: TeamDTO[] }>(`/admin/leagues/${leagueId}/teams`)
      .then((r) => r.data.teams);
  },

  /** POST /api/admin/teams — create a team with league memberships */
  createTeam(payload: CreateTeamPayload) {
    return client
      .post<{ team: TeamDTO }>('/admin/teams', payload)
      .then((r) => r.data.team);
  },

  /** PATCH /api/admin/teams/:teamId — update team fields / memberships */
  updateTeam(teamId: number, payload: UpdateTeamPayload) {
    return client
      .patch<{ team: TeamDTO }>(`/admin/teams/${teamId}`, payload)
      .then((r) => r.data.team);
  },

  /** DELETE /api/admin/teams/:teamId — 409 while the team is referenced by matches */
  deleteTeam(teamId: number) {
    return client.delete(`/admin/teams/${teamId}`).then((r) => r.data);
  },

  /** POST /api/admin/teams/:teamId/logo — upload a shield file (multipart
   *  field `file`). The browser sets the multipart boundary automatically, so
   *  the raw FormData is posted without a manual Content-Type. Returns the
   *  full `{ team, stored }` result: on 4xx the request rejects (surface via
   *  the mutation error); on 200 with `stored: false` the store backend failed
   *  and the team is returned unchanged. */
  setTeamLogo(teamId: number, file: File) {
    const form = new FormData();
    form.append('file', file);
    return client
      .post<SetTeamLogoResult>(`/admin/teams/${teamId}/logo`, form)
      .then((r) => r.data);
  },
};
