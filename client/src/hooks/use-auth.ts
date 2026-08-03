import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth-api';
import { useAuthStore } from '../stores/auth-store';
import { useBetSlipStore } from '../stores/bet-slip-store';

/** Login mutation — stores token + user on success */
export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      authApi.login(username, password).then((r) => r.data),
    onSuccess: (data) => {
      setAuth(data.token, data.user);
      // The bet-slip store is persisted per browser, not per user — clear any
      // selections left by a previous user on this device (covers a direct
      // login when the previous session did not go through logout).
      useBetSlipStore.getState().reset();
      useBetSlipStore.persist.clearStorage();
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

/** Register mutation — returns user data (no auto-login) */
export function useRegister() {
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      authApi.register(username, password).then((r) => r.data),
  });
}

/** Fetch current user — enabled only when token exists */
export function useMe() {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);

  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        const data = await authApi.getMe().then((r) => r.data);
        setUser(data);
        return data;
      } catch {
        logout();
        throw new Error('Session expired');
      }
    },
    enabled: !!token,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

/** Logout callback — clears store + query cache */
export function useLogout() {
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();

  return () => {
    // logout() also wipes the persisted bet-slip (per-browser store).
    logout();
    queryClient.clear();
  };
}
