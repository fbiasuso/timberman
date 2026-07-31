import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  uuid,
  boolean,
  numeric,
  index,
} from 'drizzle-orm/pg-core';

// ── System Config ────────────────────────────────────────────────
export const systemConfig = pgTable('system_config', {
  id: serial('id').primaryKey(),
  commission: numeric('commission', { precision: 5, scale: 2 }).default('15.00').notNull(),
  allowRegistration: boolean('allow_registration').default(true).notNull(),
  defaultBetAmount: integer('default_bet_amount').default(1500).notNull(), // cents
});

// ── Users ──────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: text('username').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['user', 'admin'] }).default('user').notNull(),
  balance: integer('balance').default(0).notNull(), // cents
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Tournaments ────────────────────────────────────────────────
export const tournaments = pgTable('tournaments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  commission: numeric('commission', { precision: 5, scale: 2 }).default('15.00').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  carryover: integer('carryover').default(0).notNull(), // cents — unpaid pozo rolled to next date
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Match Dates ────────────────────────────────────────────────
export const matchDates = pgTable('match_dates', {
  id: serial('id').primaryKey(),
  tournamentId: integer('tournament_id').references(() => tournaments.id),
  dateNumber: integer('date_number').notNull(),
  status: text('status', { enum: ['open', 'closed', 'results'] }).default('open').notNull(),
  pozo: integer('pozo').default(0).notNull(),
  betAmount: integer('bet_amount').default(1500).notNull(), // cents
  commission: numeric('commission', { precision: 5, scale: 2 }).default('0.00').notNull(), // % snapshot at close
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_match_dates_tournament').on(table.tournamentId),
]);

// ── Matches ────────────────────────────────────────────────────
export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  matchDateId: integer('match_date_id').references(() => matchDates.id).notNull(),
  localTeam: text('local_team').notNull(),
  visitorTeam: text('visitor_team').notNull(),
  localImg: text('local_img'),
  visitorImg: text('visitor_img'),
  scheduledAt: timestamp('scheduled_at'),
  result: text('result', { enum: ['L', 'E', 'V'] }),
  score: text('score'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_matches_date').on(table.matchDateId),
]);

// ── Tickets ────────────────────────────────────────────────────
export const tickets = pgTable('tickets', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  matchDateId: integer('match_date_id').references(() => matchDates.id).notNull(),
  betAmount: integer('bet_amount').notNull(),
  prizeWon: integer('prize_won'), // cents — set when results are published
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_tickets_user_date').on(table.userId, table.matchDateId),
]);

// ── Ticket Predictions ─────────────────────────────────────────
export const ticketPredictions = pgTable('ticket_predictions', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id').references(() => tickets.id).notNull(),
  matchId: integer('match_id').references(() => matches.id).notNull(),
  prediction: text('prediction', { enum: ['L', 'E', 'V'] }).notNull(),
}, (table) => [
  index('idx_predictions_ticket').on(table.ticketId),
]);

// ── Audit Logs ─────────────────────────────────────────────────
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  adminId: uuid('admin_id').references(() => users.id).notNull(),
  userId: uuid('user_id').references(() => users.id),
  action: text('action').notNull(),
  amount: integer('amount'),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_audit_admin').on(table.adminId),
]);
