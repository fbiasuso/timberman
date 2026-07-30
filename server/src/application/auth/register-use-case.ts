import { randomUUID } from 'node:crypto';
import type { UserRepo } from '../../domain/ports/user-repo.js';
import { User } from '../../domain/entities/user.js';
import { DuplicateUsernameError, RegistrationDisabledError } from '../../domain/errors/index.js';

/**
 * Port interface for password hashing — infrastructure implements it.
 * Defined here in the application layer because hashing is a use-case concern,
 * not a domain concept.
 */
export interface BcryptService {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

/** Public user data (no password hash) */
export interface RegisterUserDTO {
  id: string;
  username: string;
  role: string;
  balance: number;
  createdAt: Date;
}

export class RegisterUseCase {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly bcrypt: BcryptService,
    private readonly allowRegistration: boolean,
  ) {}

  async execute(username: string, password: string): Promise<RegisterUserDTO> {
    if (!this.allowRegistration) {
      throw new RegistrationDisabledError();
    }

    const existing = await this.userRepo.findByUsername(username);
    if (existing) {
      throw new DuplicateUsernameError(username);
    }

    const passwordHash = await this.bcrypt.hash(password);
    const user = User.new({
      id: randomUUID(),
      username,
      passwordHash,
    });

    const saved = await this.userRepo.save(user);
    const snapshot = saved.toSnapshot();
    return {
      id: snapshot.id,
      username: snapshot.username,
      role: snapshot.role,
      balance: snapshot.balance,
      createdAt: snapshot.createdAt,
    };
  }
}
