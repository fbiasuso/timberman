import { useMemo } from 'react';
import type { TicketDTO } from '../../types';
import { formatDate, formatMoney } from '../../utils/format';
import { useCurrentMatches } from '../../hooks/use-matches';

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
          background: '#fff',
          borderRadius: 16,
          padding: 24,
          position: 'relative',
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
            background: '#f3f4f6',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280',
          }}
          aria-label="Cerrar"
        >
          ✕
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#1e293b' }}>
            Ticket #{ticket.id}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            {formatDate(ticket.createdAt)}
          </p>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px dashed #d1d5db', marginBottom: 16 }} />

        {/* Predictions */}
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#374151' }}>
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
                  ? '#16a34a'
                  : '#dc2626'
                : '#374151';

              return (
                <div
                  key={tp.matchId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: '#f9fafb',
                    borderRadius: 8,
                  }}
                >
                  <span style={{ fontSize: 14, color: '#374151' }}>{label}</span>
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
        <div style={{ borderTop: '1px dashed #d1d5db', marginBottom: 16 }} />

        {/* Summary */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 14,
              color: '#6b7280',
              marginBottom: 4,
            }}
          >
            <span>Monto apostado</span>
            <span style={{ fontWeight: 600, color: '#1e293b' }}>
              {formatMoney(ticket.betAmount)}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 14,
              color: '#6b7280',
              marginBottom: 4,
            }}
          >
            <span>Aciertos</span>
            <span
              style={{
                fontWeight: 600,
                color: correctCount > 0 ? '#16a34a' : '#6b7280',
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
              border: '1px solid #2563eb',
              borderRadius: 8,
              background: '#fff',
              color: '#2563eb',
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
              background: '#2563eb',
              color: '#fff',
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
