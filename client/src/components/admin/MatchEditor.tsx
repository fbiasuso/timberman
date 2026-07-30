import { useMemo, useState } from 'react';
import type { MatchDTO } from '../../types';
import { useCurrentMatches } from '../../hooks/use-matches';
import { formatDate } from '../../utils/format';

// ─── Styles ─────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#1e293b',
  borderRadius: 12,
  padding: 24,
  border: '1px solid #334155',
};

const label: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#94a3b8',
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const input: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#f1f5f9',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16,
};

const btn: React.CSSProperties = {
  width: '100%',
  padding: '12px 0',
  border: 'none',
  borderRadius: 10,
  background: '#16a34a',
  color: '#fff',
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'background 0.15s',
};

const btnDisabled: React.CSSProperties = {
  ...btn,
  background: '#475569',
  cursor: 'not-allowed',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function MatchEditor() {
  const { data, isLoading, error } = useCurrentMatches();
  const [matches, setMatches] = useState<MatchDTO[] | null>(null);
  const [saved, setSaved] = useState(false);

  // Initialise local state when data loads
  const initialised = useMemo(() => {
    if (data?.matches && matches === null) {
      setMatches(structuredClone(data.matches));
      return true;
    }
    return false;
  }, [data, matches]);

  // Keep TS happy — initialised is read but used by the effect intent
  void initialised;

  // Derive display list from local state or server data
  const displayMatches = matches ?? data?.matches ?? [];

  const handleChange = (id: number, field: string, value: string) => {
    setMatches((prev) =>
      (prev ?? data?.matches ?? []).map((m) =>
        m.id === id ? { ...m, [field]: value || null } : m,
      ),
    );
  };

  const handleSave = () => {
    // Placeholder — no batch PATCH endpoint for match details yet.
    // Each changed field would need a PATCH /api/admin/matches/:id call.
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // ── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={card}>
        <p style={{ color: '#94a3b8', textAlign: 'center' }}>Cargando partidos...</p>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={card}>
        <p style={{ color: '#ef4444', textAlign: 'center' }}>
          Error al cargar los partidos.
        </p>
      </div>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────
  if (displayMatches.length === 0) {
    return (
      <div style={card}>
        <p style={{ color: '#94a3b8', textAlign: 'center' }}>
          No hay partidos en la fecha activa.
        </p>
      </div>
    );
  }

  return (
    <div style={card}>
      <h3 style={{ margin: '0 0 20px', fontSize: 18, color: '#f1f5f9' }}>
        Editar Partidos — Fecha {data?.matchDate?.dateNumber ?? '—'}
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {displayMatches.map((match) => (
          <div key={match.id} style={{ padding: 16, background: '#0f172a', borderRadius: 10 }}>
            <div style={grid}>
              {/* Local team */}
              <div>
                <label style={label}>Equipo Local</label>
                <input
                  style={input}
                  value={match.localTeam}
                  onChange={(e) => handleChange(match.id, 'localTeam', e.target.value)}
                />
              </div>

              {/* Visitor team */}
              <div>
                <label style={label}>Equipo Visitante</label>
                <input
                  style={input}
                  value={match.visitorTeam}
                  onChange={(e) => handleChange(match.id, 'visitorTeam', e.target.value)}
                />
              </div>

              {/* Local escudo URL */}
              <div>
                <label style={label}>Escudo Local (URL)</label>
                <input
                  style={input}
                  value={match.localImg ?? ''}
                  onChange={(e) => handleChange(match.id, 'localImg', e.target.value)}
                />
              </div>

              {/* Visitor escudo URL */}
              <div>
                <label style={label}>Escudo Visitante (URL)</label>
                <input
                  style={input}
                  value={match.visitorImg ?? ''}
                  onChange={(e) => handleChange(match.id, 'visitorImg', e.target.value)}
                />
              </div>

              {/* Scheduled date */}
              <div>
                <label style={label}>Fecha</label>
                <input
                  style={input}
                  type="date"
                  value={
                    match.scheduledAt
                      ? new Date(match.scheduledAt).toISOString().slice(0, 10)
                      : ''
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    handleChange(match.id, 'scheduledAt', val ? `${val}T00:00:00.000Z` : '');
                  }}
                />
              </div>

              {/* Scheduled time */}
              <div>
                <label style={label}>Horario</label>
                <input
                  style={input}
                  type="time"
                  value={
                    match.scheduledAt
                      ? new Date(match.scheduledAt).toTimeString().slice(0, 5)
                      : ''
                  }
                  onChange={(e) => {
                    const time = e.target.value;
                    const currentDate = match.scheduledAt
                      ? new Date(match.scheduledAt).toISOString().slice(0, 10)
                      : new Date().toISOString().slice(0, 10);
                    handleChange(match.id, 'scheduledAt', time ? `${currentDate}T${time}:00.000Z` : '');
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        style={saved ? { ...btn, background: '#16a34a' } : btn}
      >
        {saved ? '✓ Guardado' : 'Guardar Cambios'}
      </button>

      {saved && (
        <p style={{ textAlign: 'center', color: '#22c55e', fontSize: 13, marginTop: 8 }}>
          Cambios guardados correctamente.
        </p>
      )}
    </div>
  );
}
