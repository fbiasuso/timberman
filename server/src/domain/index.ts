// ── Entities ──────────────────────────────────────────────────────
export {
  User,
  Tournament,
  MatchDate,
  Match,
  Ticket,
  TicketPrediction,
  AuditLog,
  DEFAULT_SYSTEM_CONFIG,
} from './entities/index.js';
export type {
  UserRole,
  UserSnapshot,
  TournamentStatus,
  TournamentSnapshot,
  MatchDateStatus,
  MatchDateSnapshot,
  MatchSnapshot,
  TicketSnapshot,
  TicketPredictionSnapshot,
  AuditLogSnapshot,
  SystemConfig,
} from './entities/index.js';

// ── Value Objects ─────────────────────────────────────────────────
export {
  PREDICTIONS,
  isPrediction,
  assertPrediction,
  Money,
  Commission,
} from './value-objects/index.js';
export type { Prediction } from './value-objects/index.js';

// ── Ports (interfaces) ────────────────────────────────────────────
export type {
  UserRepo,
  TournamentRepo,
  TournamentPointsRepo,
  MatchRepo,
  TicketRepo,
  AuditLogRepo,
  SystemConfigRepo,
} from './ports/index.js';

// ── Domain Errors ─────────────────────────────────────────────────
export {
  DomainError,
  InsufficientBalanceError,
  InvalidCommissionError,
  InvalidPredictionError,
  InvalidMatchResultError,
  DuplicateBetError,
  DateNotOpenError,
  DateNotClosedError,
  OpenDateExistsError,
  MatchDateNotOpenError,
  MatchesNotReadyError,
  BetModificationNotAllowedError,
  TournamentOpenDateError,
  TournamentNotActiveError,
  TournamentNotFinishedError,
  TournamentNameAlreadyExistsError,
  RegistrationDisabledError,
  UserNotFoundError,
  TournamentNotFoundError,
  MatchDateNotFoundError,
  MatchNotFoundError,
  TicketNotFoundError,
  InvalidCredentialsError,
  UnauthorizedError,
  ForbiddenError,
  DuplicateUsernameError,
  ConfigNotFoundError,
} from './errors/index.js';
