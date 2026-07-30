import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';

const baseTabs = [
  { path: '/', label: 'Cartelera' },
  { path: '/tickets', label: 'Tickets' },
  { path: '/ranking', label: 'Ranking' },
];

export default function NavTabs() {
  const user = useAuthStore((s) => s.user);

  const tabs =
    user?.role === 'admin'
      ? [...baseTabs, { path: '/admin', label: 'Admin' }]
      : baseTabs;

  return (
    <nav
      style={{
        display: 'flex',
        borderBottom: '1px solid #e5e7eb',
        background: '#fff',
      }}
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          end={tab.path === '/'}
          style={({ isActive }) => ({
            padding: '12px 24px',
            textDecoration: 'none',
            color: isActive ? '#2563eb' : '#6b7280',
            fontWeight: isActive ? 600 : 400,
            borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
            transition: 'border-color 0.15s',
          })}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
