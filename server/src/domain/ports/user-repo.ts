import type { User } from '../entities/user.js';

/**
 * Repository port for User aggregate.
 *
 * Infrastructure adapters (e.g. DrizzleUserRepo) implement this interface.
 * Domain and application layers depend on this interface only — never on
 * concrete infrastructure.
 */
export interface UserRepo {
  findById(id: string): Promise<User | null>;
  /**
   * Read a user row locking it for update (`SELECT ... FOR UPDATE`).
   * Must only be called inside a transaction — the lock is held until the
   * transaction commits/rolls back, which serializes the balance
   * read-modify-write so concurrent credits/debits to the SAME user can
   * never be lost (bet deduction, commission credit, winner payout).
   *
   * Lock ordering (avoid deadlocks): matchDate → tournament → user. The
   * betting flow takes only the user lock (the innermost level), so it never
   * holds a higher-level lock while waiting for one — no cycle with the
   * close/publish flows is possible.
   */
  findByIdForUpdate(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  save(user: User): Promise<User>;
  update(user: User): Promise<User>;
  findAll(): Promise<User[]>;
  delete(id: string): Promise<void>;
}
