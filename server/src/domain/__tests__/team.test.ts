import { describe, it, expect } from 'vitest';
import { Team } from '../entities/team.js';

describe('Team', () => {
  it('new defaults aliases and logo to null and keeps leagueIds', () => {
    const team = Team.new({ id: 0, name: 'River Plate', leagueIds: [1, 2] });

    expect(team.id).toBe(0);
    expect(team.name).toBe('River Plate');
    expect(team.aliases).toBeNull();
    expect(team.logo).toBeNull();
    expect(team.leagueIds).toEqual([1, 2]);
    expect(team.createdAt).toBeInstanceOf(Date);
  });

  it('new keeps provided aliases and logo', () => {
    const team = Team.new({
      id: 0,
      name: 'River Plate',
      aliases: ['El Millonario'],
      logo: 'logos/7.png',
      leagueIds: [1],
    });

    expect(team.aliases).toEqual(['El Millonario']);
    expect(team.logo).toBe('logos/7.png');
  });

  it('create round-trips through toSnapshot', () => {
    const original = Team.new({ id: 7, name: 'Boca Juniors', aliases: ['Xeneize'], leagueIds: [1] });
    const restored = Team.create(original.toSnapshot());

    expect(restored.toSnapshot()).toEqual(original.toSnapshot());
  });
});
