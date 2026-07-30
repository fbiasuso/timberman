import type { AuditLog } from '../entities/audit-log.js';

/**
 * Repository port for AuditLog entity.
 */
export interface AuditLogRepo {
  save(log: AuditLog): Promise<AuditLog>;
  findByAdminId(adminId: string): Promise<AuditLog[]>;
  findByUserId(userId: string): Promise<AuditLog[]>;
  findAll(): Promise<AuditLog[]>;
}
