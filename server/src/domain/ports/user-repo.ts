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
  findByUsername(username: string): Promise<User | null>;
  save(user: User): Promise<User>;
  update(user: User): Promise<User>;
  findAll(): Promise<User[]>;
  delete(id: string): Promise<void>;
}
