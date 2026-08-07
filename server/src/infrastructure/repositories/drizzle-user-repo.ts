import { eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema.js';
import type { UserRepo } from '../../domain/ports/user-repo.js';
import { User } from '../../domain/entities/user.js';
import type { UserSnapshot } from '../../domain/entities/user.js';

export class DrizzleUserRepo implements UserRepo {
  constructor(private readonly db: PostgresJsDatabase<any>) {}

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db.select().from(schema.users).where(eq(schema.users.id, id));
    if (!row) return null;
    return User.create(row as unknown as UserSnapshot);
  }

  async findByIdForUpdate(id: string): Promise<User | null> {
    // Lock the row for the duration of the transaction — serializes the
    // balance read-modify-write between concurrent financial flows touching
    // the same user (bet deduction, commission credit, winner payout).
    const [row] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .for('update');
    if (!row) return null;
    return User.create(row as unknown as UserSnapshot);
  }

  async findByUsername(username: string): Promise<User | null> {
    // Case-insensitive lookup on the normalized key — uses
    // idx_users_username_normalized_unique (lower(username)). Usernames are
    // stored and returned as written; only the comparison is case-folded.
    const [row] = await this.db
      .select()
      .from(schema.users)
      .where(sql`lower(${schema.users.username}) = lower(${username})`);
    if (!row) return null;
    return User.create(row as unknown as UserSnapshot);
  }

  async save(user: User): Promise<User> {
    const snapshot = user.toSnapshot();
    const [row] = await this.db.insert(schema.users).values(snapshot as any).returning();
    return User.create(row as unknown as UserSnapshot);
  }

  async update(user: User): Promise<User> {
    const snapshot = user.toSnapshot();
    const [row] = await this.db.update(schema.users)
      .set({
        username: snapshot.username,
        passwordHash: snapshot.passwordHash,
        role: snapshot.role,
        balance: snapshot.balance,
      })
      .where(eq(schema.users.id, snapshot.id))
      .returning();
    return User.create(row as unknown as UserSnapshot);
  }

  async findAll(): Promise<User[]> {
    const rows = await this.db.select().from(schema.users);
    return rows.map((row) => User.create(row as unknown as UserSnapshot));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(schema.users).where(eq(schema.users.id, id));
  }
}
