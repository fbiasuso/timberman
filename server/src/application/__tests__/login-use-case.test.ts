import { describe, it, expect, vi } from 'vitest';
import { LoginUseCase, type JwtService } from '../auth/login-use-case.js';
import type { UserRepo } from '../../domain/ports/user-repo.js';
import type { BcryptService } from '../auth/register-use-case.js';
import { InvalidCredentialsError } from '../../domain/errors/index.js';
import { User } from '../../domain/entities/user.js';

function createMocks() {
  const userRepo: UserRepo = {
    findById: vi.fn(),
    findByIdForUpdate: vi.fn(),
    findByUsername: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    findAll: vi.fn(),
    delete: vi.fn(),
  };

  const bcrypt: BcryptService = {
    hash: vi.fn(),
    compare: vi.fn(),
  };

  const jwt: JwtService = {
    sign: vi.fn(() => 'fake-jwt-token'),
  };

  return { userRepo, bcrypt, jwt };
}

describe('LoginUseCase', () => {
  describe('successful login', () => {
    it('returns a token and user DTO for valid credentials', async () => {
      const { userRepo, bcrypt, jwt } = createMocks();
      const user = User.create({
        id: 'user-1',
        username: 'testuser',
        passwordHash: 'hashed-password',
        role: 'user',
        balance: 1000,
        createdAt: new Date('2025-01-01'),
      });
      vi.mocked(userRepo.findByUsername).mockResolvedValue(user);
      vi.mocked(bcrypt.compare).mockResolvedValue(true);

      const uc = new LoginUseCase(userRepo, bcrypt, jwt);
      const result = await uc.execute('testuser', 'correct-password');

      expect(result.token).toBe('fake-jwt-token');
      expect(result.user.username).toBe('testuser');
      expect(result.user.id).toBe('user-1');
      expect(result.user.balance).toBe(1000);
      expect(jwt.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        role: 'user',
        username: 'testuser',
      });
    });
  });

  describe('wrong password', () => {
    it('throws InvalidCredentialsError when password does not match', async () => {
      const { userRepo, bcrypt, jwt } = createMocks();
      const user = User.create({
        id: 'user-1',
        username: 'testuser',
        passwordHash: 'hashed-password',
        role: 'user',
        balance: 1000,
        createdAt: new Date('2025-01-01'),
      });
      vi.mocked(userRepo.findByUsername).mockResolvedValue(user);
      vi.mocked(bcrypt.compare).mockResolvedValue(false);

      const uc = new LoginUseCase(userRepo, bcrypt, jwt);
      await expect(uc.execute('testuser', 'wrong-password')).rejects.toThrow(InvalidCredentialsError);
      expect(jwt.sign).not.toHaveBeenCalled();
    });

    it('throws InvalidCredentialsError when user does not exist', async () => {
      const { userRepo, bcrypt, jwt } = createMocks();
      vi.mocked(userRepo.findByUsername).mockResolvedValue(null);

      const uc = new LoginUseCase(userRepo, bcrypt, jwt);
      await expect(uc.execute('nonexistent', 'anypass')).rejects.toThrow(InvalidCredentialsError);
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(jwt.sign).not.toHaveBeenCalled();
    });
  });
});
