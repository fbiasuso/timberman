import { useState } from 'react';
import { useCreateMatch } from '../../hooks/use-admin';
import theme from '../../styles/theme';

interface AddMatchFormProps {
  /** The open date the new match will belong to */
  dateId: number;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const form: React.CSSProperties = {
  marginTop: 8,
  paddingTop: 16,
  borderTop: `1px dashed ${theme.border}`,
};

const title: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: 14,
  fontWeight: 700,
  color: theme.blanco,
};

const label: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: theme.textoSecundario,
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const input: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: theme.inputBg,
  border: `1px solid ${theme.border}`,
  borderRadius: 8,
  color: theme.blanco,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16,
};

const submitBtn: React.CSSProperties = {
  width: '100%',
  padding: '12px 0',
  marginTop: 16,
  border: 'none',
  borderRadius: 10,
  background: theme.verdeBet,
  color: theme.blanco,
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
};

const submitBtnDisabled: React.CSSProperties = {
  ...submitBtn,
  background: theme.disabled,
  cursor: 'not-allowed',
};

const errorBox: React.CSSProperties = {
  marginTop: 12,
  padding: '10px 16px',
  background: theme.dangerBg,
  color: theme.rojo,
  borderRadius: 8,
  fontSize: 14,
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function AddMatchForm({ dateId }: AddMatchFormProps) {
  const createMatch = useCreateMatch();
  const [localTeam, setLocalTeam] = useState('');
  const [visitorTeam, setVisitorTeam] = useState('');
  const [localImg, setLocalImg] = useState('');
  const [visitorImg, setVisitorImg] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const local = localTeam.trim();
    const visitor = visitorTeam.trim();
    if (!local || !visitor) return;

    createMatch.mutate(
      {
        matchDateId: dateId,
        localTeam: local,
        visitorTeam: visitor,
        localImg: localImg.trim() || null,
        visitorImg: visitorImg.trim() || null,
        scheduledAt: scheduledAt || null,
      },
      {
        onSuccess: () => {
          setLocalTeam('');
          setVisitorTeam('');
          setLocalImg('');
          setVisitorImg('');
          setScheduledAt('');
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} style={form}>
      <h4 style={title}>Agregar partido</h4>

      <div style={grid}>
        <div>
          <label style={label} htmlFor="add-match-local">
            Equipo Local
          </label>
          <input
            id="add-match-local"
            style={input}
            placeholder="Equipo local"
            value={localTeam}
            onChange={(e) => setLocalTeam(e.target.value)}
            required
          />
        </div>

        <div>
          <label style={label} htmlFor="add-match-visitor">
            Equipo Visitante
          </label>
          <input
            id="add-match-visitor"
            style={input}
            placeholder="Equipo visitante"
            value={visitorTeam}
            onChange={(e) => setVisitorTeam(e.target.value)}
            required
          />
        </div>

        <div>
          <label style={label} htmlFor="add-match-local-img">
            Escudo Local (URL)
          </label>
          <input
            id="add-match-local-img"
            style={input}
            placeholder="https://..."
            value={localImg}
            onChange={(e) => setLocalImg(e.target.value)}
          />
        </div>

        <div>
          <label style={label} htmlFor="add-match-visitor-img">
            Escudo Visitante (URL)
          </label>
          <input
            id="add-match-visitor-img"
            style={input}
            placeholder="https://..."
            value={visitorImg}
            onChange={(e) => setVisitorImg(e.target.value)}
          />
        </div>

        <div>
          <label style={label} htmlFor="add-match-scheduled-at">
            Fecha y Horario
          </label>
          <input
            id="add-match-scheduled-at"
            style={input}
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={createMatch.isPending}
        style={createMatch.isPending ? submitBtnDisabled : submitBtn}
      >
        {createMatch.isPending ? 'Creando...' : 'Crear partido'}
      </button>

      {createMatch.isError && (
        <div style={errorBox}>
          No se pudo crear el partido.{' '}
          {((createMatch.error as any)?.response?.data?.message as string) ?? ''}
        </div>
      )}
    </form>
  );
}
