import { Outlet } from 'react-router-dom';
import Header from './Header';
import NavTabs from './NavTabs';
import theme from '../../styles/theme';

export default function AppShell() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: theme.fondo, color: theme.blanco }}>
      <Header />
      <NavTabs />
      <main style={{ flex: 1, padding: 24, maxWidth: 960, width: '100%', margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
