import type { SystemConfig } from '../entities/system-config.js';

/**
 * Repository port for the persisted system configuration.
 *
 * Implementations read and write the single system_config row (id=1).
 */
export interface SystemConfigRepo {
  /** Load the persisted config, or null when no row exists yet. */
  get(): Promise<SystemConfig | null>;
  /** Persist the given config, creating or replacing the single row. */
  upsert(config: SystemConfig): Promise<void>;
}
