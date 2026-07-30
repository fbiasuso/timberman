import type { MatchDTO } from '../../types';
import { formatDate } from '../../utils/format';
import BetButtons from './BetButtons';
import { useBetSlipStore } from '../../stores/bet-slip-store';

interface MatchCardProps {
  match: MatchDTO;
  /** Whether the match date is expired (closed or results published) */
  isExpired: boolean;
}

/**
 * Displays a single match card with team info, score/VS, bet buttons,
 * and an expired badge if the match date is past.
 */
export default function MatchCard({ match, isExpired }: MatchCardProps) {
  const currentPrediction = useBetSlipStore(
    (s) => s.predictions[match.id.toString()] ?? null,
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '16px 20px',
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        opacity: isExpired ? 0.65 : 1,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Expired badge */}
      {isExpired && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            fontSize: 11,
            fontWeight: 600,
            color: '#dc2626',
            background: '#fee2e2',
            padding: '2px 8px',
            borderRadius: 4,
          }}
        >
          🔒 Cerrado
        </div>
      )}

      {/* Scheduled date/time badge */}
      {match.scheduledAt && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            fontSize: 11,
            color: '#6b7280',
            background: '#f3f4f6',
            padding: '2px 8px',
            borderRadius: 4,
          }}
        >
          {formatDate(match.scheduledAt)}
        </div>
      )}

      {/* Home team */}
      <div style={{ flex: 1, textAlign: 'center' }}>
        {match.localImg && (
          <img
            src={match.localImg}
            alt={match.localTeam}
            style={{ width: 40, height: 40, objectFit: 'contain', marginBottom: 4 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
          {match.localTeam}
        </div>
      </div>

      {/* Score or VS */}
      <div style={{ minWidth: 60, textAlign: 'center' }}>
        {match.score ? (
          <div style={{ fontWeight: 700, fontSize: 20, color: '#1e293b' }}>
            {match.score}
          </div>
        ) : (
          <div style={{ fontWeight: 700, fontSize: 14, color: '#9ca3af' }}>VS</div>
        )}
      </div>

      {/* Away team */}
      <div style={{ flex: 1, textAlign: 'center' }}>
        {match.visitorImg && (
          <img
            src={match.visitorImg}
            alt={match.visitorTeam}
            style={{ width: 40, height: 40, objectFit: 'contain', marginBottom: 4 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
          {match.visitorTeam}
        </div>
      </div>

      {/* Bet buttons */}
      <BetButtons
        matchId={match.id.toString()}
        disabled={isExpired}
        currentPrediction={currentPrediction}
      />
    </div>
  );
}
