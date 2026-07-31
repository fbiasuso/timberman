import { useState } from 'react';
import { useCurrentMatches } from '../../hooks/use-matches';
import { useSetMatchResult, useCloseDate } from '../../hooks/use-admin';
import type { MatchDTO } from '../../types';
import theme from '../../styles/theme';

// ─── Styles ─────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: theme.tarjeta,
  borderRadius: 12,
  padding: 24,
  border: `1px solid ${theme.border}`,
  boxShadow: theme.glow,
};

const matchCard: React.CSSProperties = {
  background: theme.inputBg,
  borderRadius: 10,
  padding: 16,
  borderLeft: `4px solid ${theme.amarilloBet}`,
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  flexWrap: 'wrap',
};

const label: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: theme.textoSecundario,
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const select: React.CSSProperties = {
  padding: '8px 12px',
  background: theme.inputBg,
  border: `1px solid ${theme.border}`,
  borderRadius: 8,
  color: theme.blanco,
  fontSize: 14,
  outline: 'none',
  cursor: 'pointer',
};

const input: React.CSSProperties = {
  padding: '8px 12px',
  background: theme.inputBg,
  border: `1px solid ${theme.border}`,
  borderRadius: 8,
  color: theme.blanco,
  fontSize: 14,
  outline: 'none',
  width: 80,
};

const saveBtn: React.CSSProperties = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: 8,
  background: theme.verdeBet,
  color: theme.blanco,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const closeBtn: React.CSSProperties = {
  padding: '12px 24px',
  border: 'none',
  borderRadius: 10,
  background: theme.amarilloBet,
  color: theme.fondo,
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
  marginTop: 20,
  width: '100%',
};

const resultOptions = [
  { value: '', label: 'PENDIENTE' },
  { value: 'L', label: 'L — Local' },
  { value: 'E', label: 'E — Empate' },
  { value: 'V', label: 'V — Visita' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function ResultsEntry() {
  const { data, isLoading, error } = useCurrentMatches();
  const setResult = useSetMatchResult();
  const closeDate = useCloseDate();

  // Track per-match pending saves
  const [saving, setSaving] = useState<Record<number, boolean>>({});

  const handleSaveResult = (match: MatchDTO, result: string, score: string) => {
    setSaving((prev) => ({ ...prev, [match.id]: true }));
    setResult.mutate(
      { matchId: match.id, result, score: score || undefined },
      {
        onSettled: () => {
          setSaving((prev) => ({ ...prev, [match.id]: false }));
        },
      },
    );
  };

  const handleCloseDate = () => {
    if (!data?.matchDate) return;
    closeDate.mutate(data.matchDate.id);
  };

  // ── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={card}>
        <p style={{ color: theme.textoSecundario, textAlign: 'center' }}>Cargando partidos...</p>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={card}>
        <p style={{ color: theme.rojo, textAlign: 'center' }}>
          Error al cargar los partidos.
        </p>
      </div>
    );
  }

  const matchDate = data?.matchDate;
  const matches = data?.matches ?? [];

  if (!matchDate) {
    return (
      <div style={card}>
        <p style={{ color: theme.textoSecundario, textAlign: 'center' }}>
          No hay una fecha activa para cargar resultados.
        </p>
      </div>
    );
  }

  return (
    <div style={card}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 18, color: theme.blanco }}>
            Resultados — Fecha {matchDate.dateNumber}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: theme.textoSecundario }}>
            Estado: {matchDate.status}
          </p>
        </div>

        {/* Close date button */}
        {matchDate.status !== 'closed' && (
          <button
            onClick={handleCloseDate}
            disabled={closeDate.isPending}
            style={{
              ...closeBtn,
              width: 'auto',
              opacity: closeDate.isPending ? 0.6 : 1,
            }}
          >
            {closeDate.isPending
              ? 'Procesando...'
              : 'Procesar y Cerrar Puntos de la Fecha'}
          </button>
        )}
      </div>

      {closeDate.isSuccess && (
        <div
          style={{
            padding: '10px 16px',
            background: theme.betV,
            color: theme.verdeBet,
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          Fecha cerrada y puntos procesados correctamente.
        </div>
      )}

      {closeDate.error && (
        <div
          style={{
            padding: '10px 16px',
            background: theme.dangerBg,
            color: theme.rojo,
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          Error al cerrar la fecha.{' '}
          {((closeDate.error as any)?.response?.data?.message as string) ?? ''}
        </div>
      )}

      {/* Match cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {matches.map((match) => (
          <div key={match.id} style={matchCard}>
            {/* Team names */}
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: theme.blanco }}>
                {match.localTeam}
                <span style={{ color: theme.textoSecundario, margin: '0 8px' }}>vs</span>
                {match.visitorTeam}
              </div>
            </div>

            {/* Result selector */}
            <div>
              <div style={label}>Resultado</div>
              <select
                style={select}
                defaultValue={match.result ?? ''}
                onChange={(e) => {
                  const newResult = e.target.value;
                  handleSaveResult(match, newResult, match.score ?? '');
                }}
              >
                {resultOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Score input */}
            <div>
              <div style={label}>Marcador</div>
              <input
                style={input}
                placeholder="2-1"
                defaultValue={match.score ?? ''}
                onBlur={(e) => {
                  const score = e.target.value.trim();
                  if (score !== (match.score ?? '')) {
                    handleSaveResult(match, match.result ?? '', score);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const score = (e.target as HTMLInputElement).value.trim();
                    if (score !== (match.score ?? '')) {
                      handleSaveResult(match, match.result ?? '', score);
                    }
                  }
                }}
              />
            </div>

            {/* Save button per match */}
            <button
              onClick={() =>
                handleSaveResult(match, match.result ?? '', match.score ?? '')
              }
              disabled={saving[match.id]}
              style={{
                ...saveBtn,
                opacity: saving[match.id] ? 0.6 : 1,
                cursor: saving[match.id] ? 'not-allowed' : 'pointer',
              }}
            >
              {saving[match.id] ? 'Guardando...' : 'Guardar'}
            </button>

            {/* Feedback */}
            {setResult.isSuccess &&
              setResult.variables?.matchId === match.id && (
                <span style={{ color: theme.verdeBet, fontSize: 12 }}>✓</span>
              )}
            {setResult.isError &&
              setResult.variables?.matchId === match.id && (
                <span style={{ color: theme.rojo, fontSize: 12 }}>✗</span>
              )}
          </div>
        ))}
      </div>
    </div>
  );
}
