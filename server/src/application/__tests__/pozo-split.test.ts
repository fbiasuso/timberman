import { describe, it, expect } from 'vitest';
import { splitPozo } from '../tournament/pozo-split.js';

describe('splitPozo', () => {
  it('splits 1000 cents among 3 winners: 334/333/333', () => {
    expect(splitPozo(1000, 3)).toEqual([334, 333, 333]);
  });

  it('splits exactly when the pozo divides evenly: 900/3 → 300 each', () => {
    expect(splitPozo(900, 3)).toEqual([300, 300, 300]);
  });

  it('gives the full pozo to a single winner', () => {
    expect(splitPozo(750, 1)).toEqual([750]);
  });

  it('sum of payouts always equals the full pozo', () => {
    const payouts = splitPozo(10007, 4);
    expect(payouts).toHaveLength(4);
    expect(payouts.reduce((a, b) => a + b, 0)).toBe(10007);
  });
});
