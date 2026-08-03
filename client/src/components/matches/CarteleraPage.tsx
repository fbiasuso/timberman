import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentMatches } from '../../hooks/use-matches';
import { usePlaceBet, useBets } from '../../hooks/use-bets';
import { useBetSlipStore } from '../../stores/bet-slip-store';
import Filters from './Filters';
import MatchCard from './MatchCard';
import HistorySection from './HistorySection';
import TicketModal from '../bets/TicketModal';
import { formatMoney } from '../../utils/format';
import type { FilterValue } from './Filters';
import type { TicketDTO } from '../../types';
import theme from '../../styles/theme';

/**
 * CarteleraPage — main betting page.
 *
 * Shows filters, current matches with bet buttons, a submit button
 * with prediction count, and a confirmation / success flow.
 */
export default function CarteleraPage() {
  const { data, isLoading, error } = useCurrentMatches();
  const placeBet = usePlaceBet();
  const predictions = useBetSlipStore((s) => s.predictions);
  const removePrediction = useBetSlipStore((s) => s.removePrediction);
  const reset = useBetSlipStore((s) => s.reset);
  const navigate = useNavigate();

  // The user's tickets for the active date: a ticket on the open date means
  // they already played this round (no new bet allowed, show their ticket).
  const betsQuery = useBets(data?.matchDate?.id);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('todos');
  const [showConfirm, setShowConfirm] = useState(false);
  const [ticketModal, setTicketModal] = useState<TicketDTO | null>(null);

  // Derived data — must run before any early return to respect the Rules of Hooks
  const matches = data?.matches ?? [];

  // Clean stale predictions from previous dates out of the persisted bet-slip
  // store. The store is global and survives between dates, so a match id that
  // is not part of the current date is orphaned and must be dropped — otherwise
  // the counter shows impossible ratios like 4/3 and the pay button stays
  // disabled forever. The effect keyed on the match ids runs whenever the
  // active date (or its match list) changes.
  const activeMatchIds = useMemo(() => {
    return new Set(matches.map((m) => m.id.toString()));
  }, [matches]);

  useEffect(() => {
    // Only clean when we have an authoritative match list for an active date.
    // During loading/error/no-date renders `matches` is [] and an empty
    // activeMatchIds would wipe every persisted prediction on refresh.
    if (!data?.matchDate) return;
    for (const matchId of Object.keys(predictions)) {
      if (!activeMatchIds.has(matchId)) {
        removePrediction(matchId);
      }
    }
  }, [activeMatchIds, predictions, removePrediction, data]);

  // Filtered matches
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        if (
          !m.localTeam.toLowerCase().includes(q) &&
          !m.visitorTeam.toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      // Status filter
      if (filter === 'pendientes' && predictions[m.id.toString()]) return false;
      if (filter === 'cerrados' && !predictions[m.id.toString()]) return false;

      return true;
    });
  }, [matches, search, filter, predictions]);

  // Loading state
  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: theme.textoSecundario }}>
        Cargando cartelera...
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: theme.rojo }}>
        Error al cargar la cartelera. Intenta de nuevo.
      </div>
    );
  }

  // No open date
  if (!data?.matchDate) {
    return (
      <div>
        <div style={{ textAlign: 'center', padding: 48, color: theme.textoSecundario }}>
          <h2 style={{ color: theme.blanco }}>No hay cartelera disponible</h2>
          <p style={{ fontSize: 14, marginTop: 8 }}>
            Espera a que el administrador publique una nueva fecha.
          </p>
        </div>
        {/* Past dates still browsable when no active date exists */}
        <HistorySection />
      </div>
    );
  }

  const { matchDate } = data;
  const matchDateId = matchDate.id;
  const isExpired = matchDate.status !== 'open';

  // The user already placed a bet on this date → they cannot pick a new one,
  // only view their ticket. While the ticket query is still loading we do not
  // know yet whether they played, so betting must stay locked; if it fails we
  // cannot confirm the no-bet case either, so the pay flow stays hidden. The
  // last clause also covers the offline/paused fetch (data undefined, no error
  // yet), so the pay flow never renders with an unknown ticket status.
  const betsChecking =
    betsQuery.isLoading ||
    (betsQuery.isFetching && !betsQuery.data) ||
    (betsQuery.data === undefined && !betsQuery.isError);
  const betsFailed = betsQuery.isError;
  const alreadyBet = !betsFailed && (betsQuery.data?.tickets.length ?? 0) > 0;

  // Accumulated prize pool: only the carryover rolled over from previous
  // dates without winners. The server snapshots a date's pozo at close, so
  // the open date's wagers are NOT included in this banner.
  const carryover = data.carryover ?? 0;

  const totalMatches = matches.length;
  const predictedCount = Object.keys(predictions).filter((id) => activeMatchIds.has(id)).length;
  const allPredicted = totalMatches > 0 && predictedCount === totalMatches;

  // Handle confirm and place bet
  const handleConfirm = () => {
    placeBet.mutate(
      {
        matchDateId,
        // Only send predictions for matches of the active date; the persisted
        // store may still hold orphaned ids from a previous date until the
        // cleanup effect runs.
        predictions: Object.fromEntries(
          Object.entries(predictions).filter(([id]) => activeMatchIds.has(id)),
        ) as Record<string, 'L' | 'E' | 'V'>,
      },
      {
        onSuccess: ({ ticket }) => {
          setShowConfirm(false);
          setTicketModal(ticket);
        },
      },
    );
  };

  const handleTicketModalClose = () => {
    setTicketModal(null);
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, color: theme.blanco }}>
          Cartelera — Fecha {matchDate.dateNumber}
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: theme.textoSecundario }}>
          {matchDate.status === 'open'
            ? 'Seleccioná tus pronósticos'
            : `Estado: ${matchDate.status}`}
        </p>
      </div>

      {/* Accumulated pozo — carryover from previous dates without winners.
          The open date's wagers are not included: pozo is snapshotted at close. */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          background: theme.tarjeta,
          borderRadius: 12,
          border: `1px solid ${theme.border}`,
          marginBottom: 20,
        }}
      >
        <span style={{ fontSize: 13, color: theme.textoSecundario }}>
          Pozo acumulado de fechas anteriores
        </span>
        <span style={{ fontWeight: 700, fontSize: 16, color: theme.amarilloBet }}>
          {formatMoney(carryover)}
        </span>
      </div>

      {!isExpired && (
        <p
          style={{
            margin: '-12px 0 20px',
            fontSize: 12,
            color: theme.textoSecundario,
          }}
        >
          No incluye las jugadas de esta fecha: el pozo se calcula al cerrar los puntos.
        </p>
      )}

      {!isExpired && (
        <Filters onChange={(s, f) => { setSearch(s); setFilter(f); }} />
      )}

      {/* Match list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredMatches.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: theme.textoSecundario, fontSize: 14 }}>
            No hay partidos que coincidan con los filtros.
          </div>
        )}
        {filteredMatches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            isExpired={isExpired}
            lockBetting={alreadyBet || betsChecking || betsFailed}
          />
        ))}
      </div>

      {/* Bet / ticket button (only when date is open) */}
      {!isExpired && !showConfirm && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          {betsChecking ? (
            <button
              disabled
              style={{
                width: '100%',
                maxWidth: 400,
                padding: '14px 0',
                border: 'none',
                borderRadius: 10,
                background: theme.disabled,
                color: theme.textoSecundario,
                fontSize: 16,
                fontWeight: 700,
                cursor: 'not-allowed',
                transition: 'all 0.15s',
              }}
            >
              Verificando tu jugada...
            </button>
          ) : betsFailed ? (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                disabled
                style={{
                  flex: 1,
                  maxWidth: 400,
                  padding: '14px 0',
                  border: 'none',
                  borderRadius: 10,
                  background: theme.disabled,
                  color: theme.textoSecundario,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: 'not-allowed',
                  transition: 'all 0.15s',
                }}
              >
                No se pudo verificar tu jugada
              </button>
              <button
                onClick={() => betsQuery.refetch()}
                style={{
                  padding: '0 24px',
                  border: `1px solid ${theme.border}`,
                  borderRadius: 10,
                  background: theme.tarjeta,
                  color: theme.blanco,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Reintentar
              </button>
            </div>
          ) : alreadyBet ? (
            <button
              onClick={() => navigate(`/tickets?matchDateId=${matchDateId}`)}
              style={{
                width: '100%',
                maxWidth: 400,
                padding: '14px 0',
                border: 'none',
                borderRadius: 10,
                background: theme.verdeBet,
                color: theme.blanco,
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              ya hiciste tu jugada - ver ticket
            </button>
          ) : (
            <button
              onClick={() => {
                if (!allPredicted) return;
                setShowConfirm(true);
              }}
              disabled={!allPredicted}
              style={{
                width: '100%',
                maxWidth: 400,
                padding: '14px 0',
                border: 'none',
                borderRadius: 10,
                background: allPredicted ? theme.verdeBet : theme.disabled,
                color: allPredicted ? theme.blanco : theme.textoSecundario,
                fontSize: 16,
                fontWeight: 700,
                cursor: allPredicted ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
              }}
            >
              Pagar Jugada ({predictedCount}/{totalMatches}) — {formatMoney(matchDate.betAmount)}
            </button>
          )}
        </div>
      )}

      {/* Confirmation dialog */}
      {showConfirm && (
        <div
          style={{
            marginTop: 24,
            padding: 20,
            background: theme.tarjeta,
            borderRadius: 12,
            border: `1px solid ${theme.border}`,
            boxShadow: theme.glow,
          }}
        >
          <h3 style={{ margin: '0 0 12px', fontSize: 16, color: theme.blanco }}>
            Confirmar jugada
          </h3>
          <p style={{ fontSize: 14, color: theme.textoSecundario, margin: '0 0 4px' }}>
            Fecha: {matchDate.dateNumber} — Monto: {formatMoney(matchDate.betAmount)}
          </p>
          <p style={{ fontSize: 14, color: theme.textoSecundario, margin: '0 0 16px' }}>
            {totalMatches} partidos seleccionados
          </p>

          {/* Summary of predictions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {matches.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  padding: '4px 8px',
                  background: theme.searchBg,
                  borderRadius: 6,
                }}
              >
                <span>
                  {m.localTeam} vs {m.visitorTeam}
                </span>
                <span style={{ fontWeight: 700 }}>
                  {predictions[m.id.toString()] ?? '—'}
                </span>
              </div>
            ))}
          </div>

          {placeBet.error && (
            <div
              style={{
                color: theme.rojo,
                fontSize: 14,
                marginBottom: 12,
                padding: '8px 12px',
                background: theme.dangerBg,
                borderRadius: 6,
              }}
            >
              {(placeBet.error as any)?.response?.data?.message ??
                'Error al realizar la jugada. Intenta de nuevo.'}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => {
                setShowConfirm(false);
                placeBet.reset();
              }}
              disabled={placeBet.isPending}
              style={{
                flex: 1,
                padding: '10px 0',
                border: `1px solid ${theme.border}`,
                borderRadius: 8,
                background: theme.tarjeta,
                color: theme.blanco,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={placeBet.isPending}
              style={{
                flex: 1,
                padding: '10px 0',
                border: 'none',
                borderRadius: 8,
                background: placeBet.isPending ? theme.disabled : theme.verdeBet,
                color: theme.blanco,
                fontSize: 14,
                fontWeight: 600,
                cursor: placeBet.isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {placeBet.isPending ? 'Procesando...' : 'Confirmar y pagar'}
            </button>
          </div>
        </div>
      )}

      {/* Success ticket modal */}
      {ticketModal && (
        <TicketModal ticket={ticketModal} onClose={handleTicketModalClose} />
      )}

      {/* Past dates history — below the active date content */}
      <HistorySection />
    </div>
  );
}
