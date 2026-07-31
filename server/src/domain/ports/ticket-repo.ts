import type { Ticket } from '../entities/ticket.js';
import type { TicketPrediction } from '../entities/ticket-prediction.js';

/**
 * Repository port for Ticket aggregate.
 *
 * Tickets are loaded together with their predictions. Infrastructure
 * adapters handle the join-table mapping internally.
 */
export interface TicketRepo {
  findById(id: number): Promise<Ticket | null>;
  findByUserId(userId: string): Promise<Ticket[]>;
  findByMatchDateId(matchDateId: number): Promise<Ticket[]>;
  findByUserAndDate(userId: string, matchDateId: number): Promise<Ticket | null>;
  save(ticket: Ticket, predictions: TicketPrediction[]): Promise<Ticket>;
  update(ticket: Ticket): Promise<Ticket>;
  countByMatchDateId(matchDateId: number): Promise<number>;
}
