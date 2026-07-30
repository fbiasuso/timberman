// ── DTOs ──────────────────────────────────────────────────────────

export interface SystemConfig {
  commission: number;
  allowRegistration: boolean;
  defaultBetAmount: number; // cents
}

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
