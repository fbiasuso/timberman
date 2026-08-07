import type { MatchDTO } from '../../types';
import { formatDate } from '../../utils/format';
import BetButtons from './BetButtons';
import { useBetSlipStore } from '../../stores/bet-slip-store';
import { useIsMobile } from '../../hooks/use-is-mobile';
import theme from '../../styles/theme';

interface MatchCardProps {
  match: MatchDTO;
  /** Whether the match date is expired (closed or results published) */
  isExpired: boolean;
  /** Lock bet picking without the expired visuals (user already bet this date) */
  lockBetting?: boolean;
}

/**
 * Displays a single match card with team info, score/VS, bet buttons,
 * and an expired badge if the match date is past.
 */
export default function MatchCard({ match, isExpired, lockBetting = false }: MatchCardProps) {
  const currentPrediction = useBetSlipStore(
    (s) => s.predictions[match.id.toString()] ?? null,
  );
  const isMobile = useIsMobile();

  const homeTeam = (
    <div style={{ flex: 1, textAlign: 'center' }}>
      {match.localImg && (
        <img
          src={match.localImg}
          alt={match.localTeam}
          style={{ width: 40, height: 40, objectFit: 'contain', marginBottom: 4 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div style={{ fontWeight: 600, fontSize: 14, color: theme.blanco }}>
        {match.localTeam}
      </div>
    </div>
  );

  const center = (
    <div style={{ minWidth: 60, textAlign: 'center' }}>
      {match.score ? (
        <div style={{ fontWeight: 700, fontSize: 20, color: theme.blanco }}>
          {match.score}
        </div>
      ) : (
        <div style={{ fontWeight: 700, fontSize: 14, color: theme.vsText }}>VS</div>
      )}
    </div>
  );

  const awayTeam = (
    <div style={{ flex: 1, textAlign: 'center' }}>
      {match.visitorImg && (
        <img
          src={match.visitorImg}
          alt={match.visitorTeam}
          style={{ width: 40, height: 40, objectFit: 'contain', marginBottom: 4 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div style={{ fontWeight: 600, fontSize: 14, color: theme.blanco }}>
        {match.visitorTeam}
      </div>
    </div>
  );

  return (
    <div
      data-testid="match-card"
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? 12 : 16,
        padding: '16px 20px',
        background: theme.tarjeta,
        borderRadius: 12,
        border: `1px solid ${theme.border}`,
        boxShadow: theme.glow,
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
            color: theme.rojo,
            background: theme.dangerBg,
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
            color: theme.textoSecundario,
            background: theme.searchBg,
            padding: '2px 8px',
            borderRadius: 4,
          }}
        >
          {formatDate(match.scheduledAt)}
        </div>
      )}

      {/* On mobile the teams and the buttons live in separate full-width rows
          that share the same 3-column template, so L/E/V center under their
          team/VS column. On desktop the current single flex row is preserved. */}
      {isMobile ? (
        <div
          data-testid="teams-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 60px 1fr',
            alignItems: 'center',
            gap: 16,
            width: '100%',
          }}
        >
          {homeTeam}
          {center}
          {awayTeam}
        </div>
      ) : (
        <>
          {homeTeam}
          {center}
          {awayTeam}
        </>
      )}

      {/* Bet buttons */}
      <BetButtons
        matchId={match.id.toString()}
        disabled={isExpired || lockBetting}
        currentPrediction={currentPrediction}
        layout={isMobile ? 'grid' : 'row'}
      />
    </div>
  );
}
