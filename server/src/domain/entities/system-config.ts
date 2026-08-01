/**
 * System-wide configuration entity.
 *
 * This file currently ships the entity contract and DEFAULT_SYSTEM_CONFIG.
 * Persistence lives in DrizzleSystemConfigRepo (single row, id=1, in the
 * `system_config` table). Boot loading and update persistence are wired
 * into the app in a later slice.
 */
export interface SystemConfig {
  commission: number; // percent (0-100)
  allowRegistration: boolean;
  defaultBetAmount: number; // cents
}

/** Built-in defaults used when no persisted config row exists. */
export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  commission: 15,
  allowRegistration: true,
  defaultBetAmount: 1500,
};
