import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBets } from '../../hooks/use-bets';
import { useMatchDates } from '../../hooks/use-matches';
import TicketCard from './TicketCard';
import TicketModal from './TicketModal';
import type { TicketDTO } from '../../types';
import theme from '../../styles/theme';

/**
 * TicketsPage — list of the authenticated user's tickets with date filter.
 *
 * Clicking a ticket opens the full detail modal. The optional ?matchDateId=
 * query param preselects the date filter (used by the Cartelera's "ver
 * ticket" link for an already-played date).
 */
export default function TicketsPage() {
  const [searchParams] = useSearchParams();

  // Initial date filter from the URL (?matchDateId=), otherwise all dates.
  const initialDateId = (() => {
    const raw = searchParams.get('matchDateId');
    if (!raw) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  })();

  const [selectedDateId, setSelectedDateId] = useState<number | undefined>(initialDateId);
  const [modalTicket, setModalTicket] = useState<TicketDTO | null>(null);

  const { data: datesData } = useMatchDates();
  const { data: betsData, isLoading, error } = useBets(selectedDateId);

  // Sort dates for dropdown (newest first)
  const sortedDates = datesData?.dates
    ? [...datesData.dates].sort((a, b) => b.dateNumber - a.dateNumber)
    : [];

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: 22, color: theme.blanco }}>
        Mis Tickets
      </h2>

      {/* Date filter dropdown */}
      <div style={{ marginBottom: 20 }}>
        <select
          value={selectedDateId ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedDateId(val ? Number(val) : undefined);
          }}
          style={{
            width: '100%',
            padding: '10px 14px',
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            fontSize: 15,
            background: theme.tarjeta,
            color: theme.blanco,
            outline: 'none',
          }}
        >
          <option value="">Todas las fechas</option>
          {sortedDates.map((md) => (
            <option key={md.id} value={md.id}>
              Fecha {md.dateNumber} — {md.status === 'open' ? 'Abierta' : md.status === 'closed' ? 'Cerrada' : 'Resultados'}
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 48, color: theme.textoSecundario }}>
          Cargando tickets...
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ textAlign: 'center', padding: 48, color: theme.rojo }}>
          Error al cargar los tickets.
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && betsData?.tickets.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: theme.textoSecundario }}>
          <p style={{ fontSize: 16, margin: 0 }}>No tenés tickets todavía.</p>
          <p style={{ fontSize: 14, margin: '8px 0 0' }}>
            Andá a la cartelera para hacer tu primera jugada.
          </p>
        </div>
      )}

      {/* Ticket list */}
      {!isLoading && betsData && betsData.tickets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {betsData.tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onSelect={setModalTicket}
            />
          ))}
        </div>
      )}

      {/* Ticket detail modal */}
      {modalTicket && (
        <TicketModal
          ticket={modalTicket}
          onClose={() => setModalTicket(null)}
        />
      )}
    </div>
  );
}
