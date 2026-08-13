import { describe, it, expect } from 'vitest';
import pkg from '../../../package.json';
import { APP_VERSION } from '../app-version';

describe('APP_VERSION', () => {
  it('matches the version declared in client/package.json', () => {
    expect(APP_VERSION).toBe(pkg.version);
  });
});
