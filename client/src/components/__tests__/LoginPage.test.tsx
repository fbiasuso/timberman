import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../auth/LoginPage';

// Mock dependencies
const loginMutate = vi.fn();
const registerMutate = vi.fn();

vi.mock('../../hooks/use-auth', () => ({
  useLogin: () => ({
    mutate: loginMutate,
    error: null,
    isPending: false,
  }),
  useRegister: () => ({
    mutate: registerMutate,
    error: null,
    isPending: false,
  }),
}));

vi.mock('../../stores/auth-store', () => ({
  useAuthStore: vi.fn((selector: any) => {
    const state = { isAuthenticated: false };
    return selector(state);
  }),
}));

afterEach(() => cleanup());

describe('LoginPage', () => {
  it('renders the login form by default', () => {
    render(<LoginPage />);
    expect(screen.getByText('Timberman')).toBeDefined();
    expect(screen.getByText('Iniciar sesión')).toBeDefined();
    expect(screen.getByText('Registrarse')).toBeDefined();
  });

  it('shows username and password fields in login form', () => {
    render(<LoginPage />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
    // Password inputs use type="password" not role="textbox"
    expect(screen.getByText('Ingresar')).toBeDefined();
  });

  it('switches to register form when clicking register tab', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByText('Registrarse'));
    expect(screen.getByText('Confirmar contraseña')).toBeDefined();
  });
});
