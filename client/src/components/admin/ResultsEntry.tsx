import { useEffect, useMemo, useState } from 'react';
import { useCurrentMatches } from '../../hooks/use-matches';
import {
  useAdminTournaments,
  useSetMatchResult,
  useCloseDate,
  usePublishResults,
} from '../../hooks/use-admin';
import { formatMoney } from '../../utils/format';
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

const resultOptions = [
  { value: '', label: 'PENDIENTE' },
  { value: 'L', label: 'L — Local' },
  { value: 'E', label: 'E — Empate' },
  { value: 'V', label: 'V — Visita' },
];

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
  const { data: currentData, isLoading: matchesLoading, error: matchesError } = useCurrentMatches();
  const { data: tournaments, isLoading: tournamentsLoading, error: tournamentsError } =
    useAdminTournaments();
  const setResult = useSetMatchResult();
  const closeDate = useCloseDate();
  const publishResults = usePublishResults();

  // Track per-match pending saves
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  // Manual date selection (null = follow the current date)
  const [selectedDateId, setSelectedDateId] = useState<number | null>(null);
  // Auto-follow the open date until the admin makes a manual selection.
  const [userSelected, setUserSelected] = useState(false);

  // Default selection: the open date when it exists (it carries the matches),
  // otherwise the most recent date so the admin can publish or review it.
  const openDateId = currentData?.matchDate?.id ?? null;

  // All dates across tournaments, newest first. Matches only exist for the
  // current open date (GET /matches/current), so any OTHER open date would
  // render the wrong match cards (and saving would patch the wrong date's
  // matches) — keep the current open date plus all non-open dates, which
  // render financials only, no matches.
  const selectableDates = useMemo(() => {
    const all = (tournaments?.flatMap((t) => t.dates) ?? []).sort((a, b) => b.id - a.id);
    return all.filter((d) => d.id === openDateId || d.status !== 'open');
  }, [tournaments, openDateId]);

  const defaultDate: TournamentDateDTO | null = openDateId
    ? selectableDates.find((d) => d.id === openDateId) ?? null
    : selectableDates[0] ?? null;

  const activeDate = selectableDates.find((d) => d.id === selectedDateId) ?? defaultDate;

  // Follow the open date automatically until the admin picks a date manually —
  // otherwise a late-resolving /matches/current query would reset an admin's
  // manual selection.
  useEffect(() => {
    if (!userSelected) {
      setSelectedDateId(null);
    }
  }, [openDateId, userSelected]);

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

  const status = activeDate.status;
  const matches = currentData?.matches ?? [];

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
            Estado: {statusLabels[status]}
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
            {matches.map((match) => (
              <div key={match.id} style={matchCard}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: theme.blanco }}>
                    {match.localTeam}
                    <span style={{ color: theme.textoSecundario, margin: '0 8px' }}>vs</span>
                    {match.visitorTeam}
                  </div>
                </div>

                <div>
                  <div style={label}>Resultado</div>
                  <select
                    style={select}
                    defaultValue={match.result ?? ''}
                    onChange={(e) => {
                      handleSaveResult(match, e.target.value, match.score ?? '');
                    }}
                  >
                    {resultOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

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

                <button
                  onClick={() => handleSaveResult(match, match.result ?? '', match.score ?? '')}
                  disabled={saving[match.id]}
                  style={{
                    ...saveBtn,
                    opacity: saving[match.id] ? 0.6 : 1,
                    cursor: saving[match.id] ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving[match.id] ? 'Guardando...' : 'Guardar'}
                </button>

                {setResult.isSuccess && setResult.variables?.matchId === match.id && (
                  <span style={{ color: theme.verdeBet, fontSize: 12 }}>✓</span>
                )}
                {setResult.isError && setResult.variables?.matchId === match.id && (
                  <span style={{ color: theme.rojo, fontSize: 12 }}>✗</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── CLOSED: financial snapshot + publish ────────────────────────── */}
      {status === 'closed' && (
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

          {publishResults.isSuccess && (
            <div style={successBox}>
              Resultados publicados y pozo pagado correctamente.
            </div>
          )}

          {publishResults.error && (
            <div style={errorBox}>
              Error al publicar resultados.{' '}
              {((publishResults.error as any)?.response?.data?.message as string) ?? ''}
            </div>
          )}

          <button
            onClick={handlePublish}
            disabled={publishResults.isPending || publishResults.isSuccess}
            style={{
              ...publishBtn,
              opacity: publishResults.isPending || publishResults.isSuccess ? 0.6 : 1,
            }}
          >
            {publishResults.isPending
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
