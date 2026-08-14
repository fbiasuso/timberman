import { useState } from 'react';
import {
  useAdminTournaments,
  useTerminateTournament,
  useArchiveTournament,
} from '../../hooks/use-admin';
import theme from '../../styles/theme';

// ─── Status labels (Spanish UI) ─────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  active: 'Activo',
  finished: 'Finalizado',
  archived: 'Archivado',
};

const STATUS_COLOR: Record<string, string> = {
  active: theme.verdeBet,
  finished: theme.amarilloBet,
  archived: theme.textoSecundario,
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: theme.tarjeta,
  borderRadius: 12,
  padding: 24,
  border: `1px solid ${theme.border}`,
  boxShadow: theme.glow,
};

const btnPrimary: React.CSSProperties = {
  padding: '6px 14px',
  border: 'none',
  borderRadius: 8,
  background: theme.verdeBet,
  color: theme.blanco,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnDanger: React.CSSProperties = {
  padding: '6px 14px',
  border: 'none',
  borderRadius: 8,
  background: theme.rojo,
  color: theme.blanco,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnOutline: React.CSSProperties = {
  padding: '6px 14px',
  border: `1px solid ${theme.border}`,
  borderRadius: 8,
  background: 'transparent',
  color: theme.blanco,
  fontSize: 12,
  cursor: 'pointer',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  background: theme.headerBg,
  color: theme.amarilloBet,
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'middle',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function TournamentManager() {
  const { data: tournaments, isLoading, error } = useAdminTournaments();
  const terminate = useTerminateTournament();
  const archive = useArchiveTournament();

  // Confirm actions per tournament id
  const [confirmAction, setConfirmAction] = useState<{
    id: number;
    action: 'terminate' | 'archive';
  } | null>(null);

  const handleConfirm = () => {
    if (!confirmAction) return;
    const { id, action } = confirmAction;
    if (action === 'terminate') {
      terminate.mutate(id, { onSuccess: () => setConfirmAction(null) });
    } else {
      archive.mutate(id, { onSuccess: () => setConfirmAction(null) });
    }
  };

  if (isLoading) {
    return (
      <div style={card}>
        <p style={{ color: theme.textoSecundario, textAlign: 'center' }}>
          Cargando torneos...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={card}>
        <p style={{ color: theme.rojo, textAlign: 'center' }}>
          Error al cargar torneos.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={card}>
        <h4 style={{ margin: '0 0 16px', fontSize: 16, color: theme.blanco }}>
          Torneos ({tournaments?.length ?? 0})
        </h4>

        {(!tournaments || tournaments.length === 0) && (
          <p style={{ color: theme.textoSecundario, fontSize: 14, textAlign: 'center' }}>
            No hay torneos registrados.
          </p>
        )}

        {tournaments && tournaments.length > 0 && (
          <div className="admin-table-scroll" style={{ overflowX: 'auto' }}>
            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.border}`, color: theme.textoSecundario }}>
                  <th style={thStyle}>Nombre</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Finalizado</th>
                  <th style={thStyle}>Ganadores</th>
                  <th style={thStyle}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tournaments.map((t) => (
                  <tr
                    key={t.id}
                    style={{ borderBottom: `1px solid ${theme.border}`, color: theme.blanco }}
                  >
                    <td style={tdStyle}>{t.name}</td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontSize: 11,
                          background: STATUS_COLOR[t.status] ?? theme.border,
                          color: t.status === 'active' ? theme.fondo : theme.blanco,
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontWeight: 600,
                        }}
                      >
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {t.finishedAt
                        ? new Date(t.finishedAt).toLocaleDateString()
                        : '—'}
                    </td>
                    <td style={tdStyle}>
                      {t.tournamentWinners && t.tournamentWinners.length > 0
                        ? t.tournamentWinners.map((w) => w.username).join(', ')
                        : '—'}
                    </td>
                    <td style={tdStyle}>
                      {confirmAction?.id === t.id ? (
                        <span style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={handleConfirm}
                            disabled={terminate.isPending || archive.isPending}
                            style={{ ...btnDanger, padding: '4px 10px', fontSize: 11 }}
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setConfirmAction(null)}
                            style={{ ...btnOutline, padding: '4px 10px', fontSize: 11 }}
                          >
                            Cancelar
                          </button>
                        </span>
                      ) : (
                        <span style={{ display: 'flex', gap: 6 }}>
                          {t.status === 'active' && (
                            <button
                              onClick={() => setConfirmAction({ id: t.id, action: 'terminate' })}
                              style={{ ...btnDanger, padding: '4px 10px', fontSize: 11 }}
                            >
                              Terminar
                            </button>
                          )}
                          {t.status === 'finished' && (
                            <button
                              onClick={() => setConfirmAction({ id: t.id, action: 'archive' })}
                              style={{ ...btnPrimary, padding: '4px 10px', fontSize: 11 }}
                            >
                              Archivar
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {terminate.isSuccess && (
          <p style={{ color: theme.verdeBet, fontSize: 13, margin: '12px 0 0' }}>
            Torneo finalizado correctamente.
          </p>
        )}

        {archive.isSuccess && (
          <p style={{ color: theme.verdeBet, fontSize: 13, margin: '12px 0 0' }}>
            Torneo archivado. Se creó el siguiente torneo automáticamente.
          </p>
        )}

        {(terminate.error || archive.error) && (
          <p style={{ color: theme.rojo, fontSize: 13, margin: '12px 0 0' }}>
            {((terminate.error ?? archive.error) as any)?.response?.data?.message ??
              (terminate.error ?? archive.error)?.message ??
              'Error al procesar el torneo.'}
          </p>
        )}
      </div>
    </div>
  );
}
