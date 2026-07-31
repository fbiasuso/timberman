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
  DuplicateBetError,
  DateNotOpenError,
  BetModificationNotAllowedError,
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
