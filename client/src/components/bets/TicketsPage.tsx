import { useState } from 'react';
import { useBets } from '../../hooks/use-bets';
import { useMatchDates } from '../../hooks/use-matches';
import TicketCard from './TicketCard';
import TicketModal from './TicketModal';
import type { TicketDTO } from '../../types';

/**
 * TicketsPage — list of the authenticated user's tickets with date filter.
 *
 * Clicking a ticket opens the full detail modal.
 */
export default function TicketsPage() {
  const [selectedDateId, setSelectedDateId] = useState<number | undefined>(undefined);
  const [modalTicket, setModalTicket] = useState<TicketDTO | null>(null);

  const { data: datesData } = useMatchDates();
  const { data: betsData, isLoading, error } = useBets(selectedDateId);

  // Sort dates for dropdown (newest first)
  const sortedDates = datesData?.dates
    ? [...datesData.dates].sort((a, b) => b.dateNumber - a.dateNumber)
    : [];

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: 22, color: '#1e293b' }}>
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
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 15,
            background: '#fff',
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
        <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>
          Cargando tickets...
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ textAlign: 'center', padding: 48, color: '#dc2626' }}>
          Error al cargar los tickets.
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && betsData?.tickets.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>
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
