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
  constructor(userId: string, balance: number, required: number) {
    super(`User "${userId}" has insufficient balance. Required: ${required}, Available: ${balance}`);
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

export class InvalidPredictionError extends DomainError {
  constructor(value: string) {
    super(`Invalid prediction: "${value}". Must be one of: L, E, V.`);
  }

  get code(): string { return 'INVALID_PREDICTION'; }
  get statusCode(): number { return 400; }
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

export class BetModificationNotAllowedError extends DomainError {
  constructor(ticketId: number) {
    super(`Bet ${ticketId} cannot be modified after submission`);
  }

  get code(): string { return 'BET_IMMUTABLE'; }
  get statusCode(): number { return 405; }
}

export class RegistrationDisabledError extends DomainError {
  constructor() {
    super('Self-registration is disabled. Contact an administrator.');
  }

  get code(): string { return 'REGISTRATION_DISABLED'; }
  get statusCode(): number { return 403; }
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
    super('Invalid username or password');
  }

  get code(): string { return 'INVALID_CREDENTIALS'; }
  get statusCode(): number { return 401; }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Authentication required') {
    super(message);
  }

  get code(): string { return 'UNAUTHORIZED'; }
  get statusCode(): number { return 401; }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Admin access required') {
    super(message);
  }

  get code(): string { return 'FORBIDDEN'; }
  get statusCode(): number { return 403; }
}

export class DuplicateUsernameError extends DomainError {
  constructor(username: string) {
    super(`Username "${username}" is already taken`);
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
