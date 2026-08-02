import { useEffect, useState } from 'react';
import { useUpdateMatchDetails } from '../../hooks/use-admin';
import { formatDate } from '../../utils/format';
import type { MatchDTO, UpdateMatchDetailsPayload } from '../../types';
import theme from '../../styles/theme';

interface MatchRowProps {
  match: MatchDTO;
  /** true → editable inputs + per-row save (open date); false → read-only (closed/results) */
  editable: boolean;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const row: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  flexWrap: 'wrap',
  padding: '12px 16px',
  background: theme.searchBg,
  borderRadius: 8,
};

const teamImg: React.CSSProperties = {
  width: 28,
  height: 28,
  objectFit: 'contain',
};

const teamName: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 14,
  color: theme.blanco,
};

const vsText: React.CSSProperties = {
  color: theme.textoSecundario,
  margin: '0 8px',
};

const scheduleText: React.CSSProperties = {
  fontSize: 12,
  color: theme.textoSecundario,
  marginTop: 2,
};

const resultText: React.CSSProperties = {
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
  gap: 12,
  width: '100%',
};

const footer: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: 12,
  width: '100%',
};

const saveBtn: React.CSSProperties = {
  padding: '8px 18px',
  border: 'none',
  borderRadius: 8,
  background: theme.verdeBet,
  color: theme.blanco,
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};

const saveBtnDisabled: React.CSSProperties = {
  ...saveBtn,
  background: theme.disabled,
  color: theme.textoSecundario,
  cursor: 'not-allowed',
};

const errorBox: React.CSSProperties = {
  padding: '8px 12px',
  background: theme.dangerBg,
  color: theme.rojo,
  borderRadius: 8,
  fontSize: 13,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatScheduledAt(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return `${formatDate(d)} ${time}`;
}

function hideBrokenImg(e: React.SyntheticEvent<HTMLImageElement>) {
  (e.target as HTMLImageElement).style.display = 'none';
}

/** ISO string → value for <input type="datetime-local"> (local time, minute precision) */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value → ISO string (UTC); null when empty */
function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

// ─── Read-only row (closed / results dates) ─────────────────────────────────

function ReadOnlyRow({ match }: { match: MatchDTO }) {
  return (
    <div style={row}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 180 }}>
        {match.localImg && (
          <img src={match.localImg} alt={match.localTeam} style={teamImg} onError={hideBrokenImg} />
        )}
        <div style={teamName}>
          {match.localTeam}
          <span style={vsText}>vs</span>
          {match.visitorTeam}
        </div>
        {match.visitorImg && (
          <img src={match.visitorImg} alt={match.visitorTeam} style={teamImg} onError={hideBrokenImg} />
        )}
      </div>

      {match.scheduledAt && (
        <div style={scheduleText}>{formatScheduledAt(match.scheduledAt)}</div>
      )}

      <div style={resultText}>
        {match.result ? `${match.result}${match.score ? ` (${match.score})` : ''}` : '—'}
      </div>
    </div>
  );
}

// ─── Editable row (open date) ───────────────────────────────────────────────

function EditableRow({ match }: { match: MatchDTO }) {
  const updateDetails = useUpdateMatchDetails();

  const [localTeam, setLocalTeam] = useState(match.localTeam);
  const [visitorTeam, setVisitorTeam] = useState(match.visitorTeam);
  const [localImg, setLocalImg] = useState(match.localImg ?? '');
  const [visitorImg, setVisitorImg] = useState(match.visitorImg ?? '');
  const [scheduledAt, setScheduledAt] = useState(toDatetimeLocal(match.scheduledAt));

  // Re-sync from the refetched match after a successful save so the row shows
  // the persisted state (invalidation triggers the refetch).
  useEffect(() => {
    setLocalTeam(match.localTeam);
    setVisitorTeam(match.visitorTeam);
    setLocalImg(match.localImg ?? '');
    setVisitorImg(match.visitorImg ?? '');
    setScheduledAt(toDatetimeLocal(match.scheduledAt));
  }, [match.id, match.localTeam, match.visitorTeam, match.localImg, match.visitorImg, match.scheduledAt]);

  const hasChanges =
    localTeam.trim() !== match.localTeam ||
    visitorTeam.trim() !== match.visitorTeam ||
    (localImg.trim() || null) !== match.localImg ||
    (visitorImg.trim() || null) !== match.visitorImg ||
    scheduledAt !== toDatetimeLocal(match.scheduledAt);

  const handleSave = () => {
    if (!hasChanges || updateDetails.isPending) return;

    // Partial payload: only the fields the admin actually changed
    const payload: UpdateMatchDetailsPayload = {};
    const trimmedLocal = localTeam.trim();
    const trimmedVisitor = visitorTeam.trim();
    const imgLocal = localImg.trim() || null;
    const imgVisitor = visitorImg.trim() || null;
    const scheduled = fromDatetimeLocal(scheduledAt);

    if (trimmedLocal !== match.localTeam) payload.localTeam = trimmedLocal;
    if (trimmedVisitor !== match.visitorTeam) payload.visitorTeam = trimmedVisitor;
    if (imgLocal !== match.localImg) payload.localImg = imgLocal;
    if (imgVisitor !== match.visitorImg) payload.visitorImg = imgVisitor;
    if (scheduled !== match.scheduledAt) payload.scheduledAt = scheduled;

    updateDetails.mutate({ matchId: match.id, ...payload });
  };

  const saveDisabled = !hasChanges || updateDetails.isPending;

  return (
    <div style={row}>
      <div style={grid}>
        <div>
          <label style={label} htmlFor={`row-local-${match.id}`}>
            Equipo Local
          </label>
          <input
            id={`row-local-${match.id}`}
            style={input}
            value={localTeam}
            onChange={(e) => setLocalTeam(e.target.value)}
          />
        </div>

        <div>
          <label style={label} htmlFor={`row-visitor-${match.id}`}>
            Equipo Visitante
          </label>
          <input
            id={`row-visitor-${match.id}`}
            style={input}
            value={visitorTeam}
            onChange={(e) => setVisitorTeam(e.target.value)}
          />
        </div>

        <div>
          <label style={label} htmlFor={`row-local-img-${match.id}`}>
            Escudo Local (URL)
          </label>
          <input
            id={`row-local-img-${match.id}`}
            style={input}
            placeholder="https://..."
            value={localImg}
            onChange={(e) => setLocalImg(e.target.value)}
          />
        </div>

        <div>
          <label style={label} htmlFor={`row-visitor-img-${match.id}`}>
            Escudo Visitante (URL)
          </label>
          <input
            id={`row-visitor-img-${match.id}`}
            style={input}
            placeholder="https://..."
            value={visitorImg}
            onChange={(e) => setVisitorImg(e.target.value)}
          />
        </div>

        <div>
          <label style={label} htmlFor={`row-scheduled-${match.id}`}>
            Fecha y Horario
          </label>
          <input
            id={`row-scheduled-${match.id}`}
            style={input}
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>
      </div>

      <div style={footer}>
        {updateDetails.isError && (
          <div style={errorBox}>
            No se pudo guardar el partido.{' '}
            {((updateDetails.error as any)?.response?.data?.message as string) ?? ''}
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saveDisabled}
          style={saveDisabled ? saveBtnDisabled : saveBtn}
        >
          {updateDetails.isPending ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function MatchRow({ match, editable }: MatchRowProps) {
  return editable ? <EditableRow match={match} /> : <ReadOnlyRow match={match} />;
}
