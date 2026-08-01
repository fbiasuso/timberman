import { useMemo, useState } from 'react';
import { useCurrentMatches } from '../../hooks/use-matches';
import { usePlaceBet } from '../../hooks/use-bets';
import { useBetSlipStore } from '../../stores/bet-slip-store';
import Filters from './Filters';
import MatchCard from './MatchCard';
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
  const reset = useBetSlipStore((s) => s.reset);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('todos');
  const [showConfirm, setShowConfirm] = useState(false);
  const [ticketModal, setTicketModal] = useState<TicketDTO | null>(null);

  // Derived data — must run before any early return to respect the Rules of Hooks
  const matches = data?.matches ?? [];

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
      <div style={{ textAlign: 'center', padding: 48, color: theme.textoSecundario }}>
        <h2 style={{ color: theme.blanco }}>No hay cartelera disponible</h2>
        <p style={{ fontSize: 14, marginTop: 8 }}>
          Espera a que el administrador publique una nueva fecha.
        </p>
      </div>
    );
  }

  const { matchDate } = data;
  const matchDateId = matchDate.id;
  const isExpired = matchDate.status !== 'open';

  // Accumulated prize pool: only the carryover rolled over from previous
  // dates without winners. The server snapshots a date's pozo at close, so
  // the open date's wagers are NOT included in this banner.
  const carryover = data.carryover ?? 0;

  const totalMatches = matches.length;
  const predictedCount = Object.keys(predictions).length;
  const allPredicted = totalMatches > 0 && predictedCount === totalMatches;

  // Handle confirm and place bet
  const handleConfirm = () => {
    placeBet.mutate(
      {
        matchDateId,
        predictions: Object.fromEntries(
          Object.entries(predictions).map(([id, pred]) => [id, pred]),
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
          <MatchCard key={match.id} match={match} isExpired={isExpired} />
        ))}
      </div>

      {/* Pay button (only when date is open) */}
      {!isExpired && !showConfirm && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
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
    </div>
  );
}
