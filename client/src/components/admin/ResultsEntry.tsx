import { useEffect, useMemo, useState } from 'react';
import { useCurrentMatches, useMatchesByDate } from '../../hooks/use-matches';
import {
  useAdminTournaments,
  useSetMatchResult,
  useCloseDate,
  usePublishResults,
} from '../../hooks/use-admin';
import { useIsMobile } from '../../hooks/use-is-mobile';
import { formatMoney } from '../../utils/format';
import { isValidInput, parseScoreToInputs, validationMessage } from '../../utils/match-result';
import type { MatchDTO, MatchDateStatus } from '../../types';
import type { TournamentDateDTO } from '../../api/admin-api';
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

const actionBtn: React.CSSProperties = {
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

const publishBtn: React.CSSProperties = {
  ...actionBtn,
  background: theme.verdeBet,
  color: theme.blanco,
};

const errorBox: React.CSSProperties = {
  padding: '10px 16px',
  background: theme.dangerBg,
  color: theme.rojo,
  borderRadius: 8,
  marginBottom: 16,
  fontSize: 14,
};

const successBox: React.CSSProperties = {
  padding: '10px 16px',
  background: theme.betV,
  color: theme.verdeBet,
  borderRadius: 8,
  marginBottom: 16,
  fontSize: 14,
};

/** Green checkmark that replaces Guardar after a successful save */
const checkmark: React.CSSProperties = {
  color: theme.verdeBet,
  fontSize: 20,
  fontWeight: 700,
  lineHeight: 1,
};

/** Secondary "Limpiar" action — only for matches that already have a saved result */
const clearBtn: React.CSSProperties = {
  padding: '8px 16px',
  border: `1px solid ${theme.border}`,
  borderRadius: 8,
  background: 'transparent',
  color: theme.textoSecundario,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

/** Inline real-time validation message (exact Spanish copy from the util) */
const validationMsg: React.CSSProperties = {
  color: theme.rojo,
  fontSize: 12,
  marginTop: 6,
  marginLeft: 16,
};

/** Per-match server error — reuses the errorBox pattern under the match row */
const inlineError: React.CSSProperties = {
  ...errorBox,
  marginBottom: 0,
  marginTop: 8,
  fontSize: 12,
  padding: '6px 10px',
};

// ─── Mobile layout (single column, three stacked lines) ────────────────────

/** Mobile match card: teams / scores / actions stacked in one column */
const matchCardMobile: React.CSSProperties = {
  ...matchCard,
  flexDirection: 'column',
  alignItems: 'stretch',
};

/** Mobile score inputs — same 3-column template as the cartelera teams grid */
const mobileInputsGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 60px 1fr',
  gap: 8,
};

/** Mobile inputs fill their grid cell under each team name */
const mobileInput: React.CSSProperties = {
  ...input,
  width: '100%',
};

/** Mobile actions line: Guardar / ✓ + Limpiar on one row, wraps if tight */
const mobileActionsRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 12,
};

/**
 * Per-match result entry state (design D6) — one record keyed by match.id in a
 * single useState. Validity is derived from the mirror util (D5), never stored.
 */
interface MatchEntryState {
  local: string;
  visitor: string;
  /** True once the admin edits an input — Guardar only renders while dirty */
  dirty: boolean;
  status: 'idle' | 'saving' | 'saved' | 'error';
  /** Server error message to surface inline (status === 'error') */
  error?: string;
}

/** Baseline entry prefilled from the persisted result/score (spec R7) */
function defaultEntry(match: MatchDTO): MatchEntryState {
  const inputs = parseScoreToInputs(match);
  return {
    local: inputs.local,
    visitor: inputs.visitor,
    dirty: false,
    status: match.result != null ? 'saved' : 'idle',
  };
}

/** Extract the server's Spanish message — same shape the existing errorBox reads */
function serverErrorMessage(error: unknown): string {
  return ((error as any)?.response?.data?.message as string) ?? 'Error al guardar el resultado.';
}

const statusLabels: Record<MatchDateStatus, string> = {
  open: 'Abierta',
  closed: 'Cerrada',
  results: 'Resultados publicados',
};

/** One financial summary row (label + value) */
function SummaryRow({ label: text, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 14,
        color: theme.textoSecundario,
        padding: '6px 0',
      }}
    >
      <span>{text}</span>
      <span style={{ fontWeight: 700, color: color ?? theme.blanco }}>{value}</span>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ResultsEntry() {
  const { data: currentData, isLoading: currentMatchesLoading, error: currentMatchesError } =
    useCurrentMatches();
  const { data: tournaments, isLoading: tournamentsLoading, error: tournamentsError } =
    useAdminTournaments();
  const setResult = useSetMatchResult();
  const closeDate = useCloseDate();
  const publishResults = usePublishResults();
  // Mobile viewport — stacks each match card into one column (teams line, score
  // inputs, then the actions line), mirroring the cartelera pattern.
  const isMobile = useIsMobile();

  // Per-match result entry state (design D6) — initialized from parseScoreToInputs
  // when the date's matches load, resynced on refetch for non-dirty entries.
  const [entryState, setEntryState] = useState<Record<number, MatchEntryState>>({});
  // Manual date selection (null = follow the current date)
  const [selectedDateId, setSelectedDateId] = useState<number | null>(null);
  // Auto-follow the open date until the admin makes a manual selection.
  const [userSelected, setUserSelected] = useState(false);

  // Default selection: the open date when it exists (it carries the matches),
  // otherwise the most recent date so the admin can publish or review it.
  const openDateId = currentData?.matchDate?.id ?? null;

  // All dates of the ACTIVE tournament, newest first (finished/archived
  // tournaments are frozen — results cannot be managed there, design D3).
  // Matches only exist for the current open date (GET /matches/current), so
  // any OTHER open date would render the wrong match cards (and saving would
  // patch the wrong date's matches) — keep the current open date plus all
  // non-open dates, which render financials only, no matches.
  const selectableDates = useMemo(() => {
    const active = tournaments?.find((t) => t.status === 'active');
    const all = (active?.dates ?? []).sort((a, b) => b.id - a.id);
    return all.filter((d) => d.id === openDateId || d.status !== 'open');
  }, [tournaments, openDateId]);

  const defaultDate: TournamentDateDTO | null = openDateId
    ? selectableDates.find((d) => d.id === openDateId) ?? null
    : selectableDates[0] ?? null;

  const activeDate = selectableDates.find((d) => d.id === selectedDateId) ?? defaultDate;

  // /matches/current only reaches the OPEN date, so a closed date's matches
  // must be loaded explicitly — lets the admin review/correct results before
  // publishing (PATCH /api/admin/matches/:matchId/result accepts them).
  // Null-safe: activeDate may be null here; the early return below guards it.
  const closedDateId = activeDate?.status === 'closed' ? activeDate.id : undefined;
  const { data: closedMatchesData, isLoading: closedMatchesLoading, error: closedMatchesError } =
    useMatchesByDate(closedDateId);

  // Follow the open date automatically until the admin picks a date manually —
  // otherwise a late-resolving /matches/current query would reset an admin's
  // manual selection.
  useEffect(() => {
    if (!userSelected) {
      setSelectedDateId(null);
    }
  }, [openDateId, userSelected]);

  // Hoisted before the early returns so the resync effect below can key on the
  // incoming match data (matches may be undefined while a date is loading).
  const status = activeDate?.status;
  const matches: MatchDTO[] =
    status === 'closed'
      ? (closedMatchesData?.matches ?? [])
      : (currentData?.matches ?? []);

  // Resync (design D6): after react-query invalidation refetches the date's
  // matches, reset the persisted baseline for entries that are NOT dirty — a
  // dirty entry holds an in-flight edit and must never be clobbered. Marking
  // resynced entries 'saved' when match.result != null keeps the checkmark.
  useEffect(() => {
    setEntryState((prev) => {
      let changed = false;
      const next: Record<number, MatchEntryState> = { ...prev };
      for (const match of matches) {
        const current = prev[match.id];
        if (current?.dirty) continue;
        const inputs = parseScoreToInputs(match);
        const target: MatchEntryState = {
          local: inputs.local,
          visitor: inputs.visitor,
          dirty: false,
          status: match.result != null ? 'saved' : 'idle',
        };
        if (
          !current ||
          current.local !== target.local ||
          current.visitor !== target.visitor ||
          current.status !== target.status
        ) {
          next[match.id] = target;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [matches]);

  const handleInputChange = (match: MatchDTO, field: 'local' | 'visitor', value: string) => {
    setEntryState((prev) => {
      const current = prev[match.id] ?? defaultEntry(match);
      return {
        ...prev,
        [match.id]: { ...current, [field]: value, dirty: true, status: 'idle', error: undefined },
      };
    });
  };

  const handleSave = (match: MatchDTO, entry: MatchEntryState) => {
    setEntryState((prev) => ({
      ...prev,
      [match.id]: { ...(prev[match.id] ?? entry), status: 'saving', error: undefined },
    }));
    setResult.mutate(
      { matchId: match.id, localScore: entry.local, visitorScore: entry.visitor },
      {
        onSuccess: () => {
          setEntryState((prev) => ({
            ...prev,
            [match.id]: { ...(prev[match.id] ?? entry), dirty: false, status: 'saved', error: undefined },
          }));
        },
        onError: (error) => {
          setEntryState((prev) => ({
            ...prev,
            [match.id]: { ...(prev[match.id] ?? entry), status: 'error', error: serverErrorMessage(error) },
          }));
        },
      },
    );
  };

  const handleClear = (match: MatchDTO) => {
    setEntryState((prev) => ({
      ...prev,
      [match.id]: { local: '', visitor: '', dirty: false, status: 'saving', error: undefined },
    }));
    setResult.mutate(
      { matchId: match.id, localScore: '', visitorScore: '' },
      {
        onSuccess: () => {
          setEntryState((prev) => ({
            ...prev,
            [match.id]: { local: '', visitor: '', dirty: false, status: 'idle', error: undefined },
          }));
        },
        onError: (error) => {
          setEntryState((prev) => ({
            ...prev,
            [match.id]: { local: '', visitor: '', dirty: false, status: 'error', error: serverErrorMessage(error) },
          }));
        },
      },
    );
  };

  const handlePublish = () => {
    // Publishing pays out the pozo and cannot be undone. Winners are computed
    // server-side at publish time, so the confirmation shows the pozo snapshot
    // and warns that the action is irreversible.
    const pozo = formatMoney(activeDate!.pozo);
    const message =
      activeDate!.winners.length > 0
        ? `¿Publicar resultados y pagar ${pozo} a ${activeDate!.winners.length} ganador(es)? Esta acción no se puede deshacer.`
        : `¿Publicar resultados y pagar el pozo de ${pozo}? Los ganadores se calculan al publicar; si no hay, el pozo se acumula. Esta acción no se puede deshacer.`;
    if (window.confirm(message)) {
      publishResults.mutate(activeDate!.id);
    }
  };

  // ── Loading / Error / Empty ─────────────────────────────────────────────
  if (tournamentsLoading) {
    return (
      <div style={card}>
        <p style={{ color: theme.textoSecundario, textAlign: 'center' }}>
          Cargando resultados...
        </p>
      </div>
    );
  }

  if (tournamentsError) {
    return (
      <div style={card}>
        <p style={{ color: theme.rojo, textAlign: 'center' }}>
          Error al cargar los resultados.
        </p>
      </div>
    );
  }

  if (!activeDate) {
    return (
      <div style={card}>
        <p style={{ color: theme.textoSecundario, textAlign: 'center' }}>
          No hay fechas para gestionar resultados.
        </p>
      </div>
    );
  }

  const matchesLoading = status === 'closed' ? closedMatchesLoading : currentMatchesLoading;
  const matchesError = status === 'closed' ? closedMatchesError : currentMatchesError;

  // Match cards with two score inputs + Guardar/Limpiar — shared by the OPEN
  // date (matches from /matches/current) and CLOSED dates (matches from
  // /matches/dates/:dateId), so an admin can correct a closed date's results
  // before publishing.
  const matchesSection = (
    <>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        {matches.map((match) => {
          const entry = entryState[match.id] ?? defaultEntry(match);
          const valid = isValidInput(entry.local, entry.visitor);
          const hasSavedResult = match.result != null || entry.status === 'saved';

          // Shared per-match pieces — the desktop row and the mobile
          // single-column layout render the SAME content, only the placement
          // differs (no logic or behavior change).
          const teamsLine = (
            <div style={{ fontWeight: 600, fontSize: 14, color: theme.blanco }}>
              {match.localTeam}
              <span style={{ color: theme.textoSecundario, margin: '0 8px' }}>vs</span>
              {match.visitorTeam}
            </div>
          );

          const inputStyle = isMobile ? mobileInput : input;

          const localField = (
            <div>
              <div style={label}>Local</div>
              <input
                style={inputStyle}
                placeholder="2"
                value={entry.local}
                onChange={(e) => handleInputChange(match, 'local', e.target.value)}
                disabled={entry.status === 'saving'}
              />
            </div>
          );

          const visitorField = (
            <div>
              <div style={label}>Visita</div>
              <input
                style={inputStyle}
                placeholder="1"
                value={entry.visitor}
                onChange={(e) => handleInputChange(match, 'visitor', e.target.value)}
                disabled={entry.status === 'saving'}
              />
            </div>
          );

          const actions = (
            <>
              {entry.dirty && valid && (
                <button
                  onClick={() => handleSave(match, entry)}
                  disabled={entry.status === 'saving'}
                  style={{
                    ...saveBtn,
                    opacity: entry.status === 'saving' ? 0.6 : 1,
                    cursor: entry.status === 'saving' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {entry.status === 'saving' ? 'Guardando...' : 'Guardar'}
                </button>
              )}

              {entry.status === 'saved' && <span style={checkmark}>✓</span>}

              {hasSavedResult && (
                <button
                  onClick={() => handleClear(match)}
                  disabled={entry.status === 'saving'}
                  style={{
                    ...clearBtn,
                    opacity: entry.status === 'saving' ? 0.6 : 1,
                    cursor: entry.status === 'saving' ? 'not-allowed' : 'pointer',
                  }}
                >
                  Limpiar
                </button>
              )}
            </>
          );

          return (
            <div key={match.id}>
              {isMobile ? (
                <div style={matchCardMobile}>
                  <div data-testid="results-teams-row">{teamsLine}</div>
                  <div style={mobileInputsGrid} data-testid="results-inputs-grid">
                    {localField}
                    <div />
                    {visitorField}
                  </div>
                  <div style={mobileActionsRow} data-testid="results-actions">
                    {actions}
                  </div>
                </div>
              ) : (
                <div style={matchCard}>
                  <div style={{ flex: 1, minWidth: 180 }}>{teamsLine}</div>
                  {localField}
                  {visitorField}
                  {actions}
                </div>
              )}

              {entry.dirty && !valid && (
                <div style={validationMsg}>{validationMessage(entry.local, entry.visitor)}</div>
              )}

              {entry.status === 'error' && entry.error && (
                <div style={inlineError}>{entry.error}</div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div style={card}>
      {/* Header: title + date selector */}
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
          <h3 style={{ margin: 0, fontSize: 18, color: theme.blanco }}>
            Resultados — Fecha {activeDate.dateNumber}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: theme.textoSecundario }}>
            Estado: {statusLabels[activeDate.status]}
          </p>
        </div>

        <select
          style={select}
          value={activeDate.id}
          onChange={(e) => {
            setSelectedDateId(Number(e.target.value));
            setUserSelected(true);
          }}
        >
          {selectableDates.map((d) => (
            <option key={d.id} value={d.id}>
              Fecha {d.dateNumber} — {statusLabels[d.status]}
            </option>
          ))}
        </select>
      </div>

      {/* ── OPEN: enter results, then close ─────────────────────────────── */}
      {status === 'open' && (
        <>
          {closeDate.error && (
            <div style={errorBox}>
              Error al cerrar la fecha.{' '}
              {((closeDate.error as any)?.response?.data?.message as string) ?? ''}
            </div>
          )}

          <button
            onClick={() => closeDate.mutate(activeDate.id)}
            disabled={closeDate.isPending}
            style={{ ...actionBtn, opacity: closeDate.isPending ? 0.6 : 1 }}
          >
            {closeDate.isPending
              ? 'Procesando...'
              : 'Procesar y Cerrar Puntos de la Fecha'}
          </button>

          {matchesSection}
        </>
      )}

      {/* ── CLOSED: review/correct results, then publish ─────────────────── */}
      {status === 'closed' && (
        <>
          {matchesSection}

          <div
            style={{
              padding: '14px 16px',
              background: theme.inputBg,
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            <SummaryRow label="Pozo" value={formatMoney(activeDate.pozo)} />
            <SummaryRow
              label="Comisión de la casa"
              value={`${activeDate.commission}%`}
            />
          </div>

          {publishResults.isSuccess && publishResults.variables === activeDate.id && (
            <div style={successBox}>
              Resultados publicados y pozo pagado correctamente.
            </div>
          )}

          {publishResults.error && publishResults.variables === activeDate.id && (
            <div style={errorBox}>
              Error al publicar resultados.{' '}
              {((publishResults.error as any)?.response?.data?.message as string) ?? ''}
            </div>
          )}

          <button
            onClick={handlePublish}
            disabled={
              (publishResults.isPending || publishResults.isSuccess) &&
              publishResults.variables === activeDate.id
            }
            style={{
              ...publishBtn,
              opacity:
                (publishResults.isPending || publishResults.isSuccess) &&
                publishResults.variables === activeDate.id
                  ? 0.6
                  : 1,
            }}
          >
            {publishResults.isPending && publishResults.variables === activeDate.id
              ? 'Publicando...'
              : 'Publicar resultados y pagar'}
          </button>

          <p
            style={{
              marginTop: 10,
              fontSize: 12,
              color: theme.textoSecundario,
              textAlign: 'center',
            }}
          >
            Verificá que todos los resultados estén cargados antes de publicar.
          </p>
        </>
      )}

      {/* ── RESULTS: payout breakdown ───────────────────────────────────── */}
      {status === 'results' && (
        <>
          <div
            style={{
              padding: '14px 16px',
              background: theme.inputBg,
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            <SummaryRow label="Pozo" value={formatMoney(activeDate.pozo)} />
            <SummaryRow
              label="Comisión de la casa"
              value={`${activeDate.commission}%`}
            />
          </div>

          <div style={label}>Ganadores</div>
          {activeDate.winners.length === 0 ? (
            <p style={{ fontSize: 14, color: theme.textoSecundario }}>
              Sin ganadores — el pozo ({formatMoney(activeDate.pozo)}) se acumuló
              para la próxima fecha.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {activeDate.winners.map((w) => (
                <div
                  key={w.ticketId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    background: theme.searchBg,
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                >
                  <span style={{ color: theme.blanco }}>
                    Ticket #{w.ticketId} — {w.username}
                  </span>
                  <span style={{ fontWeight: 700, color: theme.verdeBet }}>
                    {formatMoney(w.prize)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
