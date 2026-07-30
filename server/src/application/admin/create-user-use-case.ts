import { randomUUID } from 'node:crypto';
import type { UserRepo } from '../../domain/ports/user-repo.js';
import { User } from '../../domain/entities/user.js';
import { DuplicateUsernameError } from '../../domain/errors/index.js';
import { Money } from '../../domain/value-objects/money.js';
import type { BcryptService } from '../auth/register-use-case.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface CreateUserInput {
  username: string;
  password: string;
  balance?: number; // cents, optional
}

export interface AdminUserDTO {
  id: string;
  username: string;
  role: string;
  balance: number;
  createdAt: Date;
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Admin creates a user with username, password, and optional initial balance.
 */
export class CreateUserUseCase {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly bcrypt: BcryptService,
  ) {}

  async execute(input: CreateUserInput): Promise<AdminUserDTO> {
    const existing = await this.userRepo.findByUsername(input.username);
    if (existing) {
      throw new DuplicateUsernameError(input.username);
    }

    const passwordHash = await this.bcrypt.hash(input.password);
    let user = User.new({
      id: randomUUID(),
      username: input.username,
      passwordHash,
    });

    // Apply optional initial balance
    if (input.balance !== undefined && input.balance > 0) {
      user = user.addBalance(Money.fromCents(input.balance));
    }

    const saved = await this.userRepo.save(user);
    const snap = saved.toSnapshot();

    return {
      id: snap.id,
      username: snap.username,
      role: snap.role,
      balance: snap.balance,
      createdAt: snap.createdAt,
    };
  }
}
