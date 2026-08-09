import { useState, useMemo } from 'react';
import MatchEditor from './MatchEditor';
import ResultsEntry from './ResultsEntry';
import UserManager from './UserManager';
import ConfigPanel from './ConfigPanel';
import TournamentManager from './TournamentManager';
import Equipos from './Equipos';
import theme from '../../styles/theme';

type Tab = 'partidos' | 'resultados' | 'torneos' | 'equipos' | 'sistema';

interface TabDefinition {
  id: Tab;
  label: string;
}

const tabs: TabDefinition[] = [
  { id: 'partidos', label: 'Partidos' },
  { id: 'resultados', label: 'Resultados' },
  { id: 'torneos', label: 'Torneos' },
  { id: 'equipos', label: 'Equipos' },
  { id: 'sistema', label: 'Sistema' },
];

// ─── Styles ─────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  maxWidth: 960,
  margin: '0 auto',
};

const headerStyle: React.CSSProperties = {
  marginBottom: 24,
};

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  background: theme.tarjeta,
  borderRadius: 12,
  padding: 4,
  marginBottom: 24,
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '10px 0',
  border: 'none',
  borderRadius: 8,
  background: active ? theme.amarilloBet : 'transparent',
  color: active ? theme.fondo : theme.textoSecundario,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s',
});

// ─── Component ──────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('partidos');

  const tabContent = useMemo(() => {
    switch (activeTab) {
      case 'partidos':
        return <MatchEditor />;
      case 'resultados':
        return <ResultsEntry />;
      case 'torneos':
        return <TournamentManager />;
      case 'equipos':
        return <Equipos />;
      case 'sistema':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <UserManager />
            <ConfigPanel />
          </div>
        );
    }
  }, [activeTab]);

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h2 style={{ margin: 0, fontSize: 24, color: theme.blanco }}>Admin</h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: theme.textoSecundario }}>
          Gestión del sistema
        </p>
      </div>

      {/* Tab bar */}
      <div style={tabBarStyle}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={tabStyle(activeTab === tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tabContent}
    </div>
  );
}
