import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../api/admin-api';

// Single cache + invalidation key for the whole teams/leagues registry
// (design D8 — one GET /api/admin/leagues query feeds the Equipos tab and the
// match forms; every mutation invalidates this key).
export const leaguesQueryKey = ['admin', 'leagues'] as const;

// ─── Queries ────────────────────────────────────────────────────────────────

/** Fetch all leagues with nested member teams */
export function useLeagues() {
  return useQuery({
    queryKey: leaguesQueryKey,
    queryFn: () => adminApi.getLeagues(),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────
// All invalidate ['admin', 'leagues'] — team renames do NOT rewrite match
// strings (design D10), so no match query invalidation is needed here.

/** Create a league */
export function useCreateLeague() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.createLeague,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaguesQueryKey });
    },
  });
}

/** Update a league */
export function useUpdateLeague() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leagueId, ...payload }: { leagueId: number } & Parameters<typeof adminApi.updateLeague>[1]) =>
      adminApi.updateLeague(leagueId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaguesQueryKey });
    },
  });
}

/** Delete a league — 409 while it still has team memberships */
export function useDeleteLeague() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leagueId: number) => adminApi.deleteLeague(leagueId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaguesQueryKey });
    },
  });
}

/** Create a team with league memberships */
export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.createTeam,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaguesQueryKey });
    },
  });
}

/** Update a team (fields / memberships) */
export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, ...payload }: { teamId: number } & Parameters<typeof adminApi.updateTeam>[1]) =>
      adminApi.updateTeam(teamId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaguesQueryKey });
    },
  });
}

/** Delete a team — 409 while it is referenced by any match */
export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: number) => adminApi.deleteTeam(teamId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaguesQueryKey });
    },
  });
}

/** Re-upload a team shield */
export function useSetTeamLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, ...payload }: { teamId: number } & Parameters<typeof adminApi.setTeamLogo>[1]) =>
      adminApi.setTeamLogo(teamId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaguesQueryKey });
    },
  });
}
