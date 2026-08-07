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
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

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
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['user', 'admin'] }).default('user').notNull(),
  balance: integer('balance').default(0).notNull(), // cents
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  // Usernames are unique under a normalized comparison key: case-folded only.
  // Whitespace is NOT stripped (usernames are stored and compared as written
  // beyond case). Comparison-only — usernames are stored as typed.
  uniqueIndex('idx_users_username_normalized_unique').on(sql`lower(${table.username})`),
]);

// ── Tournaments ────────────────────────────────────────────────
export const tournaments = pgTable('tournaments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  commission: numeric('commission', { precision: 5, scale: 2 }).default('15.00').notNull(),
  status: text('status', { enum: ['active', 'finished', 'archived'] }).default('active').notNull(),
  finishedAt: timestamp('finished_at'),
  carryover: integer('carryover').default(0).notNull(), // cents — unpaid pozo rolled to next date
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  // Names are unique under a normalized comparison key: case-folded, all
  // whitespace stripped. Comparison-only — names are stored as written.
  uniqueIndex('idx_tournaments_name_normalized_unique').on(
    sql`lower(regexp_replace(${table.name}, '\\s+', '', 'g'))`,
  ),
]);

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

// ── Tournament Points ──────────────────────────────────────────
// One row per user+tournament+date, written only when a date is
// published (status 'results'). Ranking reads these rows instead of
// recomputing from tickets on the fly.
export const tournamentPoints = pgTable('tournament_points', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  tournamentId: integer('tournament_id').references(() => tournaments.id).notNull(),
  matchDateId: integer('match_date_id').references(() => matchDates.id).notNull(),
  points: integer('points').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_tournament_points_tournament_date_user')
    .on(table.tournamentId, table.matchDateId, table.userId),
  index('idx_tournament_points_tournament_user').on(table.tournamentId, table.userId),
]);

// ── Tournament Winners ─────────────────────────────────────────
// All users tied at the maximum tournament points at terminate.
// Multi-winner (tie) by construction — see design D1.
export const tournamentWinners = pgTable('tournament_winners', {
  id: serial('id').primaryKey(),
  tournamentId: integer('tournament_id').references(() => tournaments.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
}, (table) => [
  uniqueIndex('idx_tournament_winners_tournament_user')
    .on(table.tournamentId, table.userId),
]);
