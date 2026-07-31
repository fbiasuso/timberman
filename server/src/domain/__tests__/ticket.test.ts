import { describe, it, expect } from 'vitest';
import { Ticket } from '../entities/ticket.js';
import { TicketPrediction } from '../entities/ticket-prediction.js';

describe('Ticket', () => {
  const predictions = [
    TicketPrediction.new({ matchId: 1, prediction: 'L' }),
    TicketPrediction.new({ matchId: 2, prediction: 'E' }),
    TicketPrediction.new({ matchId: 3, prediction: 'V' }),
  ];

  describe('constructor', () => {
    it('creates a ticket with predictions', () => {
      const ticket = Ticket.new({
        id: 1,
        userId: 'user-1',
        matchDateId: 10,
        betAmount: 1500,
        predictions,
      });
      expect(ticket.id).toBe(1);
      expect(ticket.userId).toBe('user-1');
      expect(ticket.matchDateId).toBe(10);
      expect(ticket.betAmount.cents).toBe(1500);
      expect(ticket.totalPredictions()).toBe(3);
    });
  });

  describe('validation', () => {
    it('creates ticket predictions with valid predictions', () => {
      const tp = TicketPrediction.create({
        id: 1,
        ticketId: 1,
        matchId: 1,
        prediction: 'L',
      });
      expect(tp.matchId).toBe(1);
      expect(tp.prediction).toBe('L');
    });
  });

  describe('toSnapshot', () => {
    it('exports a valid snapshot', () => {
      const ticket = Ticket.new({
        id: 1,
        userId: 'user-1',
        matchDateId: 10,
        betAmount: 1500,
        predictions,
      });
      const snapshot = ticket.toSnapshot();
      expect(snapshot.id).toBe(1);
      expect(snapshot.userId).toBe('user-1');
      expect(snapshot.betAmount).toBe(1500);
    });
  });

  describe('withPrize', () => {
    const ticket = Ticket.new({
      id: 1,
      userId: 'user-1',
      matchDateId: 10,
      betAmount: 1500,
      predictions,
    });

    it('returns a new instance with the prize set', () => {
      const updated = ticket.withPrize(334);
      expect(updated).not.toBe(ticket);
      expect(updated.prizeWon).toBe(334);
      expect(updated.id).toBe(ticket.id);
      expect(updated.betAmount.cents).toBe(1500);
      expect(updated.totalPredictions()).toBe(3);
    });

    it('does not mutate the original instance', () => {
      ticket.withPrize(999);
      expect(ticket.prizeWon).toBeNull();
    });

    it('round-trips prizeWon through the snapshot', () => {
      const updated = ticket.withPrize(750);
      expect(updated.toSnapshot().prizeWon).toBe(750);
    });
  });
});
