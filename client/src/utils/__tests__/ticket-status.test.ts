import { describe, it, expect } from 'vitest';
import { deriveTicketStatus } from '../ticket-status';

describe('deriveTicketStatus', () => {
  it('returns Pagado when the ticket has a prize, regardless of date status', () => {
    expect(deriveTicketStatus({ prizeWon: 500 }, 'open')).toBe('Pagado');
    expect(deriveTicketStatus({ prizeWon: 0 }, 'results')).toBe('Pagado');
  });

  it('returns Sin premio on a results date without a prize', () => {
    expect(deriveTicketStatus({ prizeWon: null }, 'results')).toBe('Sin premio');
  });

  it('returns Pendiente on open/closed dates without a prize', () => {
    expect(deriveTicketStatus({ prizeWon: null }, 'open')).toBe('Pendiente');
    expect(deriveTicketStatus({ prizeWon: null }, 'closed')).toBe('Pendiente');
  });

  it('returns Pendiente when the date status is unknown', () => {
    expect(deriveTicketStatus({ prizeWon: null }, undefined)).toBe('Pendiente');
    expect(deriveTicketStatus({ prizeWon: null }, null)).toBe('Pendiente');
  });
});
