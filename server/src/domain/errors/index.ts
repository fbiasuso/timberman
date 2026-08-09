/**
 * Domain error hierarchy — all domain errors extend DomainError.
 *
 * Using classes (not just strings/objects) so that error handlers
 * can use `instanceof` checks for precise error handling.
 */

export abstract class DomainError extends Error {
  public readonly timestamp: Date;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
  }

  /** Machine-readable error code for API responses */
  abstract get code(): string;

  /** HTTP status code that maps to this error */
  abstract get statusCode(): number;
}

// ── Balance Errors ────────────────────────────────────────────────

export class InsufficientBalanceError extends DomainError {
  /** User id (diagnostics only — the API message uses the username). */
  readonly userId: string;

  constructor(userId: string, username: string, balance: number, required: number) {
    super(`El usuario "${username}" no tiene saldo suficiente. Requerido: ${required}, Disponible: ${balance}`);
    this.userId = userId;
  }

  get code(): string { return 'INSUFFICIENT_BALANCE'; }
  get statusCode(): number { return 422; }
}

// ── Validation Errors ─────────────────────────────────────────────

export class InvalidCommissionError extends DomainError {
  constructor(value: number) {
    super(`Invalid commission value: ${value}. Must be between 0 and 100.`);
  }

  get code(): string { return 'INVALID_COMMISSION'; }
  get statusCode(): number { return 400; }
}

export class InvalidConfigValueError extends DomainError {
  constructor(key: string, value: number, expected: string) {
    super(`Invalid configuration value for "${key}": ${value}. Expected ${expected}.`);
  }

  get code(): string { return 'INVALID_CONFIG_VALUE'; }
  get statusCode(): number { return 400; }
}

export class InvalidPredictionError extends DomainError {
  constructor(value: string) {
    super(`Invalid prediction: "${value}". Must be one of: L, E, V.`);
  }

  get code(): string { return 'INVALID_PREDICTION'; }
  get statusCode(): number { return 400; }
}

export class InvalidMatchResultError extends DomainError {
  constructor(message = 'Ingresá un marcador válido (0 a 20)') {
    super(message);
  }

  get code(): string { return 'INVALID_MATCH_RESULT'; }
  get statusCode(): number { return 422; }
}

// ── Business Rule Errors ──────────────────────────────────────────

export class DuplicateBetError extends DomainError {
  constructor(userId: string, matchDateId: number) {
    super(`User "${userId}" already has a bet on match date ${matchDateId}`);
  }

  get code(): string { return 'DUPLICATE_BET'; }
  get statusCode(): number { return 409; }
}

export class DateNotOpenError extends DomainError {
  constructor(matchDateId: number, status: string) {
    super(`Match date ${matchDateId} is not open for betting. Current status: "${status}"`);
  }

  get code(): string { return 'DATE_NOT_OPEN'; }
  get statusCode(): number { return 422; }
}

export class DateNotClosedError extends DomainError {
  constructor(matchDateId: number, status: string) {
    super(`Match date ${matchDateId} is not closed. Current status: "${status}"`);
  }

  get code(): string { return 'DATE_NOT_CLOSED'; }
  get statusCode(): number { return 409; }
}

export class OpenDateExistsError extends DomainError {
  constructor(tournamentId: number) {
    super(`Tournament ${tournamentId} already has an open match date. Only one betting round can be open at a time.`);
  }

  get code(): string { return 'OPEN_DATE_EXISTS'; }
  get statusCode(): number { return 409; }
}

export class MatchDateNotOpenError extends DomainError {
  constructor(matchDateId: number, status: string) {
    super(`Match date ${matchDateId} is not open for closing. Current status: "${status}"`);
  }

  get code(): string { return 'MATCH_DATE_NOT_OPEN'; }
  get statusCode(): number { return 409; }
}

export class MatchesNotReadyError extends DomainError {
  constructor(matchDateId: number) {
    super(`Match date ${matchDateId} has matches without a result. Set all results before publishing.`);
  }

  get code(): string { return 'MATCHES_NOT_READY'; }
  get statusCode(): number { return 422; }
}

export class BetModificationNotAllowedError extends DomainError {
  constructor(ticketId: number) {
    super(`Bet ${ticketId} cannot be modified after submission`);
  }

  get code(): string { return 'BET_IMMUTABLE'; }
  get statusCode(): number { return 405; }
}

// ── Tournament Lifecycle Errors ─────────────────────────────────

export class TournamentOpenDateError extends DomainError {
  constructor(tournamentId: number) {
    super(`Tournament ${tournamentId} still has an open match date. Close or publish it before terminating.`);
  }

  get code(): string { return 'TOURNAMENT_OPEN_DATE'; }
  get statusCode(): number { return 409; }
}

export class TournamentNotActiveError extends DomainError {
  constructor(tournamentId: number, status: string) {
    super(`Tournament ${tournamentId} is not active. Current status: "${status}"`);
  }

  get code(): string { return 'TOURNAMENT_NOT_ACTIVE'; }
  get statusCode(): number { return 422; }
}

export class TournamentNotFinishedError extends DomainError {
  constructor(tournamentId: number, status: string) {
    super(`Tournament ${tournamentId} is not finished. Current status: "${status}"`);
  }

  get code(): string { return 'TOURNAMENT_NOT_FINISHED'; }
  get statusCode(): number { return 422; }
}

export class RegistrationDisabledError extends DomainError {
  constructor() {
    super('El registro está deshabilitado. Contactá a un administrador.');
  }

  get code(): string { return 'REGISTRATION_DISABLED'; }
  get statusCode(): number { return 403; }
}

export class TournamentNameAlreadyExistsError extends DomainError {
  /** Colliding tournament name (diagnostics only — the API message is fixed). */
  readonly tournamentName: string;

  constructor(tournamentName: string) {
    super('Ya existe un torneo con ese nombre');
    this.tournamentName = tournamentName;
  }

  get code(): string { return 'TOURNAMENT_NAME_TAKEN'; }
  get statusCode(): number { return 409; }
}

// ── Team Registry Errors ─────────────────────────────────────────

export class LeagueNameAlreadyExistsError extends DomainError {
  /** Colliding league name (diagnostics only — the API message is fixed). */
  readonly leagueName: string;

  constructor(leagueName: string) {
    super('Ya existe una liga con ese nombre');
    this.leagueName = leagueName;
  }

  get code(): string { return 'LEAGUE_NAME_TAKEN'; }
  get statusCode(): number { return 409; }
}

export class TeamNameAlreadyExistsError extends DomainError {
  /** Colliding team name (diagnostics only — the API message is fixed). */
  readonly teamName: string;

  constructor(teamName: string) {
    super('Ya existe un equipo con ese nombre');
    this.teamName = teamName;
  }

  get code(): string { return 'TEAM_NAME_TAKEN'; }
  get statusCode(): number { return 409; }
}

/** A team must belong to at least one league — membership invariant (400). */
export class TeamNeedsLeagueError extends DomainError {
  /** teamId is absent on create (no id exists yet) — the message drops it. */
  constructor(teamId?: number) {
    super(teamId === undefined
      ? 'Un equipo debe pertenecer al menos a una liga'
      : `El equipo ${teamId} debe pertenecer al menos a una liga`);
  }

  get code(): string { return 'TEAM_NEEDS_LEAGUE'; }
  get statusCode(): number { return 400; }
}

/** League delete guard — the league still has team memberships (409). */
export class LeagueHasTeamsError extends DomainError {
  constructor(leagueId: number, teamCount: number) {
    super(`No se puede eliminar la liga ${leagueId}: todavía tiene ${teamCount} equipo(s)`);
  }

  get code(): string { return 'LEAGUE_HAS_TEAMS'; }
  get statusCode(): number { return 409; }
}

/** Team delete guard — the team is referenced by at least one match (409). */
export class TeamReferencedByMatchesError extends DomainError {
  constructor(teamId: number, matchCount: number) {
    super(`No se puede eliminar el equipo ${teamId}: está referenciado por ${matchCount} partido(s)`);
  }

  get code(): string { return 'TEAM_REFERENCED_BY_MATCHES'; }
  get statusCode(): number { return 409; }
}

/**
 * A team id on match create/edit could not be resolved against the registry —
 * semantic resolution failure (422, design D4). Distinct from TeamNotFoundError
 * (404) which is for registry CRUD on a missing id.
 */
export class TeamNotResolvableError extends DomainError {
  constructor(teamId: number) {
    super(`El equipo ${teamId} no existe en el registro`);
  }

  get code(): string { return 'TEAM_NOT_RESOLVABLE'; }
  get statusCode(): number { return 422; }
}

// ── Not Found Errors ──────────────────────────────────────────────

export class UserNotFoundError extends DomainError {
  constructor(identifier: string) {
    super(`User not found: "${identifier}"`);
  }

  get code(): string { return 'USER_NOT_FOUND'; }
  get statusCode(): number { return 404; }
}

export class TournamentNotFoundError extends DomainError {
  constructor(id: number) {
    super(`Tournament not found: ${id}`);
  }

  get code(): string { return 'TOURNAMENT_NOT_FOUND'; }
  get statusCode(): number { return 404; }
}

export class LeagueNotFoundError extends DomainError {
  constructor(id: number) {
    super(`League not found: ${id}`);
  }

  get code(): string { return 'LEAGUE_NOT_FOUND'; }
  get statusCode(): number { return 404; }
}

export class TeamNotFoundError extends DomainError {
  constructor(id: number) {
    super(`Team not found: ${id}`);
  }

  get code(): string { return 'TEAM_NOT_FOUND'; }
  get statusCode(): number { return 404; }
}

export class MatchDateNotFoundError extends DomainError {
  constructor(id: number) {
    super(`Match date not found: ${id}`);
  }

  get code(): string { return 'MATCH_DATE_NOT_FOUND'; }
  get statusCode(): number { return 404; }
}

export class MatchNotFoundError extends DomainError {
  constructor(id: number) {
    super(`Match not found: ${id}`);
  }

  get code(): string { return 'MATCH_NOT_FOUND'; }
  get statusCode(): number { return 404; }
}

export class TicketNotFoundError extends DomainError {
  constructor(id: number) {
    super(`Ticket not found: ${id}`);
  }

  get code(): string { return 'TICKET_NOT_FOUND'; }
  get statusCode(): number { return 404; }
}

// ── Auth Errors ───────────────────────────────────────────────────

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('Usuario o contraseña incorrectos');
  }

  get code(): string { return 'INVALID_CREDENTIALS'; }
  get statusCode(): number { return 401; }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Autenticación requerida') {
    super(message);
  }

  get code(): string { return 'UNAUTHORIZED'; }
  get statusCode(): number { return 401; }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Se requieren permisos de administrador') {
    super(message);
  }

  get code(): string { return 'FORBIDDEN'; }
  get statusCode(): number { return 403; }
}

export class DuplicateUsernameError extends DomainError {
  constructor(username: string) {
    super(`El nombre de usuario "${username}" ya está en uso`);
  }

  get code(): string { return 'DUPLICATE_USERNAME'; }
  get statusCode(): number { return 409; }
}

// ── Config Errors ─────────────────────────────────────────────────

export class ConfigNotFoundError extends DomainError {
  constructor(key: string) {
    super(`Configuration key not found: "${key}"`);
  }

  get code(): string { return 'CONFIG_NOT_FOUND'; }
  get statusCode(): number { return 404; }
}
