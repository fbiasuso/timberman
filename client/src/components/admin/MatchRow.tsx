import { useEffect, useState } from 'react';
import { useUpdateMatchDetails } from '../../hooks/use-admin';
import { useLeagues } from '../../hooks/use-teams';
import Autocomplete from '../Autocomplete';
import { formatDate, resolveLogoUrl } from '../../utils/format';
import type { MatchDTO, UpdateMatchDetailsPayload } from '../../types';
import type { TeamDTO } from '../../types';
import theme from '../../styles/theme';

interface MatchRowProps {
  match: MatchDTO;
  /** true → editable inputs + per-row save (open date); false → read-only (closed/results) */
  editable: boolean;
}

/** One editable match side: the registry team id + the display fields. */
interface TeamFieldState {
  /** null → legacy free text (unmatched) — string-only PATCH clears the FK. */
  teamId: number | null;
  /** Input value — registry team name once picked, stored string for legacy. */
  name: string;
  /** Shield URL input (auto-filled from the team logo, overridable). */
  img: string;
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
  const { data: leagues } = useLeagues();
  const allLeagues = leagues ?? [];
  const allTeams = allLeagues.flatMap((l) => l.teams);
  const localRegistryTeam =
    match.localTeamId != null ? allTeams.find((t) => t.id === match.localTeamId) : undefined;
  const visitorRegistryTeam =
    match.visitorTeamId != null ? allTeams.find((t) => t.id === match.visitorTeamId) : undefined;

  // UI-only league selector (design D11): prefilled from the local team's
  // first membership, overridable — it only filters the autocomplete options.
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(
    localRegistryTeam?.leagueIds[0] ?? allLeagues[0]?.id ?? null,
  );
  const selectedLeague =
    allLeagues.find((l) => l.id === selectedLeagueId) ?? allLeagues[0] ?? null;
  const options = selectedLeague?.teams ?? [];

  // Prefill the selector once the registry loads (keeps an explicit pick).
  useEffect(() => {
    const prefill = localRegistryTeam?.leagueIds[0] ?? allLeagues[0]?.id ?? null;
    setSelectedLeagueId((current) => current ?? prefill);
  }, [localRegistryTeam?.leagueIds, allLeagues]);

  const [local, setLocal] = useState<TeamFieldState>({
    teamId: match.localTeamId ?? null,
    name: match.localTeam,
    img: match.localImg ?? '',
  });
  const [visitor, setVisitor] = useState<TeamFieldState>({
    teamId: match.visitorTeamId ?? null,
    name: match.visitorTeam,
    img: match.visitorImg ?? '',
  });
  const [scheduledAt, setScheduledAt] = useState(toDatetimeLocal(match.scheduledAt));

  // Re-sync from the refetched match after a successful save so the row shows
  // the persisted state (invalidation triggers the refetch).
  useEffect(() => {
    setLocal({
      teamId: match.localTeamId ?? null,
      name: match.localTeam,
      img: match.localImg ?? '',
    });
    setVisitor({
      teamId: match.visitorTeamId ?? null,
      name: match.visitorTeam,
      img: match.visitorImg ?? '',
    });
    setScheduledAt(toDatetimeLocal(match.scheduledAt));
  }, [match.id, match.localTeam, match.localTeamId, match.localImg, match.visitorTeam, match.visitorTeamId, match.visitorImg, match.scheduledAt]);

  const handleType =
    (set: React.Dispatch<React.SetStateAction<TeamFieldState>>) => (value: string) => {
      // Typing cancels the picked team — the value becomes legacy free text
      // (string-only PATCH clears the FK, spec "free text clears the team id").
      set((prev) => ({ ...prev, name: value, teamId: null }));
    };

  const handleSelect =
    (set: React.Dispatch<React.SetStateAction<TeamFieldState>>) => (team: TeamDTO) => {
      // Pick → name + id from the registry, shield auto-filled (overridable).
      set({ teamId: team.id, name: team.name, img: resolveLogoUrl(team.logo) ?? '' });
    };

  const hasChanges =
    local.name.trim() !== match.localTeam ||
    local.teamId !== (match.localTeamId ?? null) ||
    (local.img.trim() || null) !== match.localImg ||
    visitor.name.trim() !== match.visitorTeam ||
    visitor.teamId !== (match.visitorTeamId ?? null) ||
    (visitor.img.trim() || null) !== match.visitorImg ||
    scheduledAt !== toDatetimeLocal(match.scheduledAt);

  const handleSave = () => {
    if (!hasChanges || updateDetails.isPending) return;

    // Partial payload: only the fields the admin actually changed.
    // Team fields send {name, id} together once picked from the registry; a
    // legacy string without a pick stays string-only (FK null, design D10).
    const payload: UpdateMatchDetailsPayload = {};
    const trimmedLocal = local.name.trim();
    const trimmedVisitor = visitor.name.trim();
    const imgLocal = local.img.trim() || null;
    const imgVisitor = visitor.img.trim() || null;
    const scheduled = fromDatetimeLocal(scheduledAt);

    if (trimmedLocal !== match.localTeam || local.teamId !== (match.localTeamId ?? null)) {
      if (trimmedLocal) {
        payload.localTeam = trimmedLocal;
        if (local.teamId != null) payload.localTeamId = local.teamId;
      }
    }
    if (trimmedVisitor !== match.visitorTeam || visitor.teamId !== (match.visitorTeamId ?? null)) {
      if (trimmedVisitor) {
        payload.visitorTeam = trimmedVisitor;
        if (visitor.teamId != null) payload.visitorTeamId = visitor.teamId;
      }
    }
    if (imgLocal !== match.localImg) payload.localImg = imgLocal;
    if (imgVisitor !== match.visitorImg) payload.visitorImg = imgVisitor;
    if (scheduled !== match.scheduledAt) payload.scheduledAt = scheduled;

    updateDetails.mutate({ matchId: match.id, ...payload });
  };

  const saveDisabled = !hasChanges || updateDetails.isPending;

  const unmatchedText = 'Texto libre (sin equipo registrado)';

  return (
    <div style={row}>
      <div style={{ width: '100%' }}>
        <div style={{ marginBottom: 12 }}>
          <label style={label} htmlFor={`row-league-${match.id}`}>
            Liga
          </label>
          <select
            id={`row-league-${match.id}`}
            style={input}
            value={selectedLeague?.id ?? ''}
            onChange={(e) => setSelectedLeagueId(Number(e.target.value))}
          >
            {allLeagues.length === 0 && <option value="">Sin ligas</option>}
            {allLeagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name}
              </option>
            ))}
          </select>
        </div>

        <div style={grid}>
          <div>
            <label style={label} htmlFor={`row-local-${match.id}`}>
              Equipo Local
            </label>
            <Autocomplete
              id={`row-local-${match.id}`}
              options={options}
              getKey={(t) => String(t.id)}
              getLabel={(t) => t.name}
              value={local.name}
              onChange={handleType(setLocal)}
              onSelect={handleSelect(setLocal)}
              unmatchedText={local.teamId == null ? unmatchedText : undefined}
              placeholder="Elegí un equipo"
            />
          </div>

          <div>
            <label style={label} htmlFor={`row-visitor-${match.id}`}>
              Equipo Visitante
            </label>
            <Autocomplete
              id={`row-visitor-${match.id}`}
              options={options}
              getKey={(t) => String(t.id)}
              getLabel={(t) => t.name}
              value={visitor.name}
              onChange={handleType(setVisitor)}
              onSelect={handleSelect(setVisitor)}
              unmatchedText={visitor.teamId == null ? unmatchedText : undefined}
              placeholder="Elegí un equipo"
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
              value={local.img}
              onChange={(e) => setLocal((prev) => ({ ...prev, img: e.target.value }))}
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
              value={visitor.img}
              onChange={(e) => setVisitor((prev) => ({ ...prev, img: e.target.value }))}
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
