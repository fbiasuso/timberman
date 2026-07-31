/**
 * System-wide configuration entity.
 *
 * Persisted as a single row (id=1) in the `system_config` table and
 * loaded at boot, falling back to DEFAULT_SYSTEM_CONFIG when absent.
 * The same object reference is shared across the app so updates are
 * reflected immediately without a restart.
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
