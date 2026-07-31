import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema.js';
import type { SystemConfigRepo } from '../../domain/ports/system-config-repo.js';
import type { SystemConfig } from '../../domain/entities/system-config.js';

/**
 * Drizzle adapter for the SystemConfigRepo port.
 *
 * Reads and writes the single-row system_config table (id=1).
 */
export class DrizzleSystemConfigRepo implements SystemConfigRepo {
  constructor(private readonly db: PostgresJsDatabase<any>) {}

  async get(): Promise<SystemConfig | null> {
    const [row] = await this.db
      .select()
      .from(schema.systemConfig)
      .where(eq(schema.systemConfig.id, 1));
    if (!row) return null;
    return {
      commission: Number(row.commission),
      allowRegistration: row.allowRegistration,
      defaultBetAmount: row.defaultBetAmount,
    };
  }

  async upsert(config: SystemConfig): Promise<void> {
    const values = {
      id: 1,
      commission: String(config.commission),
      allowRegistration: config.allowRegistration,
      defaultBetAmount: config.defaultBetAmount,
    };
    await this.db
      .insert(schema.systemConfig)
      .values(values)
      .onConflictDoUpdate({
        target: schema.systemConfig.id,
        set: {
          commission: String(config.commission),
          allowRegistration: config.allowRegistration,
          defaultBetAmount: config.defaultBetAmount,
        },
      });
  }
}
