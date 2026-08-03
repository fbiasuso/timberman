import { useState } from 'react';
import { useAdminTournaments, useCreateDate } from '../../hooks/use-admin';
import { useMatchesByDate } from '../../hooks/use-matches';
import theme from '../../styles/theme';
import AddMatchForm from './AddMatchForm';
import MatchRow from './MatchRow';

// ─── Styles ─────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: theme.tarjeta,
  borderRadius: 12,
  padding: 24,
  border: `1px solid ${theme.border}`,
  boxShadow: theme.glow,
};

const primaryBtn: React.CSSProperties = {
  padding: '10px 20px',
  border: 'none',
  borderRadius: 8,
  background: theme.amarilloBet,
  color: theme.fondo,
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};

const primaryBtnDisabled: React.CSSProperties = {
  ...primaryBtn,
  background: theme.disabled,
  color: theme.textoSecundario,
  cursor: 'not-allowed',
};

const accordionItem: React.CSSProperties = {
  background: theme.tarjeta,
  border: `1px solid ${theme.border}`,
  borderRadius: 8,
};

const headerBtn = (expanded: boolean): React.CSSProperties => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  width: '100%',
  padding: '14px 16px',
  border: 'none',
  borderRadius: 8,
  background: expanded ? theme.inputBg : 'transparent',
  color: theme.blanco,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'left',
});

const panel: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: '4px 16px 16px',
};

const errorBox: React.CSSProperties = {
  padding: '10px 16px',
  background: theme.dangerBg,
  color: theme.rojo,
  borderRadius: 8,
  marginBottom: 16,
  fontSize: 14,
};

/** Right-side icons group: status icons + accordion chevron, spaced apart */
const statusIcons: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  color: theme.textoSecundario,
};

/** Format integer cents as Argentine-style pesos: 500 → "$5,00" */
function formatPesos(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace('.', ',')}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function MatchEditor() {
  const { data: tournaments, isLoading, error } = useAdminTournaments();
  const createDate = useCreateDate();
  const [selectedDateId, setSelectedDateId] = useState<number | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  // The tournament being edited: the one with an open date (the current betting
  // round), falling back to the first tournament.
  const tournament =
    tournaments?.find((t) => t.dates.some((d) => d.status === 'open')) ?? tournaments?.[0] ?? null;

  const openDate = tournament?.dates.find((d) => d.status === 'open') ?? null;
  // Default-expand the open date until the user interacts; an explicit
  // selection (or collapse) then takes over.
  const expandedDateId = hasInteracted ? selectedDateId : (openDate?.id ?? null);

  // Admin route → full data (results included) for ANY date status (design D7).
  const { data: expandedData, isLoading: matchesLoading, error: matchesError } = useMatchesByDate(
    expandedDateId ?? undefined,
  );

  const toggleDate = (id: number) => {
    // Toggle against the effective expanded date (default-expand counts as
    // already expanded), so the first click on the open date collapses it.
    const wasExpanded = expandedDateId === id;
    setHasInteracted(true);
    setSelectedDateId(wasExpanded ? null : id);
  };

  const handleCreateDate = () => {
    if (!tournament) return;
    createDate.mutate({ tournamentId: tournament.id });
  };

  // ── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={card}>
        <p style={{ color: theme.textoSecundario, textAlign: 'center' }}>Cargando fechas...</p>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={card}>
        <p style={{ color: theme.rojo, textAlign: 'center' }}>Error al cargar las fechas.</p>
      </div>
    );
  }

  // ── No tournaments ─────────────────────────────────────────────────────
  if (!tournament) {
    return (
      <div style={card}>
        <p style={{ color: theme.textoSecundario, textAlign: 'center' }}>
          No hay torneos para gestionar partidos.
        </p>
      </div>
    );
  }

  // The current betting round (open date) is the most relevant row, so it is
  // listed first; the rest are ordered descending by dateNumber (newest first).
  const dates = [...tournament.dates].sort((a, b) => {
    if (a.status === 'open' && b.status !== 'open') return -1;
    if (b.status === 'open' && a.status !== 'open') return 1;
    return b.dateNumber - a.dateNumber;
  });
  const matches = expandedData?.matches ?? [];

  return (
    <div style={card}>
      {/* Header: tournament name + create-date action */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 18, color: theme.blanco }}>Editar Partidos</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: theme.textoSecundario }}>
            {tournament.name}
          </p>
        </div>

        <button
          onClick={handleCreateDate}
          disabled={createDate.isPending}
          style={createDate.isPending ? primaryBtnDisabled : primaryBtn}
        >
          {createDate.isPending ? 'Creando...' : 'Nueva fecha'}
        </button>
      </div>

      {createDate.isError && (
        <div style={errorBox}>
          No se pudo crear la fecha.{' '}
          {((createDate.error as any)?.response?.data?.message as string) ?? ''}
        </div>
      )}

      {/* Accordion of all dates */}
      {dates.length === 0 ? (
        <p style={{ color: theme.textoSecundario, textAlign: 'center' }}>
          No hay fechas en este torneo.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dates.map((date) => {
            const expanded = date.id === expandedDateId;
            return (
              <div key={date.id} style={accordionItem}>
                <button
                  onClick={() => toggleDate(date.id)}
                  style={headerBtn(expanded)}
                  aria-expanded={expanded}
                >
                  <span>
                    Fecha {date.dateNumber} · {formatPesos(date.betAmount)}
                  </span>
                  <span style={statusIcons}>
                    {/* Both closed and results dates are closed for betting; a
                        results date additionally shows the paid check. */}
                    {(date.status === 'closed' || date.status === 'results') && (
                      <span title="Fecha cerrada" aria-hidden="true">🔒</span>
                    )}
                    {date.status === 'results' && (
                      <span title="Fecha pagada" aria-hidden="true">✅</span>
                    )}
                    <span title="expandir" aria-hidden="true">
                      {expanded ? '▲' : '▼'}
                    </span>
                  </span>
                </button>

                {expanded && (
                  <div style={panel}>
                    {matchesLoading && (
                      <p style={{ color: theme.textoSecundario, textAlign: 'center' }}>
                        Cargando partidos...
                      </p>
                    )}
                    {!matchesLoading && matchesError && (
                      <p style={{ color: theme.rojo, textAlign: 'center' }}>
                        Error al cargar los partidos.
                      </p>
                    )}
                    {!matchesLoading && !matchesError && matches.length === 0 && (
                      <p style={{ color: theme.textoSecundario, textAlign: 'center' }}>
                        No hay partidos en esta fecha.
                      </p>
                    )}

                    {matches.map((match) => (
                      <MatchRow
                        key={match.id}
                        match={match}
                        editable={date.status === 'open'}
                      />
                    ))}

                    {date.status === 'open' && <AddMatchForm dateId={date.id} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
