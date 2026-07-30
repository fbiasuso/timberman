import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { useMe } from '../../hooks/use-auth';

/**
 * Guards admin-only routes.
 * Redirects to /login if not authenticated, or to / if not admin.
 *
 * Uses useMe() to ensure user data is loaded on refresh
 * (the store is hydrated from localStorage on mount, but user is null
 *  until /me resolves).
 */
export default function AdminProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  // Trigger /me fetch on mount to populate store.user
  const { isLoading } = useMe();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Still loading user data — show a brief loading state instead of false redirect
  if (isLoading || !user) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: '#0f172a',
          color: '#94a3b8',
          fontSize: 14,
        }}
      >
        Verificando acceso...
      </div>
    );
  }

  if (user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
