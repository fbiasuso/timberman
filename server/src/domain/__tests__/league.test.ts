import { describe, it, expect } from 'vitest';
import { League } from '../entities/league.js';

describe('League', () => {
  it('new builds a league with default createdAt and preserves fields', () => {
    const league = League.new({
      id: 0,
      name: 'Primera División',
      country: 'Argentina',
      format: 'liga',
    });

    expect(league.id).toBe(0);
    expect(league.name).toBe('Primera División');
    expect(league.country).toBe('Argentina');
    expect(league.format).toBe('liga');
    expect(league.createdAt).toBeInstanceOf(Date);
  });

  it('create round-trips through toSnapshot', () => {
    const original = League.new({ id: 3, name: 'Copa Argentina', country: 'Argentina', format: 'copa' });
    const restored = League.create(original.toSnapshot());

    expect(restored.toSnapshot()).toEqual(original.toSnapshot());
  });
});
