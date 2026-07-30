import { create } from 'zustand';
import type { UserDTO } from '../api/auth-api';

interface AuthState {
  /** JWT token — persists to localStorage */
  token: string | null;
  /** Cached user data (populated after /me fetch) */
  user: UserDTO | null;
  /** Derived from token presence */
  isAuthenticated: boolean;
  /** Store token + user after login */
  setAuth: (token: string, user: UserDTO) => void;
  /** Update user data without changing token (used by useMe) */
  setUser: (user: UserDTO) => void;
  /** Clear everything (logout) */
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('auth-token'),
  user: null,
  isAuthenticated: !!localStorage.getItem('auth-token'),

  setAuth: (token: string, user: UserDTO) => {
    localStorage.setItem('auth-token', token);
    set({ token, user, isAuthenticated: true });
  },

  setUser: (user: UserDTO) => set({ user }),

  logout: () => {
    localStorage.removeItem('auth-token');
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
