import { Fragment, useState } from 'react';
import { useRanking, useUserDetail } from '../../hooks/use-ranking';
import { useTournaments } from '../../hooks/use-tournaments';
import type { RankingEntry } from '../../types';
import theme from '../../styles/theme';

/* ─── Helpers ─────────────────────────────────────────── */

function getMedal(position: number): string | null {
  if (position === 1) return '🥇';
  if (position === 2) return '🥈';
  if (position === 3) return '🥉';
  return null;
}

function getRowBackground(position: number, isExpanded: boolean, isHovered: boolean): string {
  if (isExpanded) return theme.border;
  if (isHovered) return theme.border;
  if (position <= 3) return theme.top3Bg;
  return theme.pillBg;
}

/* ─── Inline styles (dark theme) ──────────────────────── */

const styles = {
  container: {
    minHeight: 320,
    background: theme.tarjeta,
    borderRadius: 12,
    padding: 24,
    color: theme.blanco,
    boxShadow: theme.glow,
  } as React.CSSProperties,

  title: {
    margin: '0 0 4px',
    fontSize: 22,
    fontWeight: 700,
    color: theme.amarilloBet,
  } as React.CSSProperties,

  subtitle: {
    margin: '0 0 24px',
    fontSize: 13,
    color: theme.textoSecundario,
  } as React.CSSProperties,

  /* Tournament selector */
  selectorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  select: {
    background: theme.searchBg,
    color: theme.blanco,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 14,
    minWidth: 180,
    cursor: 'pointer',
  } as React.CSSProperties,

  activeBadge: {
    background: theme.top3Bg,
    color: theme.amarilloBet,
    border: `1px solid ${theme.amarilloBet}`,
    borderRadius: 999,
    padding: '3px 10px',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  } as React.CSSProperties,

  /* Table header */
  headerRow: {
    display: 'flex',
    padding: '10px 16px',
    borderBottom: `1px solid ${theme.border}`,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: theme.textoSecundario,
  } as React.CSSProperties,

  colPos: {
    width: 72,
    flexShrink: 0,
  } as React.CSSProperties,

  colUser: {
    flex: 1,
  } as React.CSSProperties,

  colPts: {
    width: 80,
    textAlign: 'right' as const,
    flexShrink: 0,
  } as React.CSSProperties,

  /* Data row */
  row: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'background 0.15s',
    borderBottom: `1px solid ${theme.border}`,
    userSelect: 'none' as const,
  } as React.CSSProperties,

  position: {
    width: 72,
    flexShrink: 0,
    fontWeight: 700,
    fontSize: 16,
  } as React.CSSProperties,

  username: {
    flex: 1,
    fontSize: 15,
    fontWeight: 500,
  } as React.CSSProperties,

  points: {
    width: 80,
    flexShrink: 0,
    textAlign: 'right' as const,
    fontWeight: 700,
    fontSize: 16,
    color: theme.amarilloBet,
  } as React.CSSProperties,

  expandIcon: {
    marginLeft: 8,
    fontSize: 12,
    color: theme.textoSecundario,
    transition: 'transform 0.2s',
  } as React.CSSProperties,

  /* Breakdown */
  breakdown: {
    padding: '12px 16px 12px 88px',
    background: theme.searchBg,
    borderRadius: '0 0 8px 8px',
    marginTop: -4,
    marginBottom: 4,
  } as React.CSSProperties,

  breakdownItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    fontSize: 14,
    borderBottom: `1px solid ${theme.border}`,
  } as React.CSSProperties,

  breakdownLabel: {
    color: theme.textoSecundario,
  } as React.CSSProperties,

  breakdownValue: {
    fontWeight: 600,
    color: theme.amarilloBet,
  } as React.CSSProperties,

  breakdownLoading: {
    color: theme.textoSecundario,
    fontSize: 14,
    fontStyle: 'italic' as const,
  } as React.CSSProperties,

  breakdownError: {
    color: theme.rojo,
    fontSize: 13,
  } as React.CSSProperties,

  /* State messages */
  stateMsg: {
    textAlign: 'center' as const,
    padding: 48,
    color: theme.textoSecundario,
  } as React.CSSProperties,

  stateError: {
    textAlign: 'center' as const,
    padding: 48,
    color: theme.rojo,
  } as React.CSSProperties,
};

/* ─── Component ───────────────────────────────────────── */

export default function RankingPage() {
  const { data: tournaments } = useTournaments();
  const activeTournament = tournaments?.find((t) => t.status === 'active');
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | undefined>(undefined);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);

  // undefined ⇒ server resolves the active tournament (default view)
  const currentTournamentId = selectedTournamentId ?? activeTournament?.id;
  const currentTournament = tournaments?.find((t) => t.id === currentTournamentId);

  const { data: ranking, isLoading, error } = useRanking(currentTournamentId);
  const userDetail = useUserDetail(expandedUserId ?? '', currentTournamentId);

  // Only show the detail section for the currently expanded user
  const detailData =
    expandedUserId && userDetail.data
      ? userDetail.data
      : null;

  /* ── Tournament selector ────────────────────────────── */
  const renderSelector = () => {
    if (!tournaments || tournaments.length === 0) return null;
    return (
      <div style={styles.selectorRow}>
        <select
          value={currentTournamentId ?? ''}
          onChange={(e) => {
            const value = e.target.value;
            setSelectedTournamentId(value ? Number(value) : undefined);
          }}
          aria-label="Torneo"
        >
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {currentTournament?.status === 'active' && (
          <span style={styles.activeBadge}>activo</span>
        )}
      </div>
    );
  };

  /* ── Loading ──────────────────────────────────────── */
  if (isLoading) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>Ranking</h2>
        <p style={styles.subtitle}>Clasificación del torneo</p>
        {renderSelector()}
        <div style={styles.stateMsg}>Cargando ranking...</div>
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────── */
  if (error) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>Ranking</h2>
        <p style={styles.subtitle}>Clasificación del torneo</p>
        {renderSelector()}
        <div style={styles.stateError}>
          Error al cargar el ranking. Intenta de nuevo.
        </div>
      </div>
    );
  }

  /* ── Empty ────────────────────────────────────────── */
  if (!ranking || ranking.length === 0) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>Ranking</h2>
        <p style={styles.subtitle}>Clasificación del torneo</p>
        {renderSelector()}
        <div style={styles.stateMsg}>
          <p style={{ margin: 0, fontSize: 16 }}>No hay datos de ranking todavía.</p>
          <p style={{ margin: '8px 0 0', fontSize: 14 }}>
            Los puntajes aparecerán cuando se publiquen los resultados.
          </p>
        </div>
      </div>
    );
  }

  /* ── Toggle expand ────────────────────────────────── */
  const handleToggle = (userId: string) => {
    setExpandedUserId((prev) => (prev === userId ? null : userId));
  };

  /* ── Render ───────────────────────────────────────── */
  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Ranking</h2>
      <p style={styles.subtitle}>Clasificación del torneo</p>

      {renderSelector()}

      {/* Header */}
      <div style={styles.headerRow}>
        <div style={styles.colPos}>Posición</div>
        <div style={styles.colUser}>Usuario</div>
        <div style={styles.colPts}>Puntos</div>
      </div>

      {/* Rows */}
      {ranking.map((entry: RankingEntry) => {
        const isExpanded = expandedUserId === entry.userId;
        const isHovered = hoveredUserId === entry.userId;
        const medal = getMedal(entry.position);

        return (
          <div key={entry.userId}>
            {/* Main row */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleToggle(entry.userId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggle(entry.userId);
                }
              }}
              onMouseEnter={() => setHoveredUserId(entry.userId)}
              onMouseLeave={() => setHoveredUserId(null)}
              style={{
                ...styles.row,
                background: getRowBackground(entry.position, isExpanded, isHovered),
              }}
            >
              <div style={styles.position}>
                {medal ? (
                  <span style={{ fontSize: 20 }}>{medal}</span>
                ) : (
                  <span style={{ color: theme.textoSecundario }}>#{entry.position}</span>
                )}
              </div>
              <div style={styles.username}>{entry.username}</div>
              <div style={styles.points}>{entry.totalPoints} pts</div>
              <div
                style={{
                  ...styles.expandIcon,
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                ▼
              </div>
            </div>

            {/* Expanded breakdown */}
            {isExpanded && (
              <div style={styles.breakdown}>
                {userDetail.isLoading && (
                  <div style={styles.breakdownLoading}>
                    Cargando detalle...
                  </div>
                )}

                {userDetail.error && (
                  <div style={styles.breakdownError}>
                    Error al cargar el detalle.
                  </div>
                )}

                {detailData && detailData.length === 0 && (
                  <div style={styles.breakdownLoading}>
                    Sin puntos en ninguna fecha.
                  </div>
                )}

                {detailData && detailData.length > 0 && (
                  <div>
                    {detailData.map((bd, i) => {
                      const totalMatches = bd.totalMatches ?? 0;
                      const correctPredictions = bd.correctPredictions ?? 0;
                      const matchesText =
                        totalMatches > 0
                          ? `acertó ${correctPredictions} de ${totalMatches} partidos`
                          : 'Sin partidos con resultado';

                      return (
                        <Fragment key={i}>
                          <div style={styles.breakdownItem}>
                            <span style={styles.breakdownLabel}>
                              Fecha {bd.dateNumber}
                            </span>
                            <span style={styles.breakdownValue}>
                              {bd.points} pts
                            </span>
                          </div>
                          <div style={styles.breakdownItem}>
                            <span style={styles.breakdownLabel}>{matchesText}</span>
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
