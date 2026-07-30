import type { UserRepo } from '../../domain/ports/user-repo.js';
import { UserNotFoundError } from '../../domain/errors/index.js';

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Admin deletes a user by ID.
 */
export class DeleteUserUseCase {
  constructor(private readonly userRepo: UserRepo) {}

  async execute(userId: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    await this.userRepo.delete(userId);
  }
}
