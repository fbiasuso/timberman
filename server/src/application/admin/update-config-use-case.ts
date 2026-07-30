import type { SystemConfig } from './get-config-use-case.js';

// ── Error ──────────────────────────────────────────────────────────

export class InvalidConfigKeyError extends Error {
  constructor(key: string) {
    super(`Invalid configuration key: "${key}"`);
    this.name = 'InvalidConfigKeyError';
  }
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Updates a single key-value pair in the system configuration.
 *
 * Supported keys: commission, allowRegistration, defaultBetAmount.
 * Values are coerced to the correct type (number for commission/betAmount,
 * boolean for allowRegistration).
 */
export class UpdateConfigUseCase {
  private static readonly VALID_KEYS = ['commission', 'allowRegistration', 'defaultBetAmount'] as const;

  constructor(private readonly config: SystemConfig) {}

  execute(key: string, value: unknown): SystemConfig {
    if (!UpdateConfigUseCase.VALID_KEYS.includes(key as any)) {
      throw new InvalidConfigKeyError(key);
    }

    switch (key) {
      case 'commission':
        this.config.commission = Number(value);
        break;
      case 'allowRegistration':
        this.config.allowRegistration = value === true || value === 'true';
        break;
      case 'defaultBetAmount':
        this.config.defaultBetAmount = Number(value);
        break;
    }

    return { ...this.config };
  }
}
