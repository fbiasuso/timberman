import type { TicketDTO } from '../../types';
import { formatDate, formatMoney } from '../../utils/format';
import { deriveTicketStatus } from '../../utils/ticket-status';
import { useMatchDates } from '../../hooks/use-matches';
import theme from '../../styles/theme';

interface TicketCardProps {
  ticket: TicketDTO;
  /** Called when the card is clicked to show full detail */
  onSelect: (ticket: TicketDTO) => void;
}

/**
 * TicketCard — preview card for a single ticket.
 *
 * Shows ticket number, date, bet amount, "Estado:" field, and a summary
 * list of predictions (team names come from the server-embedded match).
 * Clicking opens the full ticket modal.
 */
export default function TicketCard({ ticket, onSelect }: TicketCardProps) {
  // Load all match dates to know whether the ticket's date already has
  // published results (a date with status 'results' and no prize = loser)
  const { data: datesData } = useMatchDates();

  const dateStatus = datesData?.dates.find((d) => d.id === ticket.matchDateId)?.status;
  const status = deriveTicketStatus(ticket, dateStatus);

  return (
    <div
      style={{
        padding: 16,
        background: theme.tarjeta,
        borderRadius: 12,
        border: `1px solid ${theme.border}`,
        boxShadow: theme.glow,
        cursor: 'pointer',
        transition: 'box-shadow 0.15s',
      }}
      onClick={() => onSelect(ticket)}
      onMouseOver={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.45)';
      }}
      onMouseOut={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = theme.glow;
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
        <span style={{ fontWeight: 700, fontSize: 14, color: theme.blanco }}>
          Ticket #{ticket.id}
        </span>
        <span style={{ fontSize: 12, color: theme.textoSecundario }}>
          {formatDate(ticket.createdAt)}
        </span>
      </div>

      {/* Estado — derived from prize + date status; winners also show the amount */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: theme.textoSecundario }}>
          Estado:
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 4,
            background: theme.searchBg,
            color: status === 'Pagado' ? theme.verdeBet : theme.textoSecundario,
          }}
        >
          {status}
        </span>
        {ticket.prizeWon != null && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 4,
              background: theme.betV,
              color: theme.verdeBet,
            }}
          >
            Premio ganado: {formatMoney(ticket.prizeWon)}
          </span>
        )}
      </div>

      {/* Predictions summary */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {ticket.predictions.map((tp) => {
          const match = tp.match;
          const label = match ? `${match.localTeam} vs ${match.visitorTeam}` : '';

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
      <div style={{ marginTop: 12, fontSize: 13, color: theme.amarilloBet, textAlign: 'right' }}>
        {formatMoney(ticket.betAmount)}
      </div>
    </div>
  );
}

/**
 * Determine prediction text color based on match result.
 * green = correct, red = wrong, white = pending (no result yet)
 */
function getPredictionColor(
  prediction: string,
  result: string | null,
): string {
  if (!result) return theme.blanco;
  return prediction === result ? theme.verdeBet : theme.rojo;
}
