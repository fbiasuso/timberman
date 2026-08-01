import type { SystemConfig } from '../../domain/entities/system-config.js';
import type { SystemConfigRepo } from '../../domain/ports/system-config-repo.js';
import {
  InvalidCommissionError,
  InvalidConfigValueError,
} from '../../domain/errors/index.js';

// ── Error ──────────────────────────────────────────────────────────

export class InvalidConfigKeyError extends Error {
  constructor(key: string) {
    super(`Invalid configuration key: "${key}"`);
    this.name = 'InvalidConfigKeyError';
  }
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Updates a single key-value pair in the system configuration and
 * persists the change so it survives restarts.
 *
 * Supported keys: commission, allowRegistration, defaultBetAmount.
 * Values are coerced to the correct type (number for commission/betAmount,
 * boolean for allowRegistration).
 *
 * The shared config reference is only mutated AFTER the row is persisted.
 * Building a candidate object first keeps the in-memory state from
 * diverging from the database when the upsert fails.
 */
export class UpdateConfigUseCase {
  private static readonly VALID_KEYS = ['commission', 'allowRegistration', 'defaultBetAmount'] as const;

  constructor(
    private readonly config: SystemConfig,
    private readonly repo: SystemConfigRepo,
  ) {}

  async execute(key: string, value: unknown): Promise<SystemConfig> {
    if (!UpdateConfigUseCase.VALID_KEYS.includes(key as any)) {
      throw new InvalidConfigKeyError(key);
    }

    // Build the candidate config WITHOUT touching the shared reference.
    const next: SystemConfig = { ...this.config };

    switch (key) {
      case 'commission': {
        const commission = Number(value);
        if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
          throw new InvalidCommissionError(commission);
        }
        next.commission = commission;
        break;
      }
      case 'allowRegistration':
        next.allowRegistration = value === true || value === 'true';
        break;
      case 'defaultBetAmount': {
        const betAmount = Number(value);
        if (!Number.isFinite(betAmount) || !Number.isInteger(betAmount) || betAmount < 0) {
          throw new InvalidConfigValueError('defaultBetAmount', betAmount, 'a non-negative integer');
        }
        next.defaultBetAmount = betAmount;
        break;
      }
    }

    // Persist first, then publish to the shared reference only on success.
    await this.repo.upsert(next);
    Object.assign(this.config, next);
    return { ...this.config };
  }
}
