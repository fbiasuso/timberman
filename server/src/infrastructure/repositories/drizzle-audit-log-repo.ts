import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema.js';
import type { AuditLogRepo } from '../../domain/ports/audit-log-repo.js';
import { AuditLog } from '../../domain/entities/audit-log.js';
import type { AuditLogSnapshot } from '../../domain/entities/audit-log.js';

export class DrizzleAuditLogRepo implements AuditLogRepo {
  constructor(private readonly db: PostgresJsDatabase<any>) {}

  async save(log: AuditLog): Promise<AuditLog> {
    const snap = log.toSnapshot();
    // New audit logs carry the id: 0 sentinel — omit it so the serial PK
    // assigns the id. Inserting an explicit 0 would collide on the second row.
    const { id: _ignored, ...values } = snap;
    const [row] = await this.db
      .insert(schema.auditLogs)
      .values(values as any)
      .returning();
    return AuditLog.create(row as unknown as AuditLogSnapshot);
  }

  async findByAdminId(adminId: string): Promise<AuditLog[]> {
    const rows = await this.db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.adminId, adminId));
    return rows.map((row) => AuditLog.create(row as unknown as AuditLogSnapshot));
  }

  async findByUserId(userId: string): Promise<AuditLog[]> {
    const rows = await this.db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.userId, userId));
    return rows.map((row) => AuditLog.create(row as unknown as AuditLogSnapshot));
  }

  async findAll(): Promise<AuditLog[]> {
    const rows = await this.db.select().from(schema.auditLogs);
    return rows.map((row) => AuditLog.create(row as unknown as AuditLogSnapshot));
  }
}
