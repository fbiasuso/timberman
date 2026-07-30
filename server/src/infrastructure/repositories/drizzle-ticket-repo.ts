import { eq, and, count } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema.js';
import type { TicketRepo } from '../../domain/ports/ticket-repo.js';
import { Ticket } from '../../domain/entities/ticket.js';
import { TicketPrediction } from '../../domain/entities/ticket-prediction.js';
import type { TicketSnapshot, TicketPredictionSnapshot } from '../../domain/entities/index.js';

export class DrizzleTicketRepo implements TicketRepo {
  constructor(private readonly db: PostgresJsDatabase<any>) {}

  async findById(id: number): Promise<Ticket | null> {
    const [row] = await this.db
      .select()
      .from(schema.tickets)
      .where(eq(schema.tickets.id, id));
    if (!row) return null;

    const predictions = await this.loadPredictions(id);
    return Ticket.create(row as unknown as TicketSnapshot, predictions);
  }

  async findByUserId(userId: string): Promise<Ticket[]> {
    const rows = await this.db
      .select()
      .from(schema.tickets)
      .where(eq(schema.tickets.userId, userId))
      .orderBy(schema.tickets.createdAt);

    const tickets: Ticket[] = [];
    for (const row of rows) {
      const predictions = await this.loadPredictions(row.id);
      tickets.push(Ticket.create(row as unknown as TicketSnapshot, predictions));
    }
    return tickets;
  }

  async findByMatchDateId(matchDateId: number): Promise<Ticket[]> {
    const rows = await this.db
      .select()
      .from(schema.tickets)
      .where(eq(schema.tickets.matchDateId, matchDateId));

    const tickets: Ticket[] = [];
    for (const row of rows) {
      const predictions = await this.loadPredictions(row.id);
      tickets.push(Ticket.create(row as unknown as TicketSnapshot, predictions));
    }
    return tickets;
  }

  async findByUserAndDate(userId: string, matchDateId: number): Promise<Ticket | null> {
    const [row] = await this.db
      .select()
      .from(schema.tickets)
      .where(
        and(
          eq(schema.tickets.userId, userId),
          eq(schema.tickets.matchDateId, matchDateId),
        ),
      );
    if (!row) return null;

    const predictions = await this.loadPredictions(row.id);
    return Ticket.create(row as unknown as TicketSnapshot, predictions);
  }

  async save(ticket: Ticket, predictions: TicketPrediction[]): Promise<Ticket> {
    // Insert the ticket row
    const snap = ticket.toSnapshot();
    const [ticketRow] = await this.db
      .insert(schema.tickets)
      .values({
        userId: snap.userId,
        matchDateId: snap.matchDateId,
        betAmount: snap.betAmount,
      })
      .returning();

    // Insert all predictions with the generated ticket ID
    if (predictions.length > 0) {
      await this.db.insert(schema.ticketPredictions).values(
        predictions.map((tp) => ({
          ticketId: ticketRow.id,
          matchId: tp.matchId,
          prediction: tp.prediction,
        })),
      );
    }

    // Reload predictions to return a complete Ticket entity
    const loadedPredictions = await this.loadPredictions(ticketRow.id);
    return Ticket.create(ticketRow as unknown as TicketSnapshot, loadedPredictions);
  }

  async countByMatchDateId(matchDateId: number): Promise<number> {
      const result = await this.db
        .select({ value: count() })
        .from(schema.tickets)
        .where(eq(schema.tickets.matchDateId, matchDateId));
      return Number(result[0]?.value ?? 0);
  }

  // ── Private Helpers ─────────────────────────────────────────────

  private async loadPredictions(ticketId: number): Promise<TicketPrediction[]> {
    const rows = await this.db
      .select()
      .from(schema.ticketPredictions)
      .where(eq(schema.ticketPredictions.ticketId, ticketId));
    return rows.map((row) =>
      TicketPrediction.create(row as unknown as TicketPredictionSnapshot),
    );
  }
}
