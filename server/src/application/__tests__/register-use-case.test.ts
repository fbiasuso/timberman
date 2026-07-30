import { describe, it, expect, vi } from 'vitest';
import { RegisterUseCase } from '../auth/register-use-case.js';
import type { UserRepo } from '../../domain/ports/user-repo.js';
import type { BcryptService } from '../auth/register-use-case.js';
import { DuplicateUsernameError, RegistrationDisabledError } from '../../domain/errors/index.js';

function createMocks() {
  const userRepo: UserRepo = {
    findById: vi.fn(),
    findByUsername: vi.fn(),
    save: vi.fn((user: any) => Promise.resolve(user)),
    update: vi.fn(),
    findAll: vi.fn(),
    delete: vi.fn(),
  };

  const bcrypt: BcryptService = {
    hash: vi.fn((pw: string) => Promise.resolve(`hashed-${pw}`)),
    compare: vi.fn(),
  };

  return { userRepo, bcrypt };
}

describe('RegisterUseCase', () => {
  describe('successful register', () => {
    it('creates a user and returns a DTO without password hash', async () => {
      const { userRepo, bcrypt } = createMocks();
      vi.mocked(userRepo.findByUsername).mockResolvedValue(null);
      const uc = new RegisterUseCase(userRepo, bcrypt, true);

      const result = await uc.execute('newuser', 'secret123');

      expect(result.username).toBe('newuser');
      expect(result.id).toBeDefined();
      expect(result.role).toBe('user');
      expect(result.balance).toBe(0);
      expect(result.createdAt).toBeInstanceOf(Date);
      // Ensure password hash is not exposed
      expect(result).not.toHaveProperty('passwordHash');
      expect(userRepo.findByUsername).toHaveBeenCalledWith('newuser');
      expect(bcrypt.hash).toHaveBeenCalledWith('secret123');
      expect(userRepo.save).toHaveBeenCalledOnce();
    });
  });

  describe('duplicate username', () => {
    it('throws DuplicateUsernameError when username already exists', async () => {
      const { userRepo, bcrypt } = createMocks();
      vi.mocked(userRepo.findByUsername).mockResolvedValue({ id: 'existing' } as any);
      const uc = new RegisterUseCase(userRepo, bcrypt, true);

      await expect(uc.execute('existinguser', 'pass123')).rejects.toThrow(DuplicateUsernameError);
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(userRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('registration disabled', () => {
    it('throws RegistrationDisabledError when allowRegistration is false', async () => {
      const { userRepo, bcrypt } = createMocks();
      const uc = new RegisterUseCase(userRepo, bcrypt, false);

      await expect(uc.execute('anyuser', 'pass123')).rejects.toThrow(RegistrationDisabledError);
      expect(userRepo.findByUsername).not.toHaveBeenCalled();
      expect(userRepo.save).not.toHaveBeenCalled();
    });
  });
});
