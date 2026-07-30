import { useMemo } from 'react';
import type { TicketDTO } from '../../types';
import { formatDate, formatMoney } from '../../utils/format';
import { useCurrentMatches } from '../../hooks/use-matches';

interface TicketCardProps {
  ticket: TicketDTO;
  /** Called when the card is clicked to show full detail */
  onSelect: (ticket: TicketDTO) => void;
}

/**
 * TicketCard — preview card for a single ticket.
 *
 * Shows ticket number, date, bet amount, status badge, and a
 * summary list of predictions. Clicking opens the full ticket modal.
 */
export default function TicketCard({ ticket, onSelect }: TicketCardProps) {
  // Load current match data to enrich predictions with team names
  const { data: currentData } = useCurrentMatches();

  // Build a lookup map of matchId → match info (team names + results)
  const matchMap = useMemo(() => {
    const map = new Map<number, { local: string; visitor: string; result: string | null }>();
    if (currentData?.matches) {
      for (const m of currentData.matches) {
        map.set(m.id, { local: m.localTeam, visitor: m.visitorTeam, result: m.result });
      }
    }
    return map;
  }, [currentData]);

  return (
    <div
      style={{
        padding: 16,
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s',
      }}
      onClick={() => onSelect(ticket)}
      onMouseOver={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      }}
      onMouseOut={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      {/* Header: ticket ID + date */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
          Ticket #{ticket.id}
        </span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {formatDate(ticket.createdAt)}
        </span>
      </div>

      {/* Status badge */}
      <div style={{ marginBottom: 12 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 4,
            background: '#f3f4f6',
            color: '#6b7280',
          }}
        >
          Pendiente
        </span>
      </div>

      {/* Predictions summary */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {ticket.predictions.map((tp) => {
          const match = matchMap.get(tp.matchId);
          const label = match
            ? `${match.local} vs ${match.visitor}`
            : `Partido #${tp.matchId}`;

          const color = getPredictionColor(tp.prediction, match?.result ?? null);

          return (
            <div
              key={tp.matchId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
                color,
                padding: '2px 0',
              }}
            >
              <span>{label}</span>
              <span style={{ fontWeight: 700 }}>{tp.prediction}</span>
            </div>
          );
        })}
      </div>

      {/* Bet amount */}
      <div style={{ marginTop: 12, fontSize: 13, color: '#6b7280', textAlign: 'right' }}>
        {formatMoney(ticket.betAmount)}
      </div>
    </div>
  );
}

/**
 * Determine prediction text color based on match result.
 * green = correct, red = wrong, dark = pending (no result yet)
 */
function getPredictionColor(
  prediction: string,
  result: string | null,
): string {
  if (!result) return '#374151';
  return prediction === result ? '#16a34a' : '#dc2626';
}
