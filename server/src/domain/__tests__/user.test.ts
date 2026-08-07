import { describe, it, expect } from 'vitest';
import { User } from '../entities/user.js';
import { Money } from '../value-objects/money.js';
import { InsufficientBalanceError } from '../errors/index.js';

describe('User', () => {
  const baseSnapshot = {
    id: 'user-1',
    username: 'testuser',
    passwordHash: 'hashed-password',
    role: 'user' as const,
    balance: 2000,
    createdAt: new Date('2025-01-01'),
  };

  describe('constructor / create', () => {
    it('creates a user from snapshot', () => {
      const user = User.create(baseSnapshot);
      expect(user.id).toBe('user-1');
      expect(user.username).toBe('testuser');
      expect(user.role).toBe('user');
    });

    it('exposes balance as Money', () => {
      const user = User.create(baseSnapshot);
      expect(user.balance.cents).toBe(2000);
    });
  });

  describe('new', () => {
    it('creates a new user with default role and zero balance', () => {
      const user = User.new({
        id: 'new-1',
        username: 'newguy',
        passwordHash: 'hash',
      });
      expect(user.role).toBe('user');
      expect(user.balance.cents).toBe(0);
    });

    it('creates an admin when specified', () => {
      const user = User.new({
        id: 'admin-1',
        username: 'admin',
        passwordHash: 'hash',
        role: 'admin',
      });
      expect(user.role).toBe('admin');
    });
  });

  describe('deductBalance', () => {
    it('deducts balance and returns a new User instance', () => {
      const user = User.create(baseSnapshot);
      const updated = user.deductBalance(Money.fromCents(500));
      expect(updated.balance.cents).toBe(1500);
      expect(user.balance.cents).toBe(2000); // original unchanged
    });

    it('throws InsufficientBalanceError when balance is too low', () => {
      const user = User.create(baseSnapshot);
      let error: unknown;
      try {
        user.deductBalance(Money.fromCents(5000));
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(InsufficientBalanceError);
      expect((error as Error).message).toBe(
        'El usuario "testuser" no tiene saldo suficiente. Requerido: 5000, Disponible: 2000',
      );
    });
  });

  describe('addBalance', () => {
    it('adds balance and returns a new User instance', () => {
      const user = User.create(baseSnapshot);
      const updated = user.addBalance(Money.fromCents(1000));
      expect(updated.balance.cents).toBe(3000);
      expect(user.balance.cents).toBe(2000); // original unchanged
    });
  });

  describe('isAdmin', () => {
    it('returns false for regular users', () => {
      const user = User.create(baseSnapshot);
      expect(user.isAdmin()).toBe(false);
    });

    it('returns true for admin users', () => {
      const admin = User.create({ ...baseSnapshot, role: 'admin' });
      expect(admin.isAdmin()).toBe(true);
    });
  });
});
