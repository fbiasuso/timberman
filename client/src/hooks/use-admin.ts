import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../api/admin-api';

// ─── Queries ────────────────────────────────────────────────────────────────

/** Fetch all admin users */
export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminApi.getUsers(),
  });
}

/** Fetch all tournaments with their match dates */
export function useAdminTournaments() {
  return useQuery({
    queryKey: ['admin', 'tournaments'],
    queryFn: () => adminApi.getTournaments(),
  });
}

/** Fetch system config */
export function useAdminConfig() {
  return useQuery({
    queryKey: ['admin', 'config'],
    queryFn: () => adminApi.getConfig(),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/** Create a new user — invalidates ['admin', 'users'] */
export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.createUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

/** Adjust user balance — invalidates ['admin', 'users'] */
export function useAdjustBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...payload }: { userId: string } & Parameters<typeof adminApi.adjustBalance>[1]) =>
      adminApi.adjustBalance(userId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

/** Delete user — invalidates ['admin', 'users'] */
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminApi.deleteUser(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

/** Create a new tournament — invalidates ['admin', 'tournaments'] */
export function useCreateTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.createTournament,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tournaments'] });
    },
  });
}

/** Set match result — invalidates ['admin', 'tournaments'] */
export function useSetMatchResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, ...payload }: { matchId: number } & Parameters<typeof adminApi.setMatchResult>[1]) =>
      adminApi.setMatchResult(matchId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tournaments'] });
      qc.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}

/** Close a match date and process points — invalidates ['admin', 'tournaments'] */
export function useCloseDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dateId: number) => adminApi.closeDate(dateId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tournaments'] });
      qc.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}

/** Publish results for a closed date — invalidates ['admin', 'tournaments'] and ['matches'] */
export function usePublishResults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dateId: number) => adminApi.publishResults(dateId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tournaments'] });
      qc.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}

/** Update system config — invalidates ['admin', 'config'] */
export function useUpdateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.updateConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'config'] });
    },
  });
}
