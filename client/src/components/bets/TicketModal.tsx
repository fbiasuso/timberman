import { useMemo } from 'react';
import type { TicketDTO } from '../../types';
import { formatDate, formatMoney } from '../../utils/format';
import { useCurrentMatches } from '../../hooks/use-matches';
import theme from '../../styles/theme';

interface TicketModalProps {
  ticket: TicketDTO;
  onClose: () => void;
}

/**
 * TicketModal — full ticket detail in receipt style with PDF download placeholder.
 */
export default function TicketModal({ ticket, onClose }: TicketModalProps) {
  const { data: currentData } = useCurrentMatches();

  const matchMap = useMemo(() => {
    const map = new Map<number, { local: string; visitor: string; result: string | null }>();
    if (currentData?.matches) {
      for (const m of currentData.matches) {
        map.set(m.id, { local: m.localTeam, visitor: m.visitorTeam, result: m.result });
      }
    }
    return map;
  }, [currentData]);

  const correctCount = ticket.predictions.filter((tp) => {
    const match = matchMap.get(tp.matchId);
    return match?.result != null && tp.prediction === match.result;
  }).length;

  // Backdrop click to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={handleBackdropClick}
    >
      {/* Receipt card */}
      <div
        style={{
          maxWidth: 420,
          width: '100%',
          background: theme.tarjeta,
          borderRadius: 16,
          padding: 24,
          position: 'relative',
          border: `1px solid ${theme.border}`,
          boxShadow: theme.glow,
        }}
      >
        {/* Close button (top-right) */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            border: 'none',
            borderRadius: '50%',
            background: theme.searchBg,
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.textoSecundario,
          }}
          aria-label="Cerrar"
        >
          ✕
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: theme.blanco }}>
            Ticket #{ticket.id}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: theme.textoSecundario }}>
            {formatDate(ticket.createdAt)}
          </p>
        </div>

        {/* Divider */}
        <div style={{ borderTop: `1px dashed ${theme.border}`, marginBottom: 16 }} />

        {/* Predictions */}
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, color: theme.textoSecundario }}>
            Pronósticos
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ticket.predictions.map((tp) => {
              const match = matchMap.get(tp.matchId);
              const label = match
                ? `${match.local} vs ${match.visitor}`
                : `Partido #${tp.matchId}`;
              const color = match?.result
                ? tp.prediction === match.result
                  ? theme.verdeBet
                  : theme.rojo
                : theme.blanco;

              return (
                <div
                  key={tp.matchId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: theme.searchBg,
                    borderRadius: 8,
                  }}
                >
                  <span style={{ fontSize: 14, color: theme.blanco }}>{label}</span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 16,
                      color,
                      minWidth: 32,
                      textAlign: 'center',
                    }}
                  >
                    {tp.prediction}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: `1px dashed ${theme.border}`, marginBottom: 16 }} />

        {/* Summary */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 14,
              color: theme.textoSecundario,
              marginBottom: 4,
            }}
          >
            <span>Monto apostado</span>
            <span style={{ fontWeight: 600, color: theme.blanco }}>
              {formatMoney(ticket.betAmount)}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 14,
              color: theme.textoSecundario,
              marginBottom: 4,
            }}
          >
            <span>Aciertos</span>
            <span
              style={{
                fontWeight: 600,
                color: correctCount > 0 ? theme.verdeBet : theme.textoSecundario,
              }}
            >
              {correctCount}/{ticket.predictions.length}
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => alert('Descarga de PDF — próximamente')}
            style={{
              width: '100%',
              padding: '12px 0',
              border: `1px solid ${theme.border}`,
              borderRadius: 8,
              background: theme.tarjeta,
              color: theme.blanco,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Descargar PDF
          </button>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '12px 0',
              border: 'none',
              borderRadius: 8,
              background: theme.verdeBet,
              color: theme.blanco,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
