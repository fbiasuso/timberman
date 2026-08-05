import { useState } from 'react';
import { useMatchDates, useMatchHistory } from '../../hooks/use-matches';
import { formatDate } from '../../utils/format';
import type { MatchDTO } from '../../types';
import theme from '../../styles/theme';

// ─── Styles ─────────────────────────────────────────────────────────────────

const section: React.CSSProperties = {
  marginTop: 32,
};

const title: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: 16,
  color: theme.blanco,
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

const row: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  flexWrap: 'wrap',
  padding: '12px 16px',
  background: theme.searchBg,
  borderRadius: 8,
};

const teamImg: React.CSSProperties = {
  width: 28,
  height: 28,
  objectFit: 'contain',
};

const teamName: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 14,
  color: theme.blanco,
};

const vsText: React.CSSProperties = {
  color: theme.textoSecundario,
  margin: '0 8px',
};

const scheduleText: React.CSSProperties = {
  fontSize: 12,
  color: theme.textoSecundario,
  marginTop: 2,
};

/** Right-side icons group: status icons + accordion chevron, spaced apart */
const statusIcons: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  color: theme.textoSecundario,
};

/** Score rendered between the team names (home - away) */
const scoreText: React.CSSProperties = {
  color: theme.blanco,
  margin: '0 8px',
  fontWeight: 700,
};

/** The actual match result badge (L/E/V), far right of the match row */
const resultBadge: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 14,
  color: theme.blanco,
  background: theme.searchBg,
  borderRadius: 6,
  padding: '4px 10px',
  minWidth: 32,
  textAlign: 'center',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Normalize a "2-1" score string to "2 - 1" (home goals - away goals) for the
 * centered layout. The first number belongs to the local/home team, the second
 * to the visitor/away team. Returns null when there is no score yet — the
 * server nulls scores on non-'results' dates.
 */
function formatScore(score: string | null): string | null {
  if (!score) return null;
  const [home, away] = score.split('-').map((s) => s.trim());
  if (home === undefined || away === undefined) return score;
  return `${home} - ${away}`;
}

function formatScheduledAt(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return `${formatDate(d)} ${time}`;
}

function hideBrokenImg(e: React.SyntheticEvent<HTMLImageElement>) {
  (e.target as HTMLImageElement).style.display = 'none';
}

// ─── Read-only history row ──────────────────────────────────────────────────

interface HistoryMatchRowProps {
  match: MatchDTO;
}

function HistoryMatchRow({ match }: HistoryMatchRowProps) {
  const score = formatScore(match.score);

  return (
    <div style={row}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          flex: 1,
          minWidth: 180,
        }}
      >
        {/* Top line: scheduled date/time */}
        {match.scheduledAt && (
          <div style={scheduleText}>{formatScheduledAt(match.scheduledAt)}</div>
        )}

        {/* Team names with the score centered between them (home - away) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {match.localImg && (
            <img src={match.localImg} alt={match.localTeam} style={teamImg} onError={hideBrokenImg} />
          )}
          <span style={teamName}>
            {match.localTeam}
            {score ? (
              <>
                <span style={scoreText}>{score}</span>
                <span>{match.visitorTeam}</span>
              </>
            ) : (
              <>
                <span style={vsText}>vs</span>
                <span>{match.visitorTeam}</span>
              </>
            )}
          </span>
          {match.visitorImg && (
            <img src={match.visitorImg} alt={match.visitorTeam} style={teamImg} onError={hideBrokenImg} />
          )}
        </div>
      </div>

      {/* Far right: the actual match result (L/E/V), neutral-styled. Only
          'results' dates expose a result — the server nulls it otherwise. */}
      {match.result && (
        <div
          style={resultBadge}
          title={match.result === 'L' ? 'Local' : match.result === 'E' ? 'Empate' : 'Visitante'}
        >
          {match.result}
        </div>
      )}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * HistorySection — "Fechas anteriores" for the Cartelera.
 *
 * Lists every non-open date (the open date is the current betting round
 * rendered above). Expanding a row fetches that date's sanitized history via
 * useMatchHistory and renders read-only match rows: teams only for 'closed'
 * dates (server nulls results), teams + score + actual result badge (L/E/V)
 * for 'results' dates.
 */
export default function HistorySection() {
  const { data, isLoading, error } = useMatchDates();
  const [expandedDateId, setExpandedDateId] = useState<number | null>(null);

  // Rules of Hooks: called unconditionally; the query is disabled until a row
  // is expanded (design D8).
  const { data: historyData, isLoading: historyLoading, error: historyError } = useMatchHistory(
    expandedDateId ?? undefined,
  );

  // "Fechas anteriores": every non-open date, sorted chronologically.
  const dates = (data?.dates ?? [])
    .filter((d) => d.status !== 'open')
    .sort((a, b) => a.dateNumber - b.dateNumber);

  if (isLoading) {
    return (
      <div style={section}>
        <p style={{ color: theme.textoSecundario, textAlign: 'center' }}>
          Cargando fechas anteriores...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={section}>
        <p style={{ color: theme.rojo, textAlign: 'center' }}>
          Error al cargar las fechas anteriores.
        </p>
      </div>
    );
  }

  // No previous dates → nothing to show below the current cartelera
  if (dates.length === 0) return null;

  const matches = historyData?.matches ?? [];

  return (
    <div style={section}>
      <h3 style={title}>Fechas anteriores</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {dates.map((date) => {
          const expanded = date.id === expandedDateId;
          return (
            <div key={date.id} style={accordionItem}>
              <button
                onClick={() => setExpandedDateId(expanded ? null : date.id)}
                style={headerBtn(expanded)}
                aria-expanded={expanded}
              >
                <span>Fecha {date.dateNumber}</span>
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
                  {historyLoading && (
                    <p style={{ color: theme.textoSecundario, textAlign: 'center' }}>
                      Cargando partidos...
                    </p>
                  )}
                  {!historyLoading && historyError && (
                    <p style={{ color: theme.rojo, textAlign: 'center' }}>
                      Error al cargar los partidos.
                    </p>
                  )}
                  {!historyLoading && !historyError && matches.length === 0 && (
                    <p style={{ color: theme.textoSecundario, textAlign: 'center' }}>
                      No hay partidos en esta fecha.
                    </p>
                  )}

                  {matches.map((match) => (
                    <HistoryMatchRow
                      key={match.id}
                      match={match}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
