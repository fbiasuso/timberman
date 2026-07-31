import type { SystemConfig } from '../../domain/entities/system-config.js';

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Returns the current system configuration.
 *
 * The config object is shared by reference so changes from
 * UpdateConfigUseCase are reflected immediately.
 */
export class GetConfigUseCase {
  constructor(private readonly config: SystemConfig) {}

  execute(): SystemConfig {
    return { ...this.config };
  }
}
