/** Match outcome prediction: Local / Empate / Visita */
export type Prediction = 'L' | 'E' | 'V';

/** Match date status lifecycle */
export type MatchDateStatus = 'open' | 'closed' | 'results';

/** Match date DTO (from GET /api/matches/current and /dates) */
export interface MatchDateDTO {
  id: number;
  tournamentId: number;
  dateNumber: number;
  status: MatchDateStatus;
  pozo: number;
  betAmount: number;
  /** Commission percentage snapshot taken when the date was closed */
  commission: number;
  /** Cents — unpaid pozo accumulated in the parent tournament */
  carryover: number;
  createdAt: string;
}

/** Match DTO */
export interface MatchDTO {
  id: number;
  matchDateId: number;
  localTeam: string;
  visitorTeam: string;
  localImg: string | null;
  visitorImg: string | null;
  /** Registry team id — null for legacy free-text matches (design D10) */
  localTeamId: number | null;
  visitorTeamId: number | null;
  scheduledAt: string | null;
  result: string | null;
  score: string | null;
}

/** Body for POST /api/admin/matches — create a match on an open date */
export interface CreateMatchPayload {
  matchDateId: number;
  localTeam: string;
  visitorTeam: string;
  /** Image URLs / scheduled time are optional; null clears when updating */
  localImg?: string | null;
  visitorImg?: string | null;
  /** Registry team ids — enrichment only; null/absent keeps free text (FK null) */
  localTeamId?: number | null;
  visitorTeamId?: number | null;
  scheduledAt?: string | null;
}

/** Body for PATCH /api/admin/matches/:matchId — partial match details update */
export interface UpdateMatchDetailsPayload {
  localTeam?: string;
  visitorTeam?: string;
  localImg?: string | null;
  visitorImg?: string | null;
  /** Registry team id — resolving it sets the FK and overwrites the string (design D10) */
  localTeamId?: number | null;
  visitorTeamId?: number | null;
  scheduledAt?: string | null;
}

/** League competition format (server enum) */
export type LeagueFormat = 'liga' | 'copa';

/** Team registry DTO (flat entity — league membership via leagueIds) */
export interface TeamDTO {
  id: number;
  name: string;
  aliases: string[] | null;
  /** Self-hosted relative logo path (e.g. 'logos/5.png') or null */
  logo: string | null;
  leagueIds: number[];
  createdAt: string;
}

/** League DTO — GET /api/admin/leagues nests the member teams (design D8) */
export interface LeagueDTO {
  id: number;
  name: string;
  country: string;
  format: LeagueFormat;
  createdAt: string;
  teams: TeamDTO[];
}

/** Embedded match snapshot on a ticket prediction (team names + sanitized result) */
export interface TicketMatchDTO {
  localTeam: string;
  visitorTeam: string;
  /** Actual result — null unless the ticket's date is in 'results' status */
  result: string | null;
}

/** Ticket prediction DTO */
export interface TicketPredictionDTO {
  matchId: number;
  prediction: Prediction;
  /** Embedded match — filled by the server for GET/POST /api/bets */
  match?: TicketMatchDTO | null;
}

/** Ticket DTO (from GET /api/bets / POST /api/bets) */
export interface TicketDTO {
  id: number;
  userId: string;
  matchDateId: number;
  betAmount: number;
  /** Cents won after results are published — null until the ticket wins */
  prizeWon: number | null;
  predictions: TicketPredictionDTO[];
  createdAt: string;
}

/** Ranking entry DTO */
export interface RankingEntry {
  userId: string;
  username: string;
  totalPoints: number;
  position: number;
}

/** Per-date points breakdown for a user (matches server UserDateDetail DTO) */
export interface UserDateBreakdown {
  dateNumber: number;
  points: number;
  totalMatches: number;
  correctPredictions: number;
}
