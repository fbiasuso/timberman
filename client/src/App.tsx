import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from './components/auth/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminProtectedRoute from './components/admin/AdminProtectedRoute';
import AppShell from './components/layout/AppShell';
import CarteleraPage from './components/matches/CarteleraPage';
import TicketsPage from './components/bets/TicketsPage';
import RankingPage from './components/ranking/RankingPage';
import AdminPage from './components/admin/AdminPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<CarteleraPage />} />
              <Route path="tickets" element={<TicketsPage />} />
              <Route path="ranking" element={<RankingPage />} />
            </Route>
          </Route>
          <Route element={<AdminProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="admin" element={<AdminPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
