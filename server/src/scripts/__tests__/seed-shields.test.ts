import { describe, it, expect, vi } from 'vitest';
import {
  runShieldSeed,
  type ShieldSeedDb,
  type ShieldSeedSummary,
} from '../../infrastructure/shields/seed-shields-run.js';

interface TeamRow {
  id: number;
  name: string;
  aliases: string[] | null;
  logo: string | null;
}

function makeDb(teams: TeamRow[]) {
  const setLogo = vi.fn(async () => {});
  const db: ShieldSeedDb = {
    listTeams: vi.fn(async () => teams),
    setLogo,
  };
  return { db, setLogo };
}

const NOOP_LOGGER = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };

// ── Skip / force semantics ─────────────────────────────────────────

describe('runShieldSeed — skip / force', () => {
  it('skips teams that already have a logo (idempotent re-run)', async () => {
    const { db, setLogo } = makeDb([{ id: 1, name: 'River Plate', aliases: [], logo: 'logos/1.png' }]);
    const resolveShield = vi.fn(async () => 'https://example.com/shield.png');
    const downloadAndStore = vi.fn(async () => 'logos/1.png');

    const summary = await runShieldSeed({
      db,
      imageService: { downloadAndStore },
      resolveShield,
      delayMs: 0,
      logger: NOOP_LOGGER,
    });

    expect(summary).toMatchObject<Partial<ShieldSeedSummary>>({ total: 1, stored: 0, skipped: 1, unresolved: [], storeFailed: [] });
    expect(resolveShield).not.toHaveBeenCalled();
    expect(downloadAndStore).not.toHaveBeenCalled();
    expect(setLogo).not.toHaveBeenCalled();
  });

  it('re-resolves and re-stores with force even when a logo exists', async () => {
    const { db, setLogo } = makeDb([{ id: 1, name: 'River Plate', aliases: [], logo: 'logos/1.png' }]);
    const resolveShield = vi.fn(async () => 'https://example.com/new-shield.png');
    const downloadAndStore = vi.fn(async () => 'logos/1.png');

    const summary = await runShieldSeed({
      db,
      imageService: { downloadAndStore },
      resolveShield,
      force: true,
      delayMs: 0,
      logger: NOOP_LOGGER,
    });

    expect(summary.skipped).toBe(0);
    expect(summary.stored).toBe(1);
    expect(resolveShield).toHaveBeenCalledWith('River Plate', []);
    expect(downloadAndStore).toHaveBeenCalledWith('https://example.com/new-shield.png', 1);
    expect(setLogo).toHaveBeenCalledWith(1, 'logos/1.png');
  });

  it('passes the team aliases to the resolver', async () => {
    const { db } = makeDb([{ id: 1, name: 'Gimnasia', aliases: ['Gimnasia de Mendoza'], logo: null }]);
    const resolveShield = vi.fn(async () => 'https://example.com/shield.png');

    await runShieldSeed({
      db,
      imageService: { downloadAndStore: vi.fn(async () => 'logos/1.png') },
      resolveShield,
      delayMs: 0,
      logger: NOOP_LOGGER,
    });

    expect(resolveShield).toHaveBeenCalledWith('Gimnasia', ['Gimnasia de Mendoza']);
  });
});

// ── Unresolved / failure reporting ─────────────────────────────────

describe('runShieldSeed — unresolved and store failures', () => {
  it('lists unresolved teams and completes (summary returned, no throw)', async () => {
    const { db, setLogo } = makeDb([
      { id: 1, name: 'Equipo Fantasma', aliases: null, logo: null },
      { id: 2, name: 'Otro Fantasma', aliases: [], logo: null },
    ]);
    const resolveShield = vi.fn(async () => null);

    const summary = await runShieldSeed({
      db,
      imageService: { downloadAndStore: vi.fn() },
      resolveShield,
      delayMs: 0,
      logger: NOOP_LOGGER,
    });

    expect(summary.stored).toBe(0);
    expect(summary.unresolved).toEqual(['Equipo Fantasma', 'Otro Fantasma']);
    expect(setLogo).not.toHaveBeenCalled();
  });

  it('reports teams whose source resolved but the store failed', async () => {
    const { db } = makeDb([{ id: 4, name: 'Equipo Y', aliases: [], logo: null }]);
    const resolveShield = vi.fn(async () => 'https://example.com/shield.png');
    const downloadAndStore = vi.fn(async () => null);

    const summary = await runShieldSeed({
      db,
      imageService: { downloadAndStore },
      resolveShield,
      delayMs: 0,
      logger: NOOP_LOGGER,
    });

    expect(summary.storeFailed).toEqual(['Equipo Y']);
    expect(summary.unresolved).toEqual([]);
  });
});

// ── Summary counts ─────────────────────────────────────────────────

describe('runShieldSeed — summary counts', () => {
  it('reports correct counts for a mixed registry', async () => {
    const { db, setLogo } = makeDb([
      { id: 1, name: 'River Plate', aliases: [], logo: 'logos/1.png' }, // skipped
      { id: 2, name: 'Boca Juniors', aliases: [], logo: null }, // stored
      { id: 3, name: 'Equipo X', aliases: [], logo: null }, // unresolved
      { id: 4, name: 'Equipo Y', aliases: [], logo: null }, // store failed
    ]);
    const resolveShield = vi.fn(async (name: string) => (name === 'Equipo X' ? null : 'https://example.com/shield.png'));
    const downloadAndStore = vi.fn(async (_url: string, teamId: number) => (teamId === 4 ? null : `logos/${teamId}.png`));

    const summary = await runShieldSeed({
      db,
      imageService: { downloadAndStore },
      resolveShield,
      delayMs: 0,
      logger: NOOP_LOGGER,
    });

    expect(summary.total).toBe(4);
    expect(summary.stored).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.unresolved).toEqual(['Equipo X']);
    expect(summary.storeFailed).toEqual(['Equipo Y']);
    expect(summary.wouldStore).toBeUndefined();
    expect(setLogo).toHaveBeenCalledTimes(1);
    expect(setLogo).toHaveBeenCalledWith(2, 'logos/2.png');
  });
});

// ── Dry-run preview mode ───────────────────────────────────────────

describe('runShieldSeed — dry-run', () => {
  it('resolves URLs but never downloads, stores, or writes to the DB', async () => {
    const { db, setLogo } = makeDb([
      { id: 1, name: 'River Plate', aliases: [], logo: null },
      { id: 2, name: 'Boca Juniors', aliases: [], logo: null },
    ]);
    const resolveShield = vi.fn(async (name: string) => `https://example.com/${name}.png`);
    const downloadAndStore = vi.fn(async () => 'logos/x.png');

    const summary = await runShieldSeed({
      db,
      imageService: { downloadAndStore },
      resolveShield,
      dryRun: true,
      delayMs: 0,
      logger: NOOP_LOGGER,
    });

    expect(summary.stored).toBe(0);
    expect(summary.wouldStore).toBe(2);
    expect(summary.storeFailed).toEqual([]);
    expect(resolveShield).toHaveBeenCalledTimes(2);
    expect(resolveShield).toHaveBeenCalledWith('River Plate', []);
    expect(resolveShield).toHaveBeenCalledWith('Boca Juniors', []);
    expect(downloadAndStore).not.toHaveBeenCalled();
    expect(setLogo).not.toHaveBeenCalled();
  });

  it('still skips teams with a logo unless force (preview mirrors a real run)', async () => {
    const { db, setLogo } = makeDb([
      { id: 1, name: 'River Plate', aliases: [], logo: 'logos/1.png' }, // skipped
      { id: 2, name: 'Boca Juniors', aliases: [], logo: null }, // would store
    ]);
    const resolveShield = vi.fn(async () => 'https://example.com/shield.png');

    const summary = await runShieldSeed({
      db,
      imageService: { downloadAndStore: vi.fn() },
      resolveShield,
      dryRun: true,
      delayMs: 0,
      logger: NOOP_LOGGER,
    });

    expect(summary.skipped).toBe(1);
    expect(summary.wouldStore).toBe(1);
    expect(resolveShield).toHaveBeenCalledTimes(1);
    expect(resolveShield).toHaveBeenCalledWith('Boca Juniors', []);
    expect(setLogo).not.toHaveBeenCalled();
  });

  it('with force re-resolves teams that have logos but still writes nothing', async () => {
    const { db, setLogo } = makeDb([{ id: 1, name: 'River Plate', aliases: [], logo: 'logos/1.png' }]);
    const resolveShield = vi.fn(async () => 'https://example.com/shield.png');
    const downloadAndStore = vi.fn(async () => 'logos/1.png');

    const summary = await runShieldSeed({
      db,
      imageService: { downloadAndStore },
      resolveShield,
      force: true,
      dryRun: true,
      delayMs: 0,
      logger: NOOP_LOGGER,
    });

    expect(summary.skipped).toBe(0);
    expect(summary.wouldStore).toBe(1);
    expect(resolveShield).toHaveBeenCalledTimes(1);
    expect(resolveShield).toHaveBeenCalledWith('River Plate', []);
    expect(downloadAndStore).not.toHaveBeenCalled();
    expect(setLogo).not.toHaveBeenCalled();
  });

  it('reports wouldStore and unresolved counts correctly', async () => {
    const { db, setLogo } = makeDb([
      { id: 1, name: 'Equipo Fantasma', aliases: [], logo: null }, // unresolved
      { id: 2, name: 'Boca Juniors', aliases: [], logo: null }, // would store
      { id: 3, name: 'Gimnasia', aliases: ['Gimnasia de Mendoza'], logo: null }, // would store
    ]);
    const resolveShield = vi.fn(async (name: string) =>
      name === 'Equipo Fantasma' ? null : `https://example.com/${name}.png`,
    );

    const summary = await runShieldSeed({
      db,
      imageService: { downloadAndStore: vi.fn() },
      resolveShield,
      dryRun: true,
      delayMs: 0,
      logger: NOOP_LOGGER,
    });

    expect(summary.total).toBe(3);
    expect(summary.stored).toBe(0);
    expect(summary.wouldStore).toBe(2);
    expect(summary.unresolved).toEqual(['Equipo Fantasma']);
    expect(summary.storeFailed).toEqual([]);
    expect(resolveShield).toHaveBeenCalledWith('Gimnasia', ['Gimnasia de Mendoza']);
    expect(setLogo).not.toHaveBeenCalled();
  });
});
