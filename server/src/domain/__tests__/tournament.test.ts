import { describe, it, expect } from 'vitest';
import { Tournament } from '../entities/tournament.js';
import {
  TournamentNotActiveError,
  TournamentNotFinishedError,
} from '../errors/index.js';

describe('Tournament', () => {
  const baseSnapshot = {
    id: 1,
    name: 'Torneo Apertura',
    commission: 15,
    status: 'active' as const,
    finishedAt: null,
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
      expect(snap.status).toBe('active');
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

  describe('lifecycle', () => {
    it('finish() transitions an active tournament to finished and stamps finishedAt', () => {
      const tournament = Tournament.create(baseSnapshot);
      const finished = tournament.finish();

      expect(finished).not.toBe(tournament);
      expect(finished.status).toBe('finished');
      expect(finished.finishedAt).toBeInstanceOf(Date);
      // All other fields are preserved
      expect(finished.name).toBe(tournament.name);
      expect(finished.commission.equals(tournament.commission)).toBe(true);
      expect(finished.carryover).toBe(tournament.carryover);
      expect(finished.createdAt).toBe(tournament.createdAt);
    });

    it('finish() throws TournamentNotActiveError when the tournament is not active', () => {
      const finished = Tournament.create({
        ...baseSnapshot,
        status: 'finished',
        finishedAt: new Date('2025-06-01'),
      });
      const archived = Tournament.create({
        ...baseSnapshot,
        status: 'archived',
        finishedAt: new Date('2025-06-01'),
      });

      expect(() => finished.finish()).toThrow(TournamentNotActiveError);
      expect(() => archived.finish()).toThrow(TournamentNotActiveError);
    });

    it('archive() transitions a finished tournament to archived and preserves finishedAt', () => {
      const finished = Tournament.create({
        ...baseSnapshot,
        status: 'finished',
        finishedAt: new Date('2025-06-01'),
      });
      const archived = finished.archive();

      expect(archived).not.toBe(finished);
      expect(archived.status).toBe('archived');
      expect(archived.finishedAt).toBe(finished.finishedAt);
    });

    it('archive() throws TournamentNotFinishedError when the tournament is not finished', () => {
      const active = Tournament.create(baseSnapshot);
      const archived = Tournament.create({
        ...baseSnapshot,
        status: 'archived',
        finishedAt: new Date('2025-06-01'),
      });

      expect(() => active.archive()).toThrow(TournamentNotFinishedError);
      expect(() => archived.archive()).toThrow(TournamentNotFinishedError);
    });

    it('new() defaults status to active and finishedAt to null', () => {
      const tournament = Tournament.new({ id: 3, name: 'Nuevo' });

      expect(tournament.status).toBe('active');
      expect(tournament.finishedAt).toBeNull();
    });

    it('create() round-trips status and finishedAt from the snapshot', () => {
      const finishedAt = new Date('2025-06-01');
      const tournament = Tournament.create({
        ...baseSnapshot,
        status: 'archived',
        finishedAt,
      });

      expect(tournament.status).toBe('archived');
      expect(tournament.finishedAt).toBe(finishedAt);
    });
  });
});
