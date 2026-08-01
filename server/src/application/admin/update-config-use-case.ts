import type { SystemConfig } from '../../domain/entities/system-config.js';
import type { SystemConfigRepo } from '../../domain/ports/system-config-repo.js';

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

    await this.repo.upsert(this.config);
    return { ...this.config };
  }
}
