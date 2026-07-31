import { describe, it, expect } from 'vitest';
import { Tournament } from '../entities/tournament.js';

describe('Tournament', () => {
  const baseSnapshot = {
    id: 1,
    name: 'Torneo Apertura',
    commission: 15,
    isActive: true,
    carryover: 0,
    createdAt: new Date('2025-01-01'),
  };

  describe('withCarryover', () => {
    it('returns a new instance with the carryover set', () => {
      const tournament = Tournament.create(baseSnapshot);
      const updated = tournament.withCarryover(1500);

      expect(updated).not.toBe(tournament);
      expect(updated.carryover).toBe(1500);
      expect(updated.id).toBe(tournament.id);
      expect(updated.name).toBe(tournament.name);
    });

    it('does not mutate the original instance', () => {
      const tournament = Tournament.create(baseSnapshot);
      tournament.withCarryover(3000);

      expect(tournament.carryover).toBe(0);
    });

    it('preserves other fields through the snapshot round-trip', () => {
      const tournament = Tournament.create(baseSnapshot);
      const updated = tournament.withCarryover(750);
      const snap = updated.toSnapshot();

      expect(snap.carryover).toBe(750);
      expect(snap.commission).toBe(15);
      expect(snap.isActive).toBe(true);
    });
  });

  describe('create / new', () => {
    it('creates a tournament from snapshot with carryover', () => {
      const tournament = Tournament.create({ ...baseSnapshot, carryover: 1200 });
      expect(tournament.carryover).toBe(1200);
    });

    it('defaults carryover to 0 for new tournaments', () => {
      const tournament = Tournament.new({ id: 2, name: 'Nuevo' });
      expect(tournament.carryover).toBe(0);
    });
  });
});
