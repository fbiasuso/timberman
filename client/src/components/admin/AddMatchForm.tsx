import { useState } from 'react';
import { useCreateMatch } from '../../hooks/use-admin';
import { useLeagues } from '../../hooks/use-teams';
import Autocomplete from '../Autocomplete';
import { resolveLogoUrl } from '../../utils/format';
import type { TeamDTO } from '../../types';
import theme from '../../styles/theme';

interface AddMatchFormProps {
  /** The open date the new match will belong to */
  dateId: number;
}

/** One match side: the picked registry team + the editable shield field. */
interface SideState {
  team: TeamDTO | null;
  /** Input value — the registry team's name once picked. */
  name: string;
  /** Shield URL input (auto-filled from the team logo, overridable). */
  img: string;
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

const hintText: React.CSSProperties = {
  margin: '8px 0 0',
  fontSize: 12,
  color: theme.textoSecundario,
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function AddMatchForm({ dateId }: AddMatchFormProps) {
  const createMatch = useCreateMatch();
  const { data: leagues } = useLeagues();
  const allLeagues = leagues ?? [];

  // UI-only league selector (design D11): it only filters the autocomplete
  // options; the league id is NEVER submitted to the match endpoints.
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const selectedLeague =
    allLeagues.find((l) => l.id === selectedLeagueId) ?? allLeagues[0] ?? null;
  const options = selectedLeague?.teams ?? [];

  const [local, setLocal] = useState<SideState>({ team: null, name: '', img: '' });
  const [visitor, setVisitor] = useState<SideState>({ team: null, name: '', img: '' });
  const [scheduledAt, setScheduledAt] = useState('');

  const handleType =
    (set: React.Dispatch<React.SetStateAction<SideState>>) => (value: string) => {
      // Typing cancels the picked team — create requires an explicit pick
      // (free-text team input is removed).
      set((prev) => ({ ...prev, name: value, team: null }));
    };

  const handleSelect =
    (set: React.Dispatch<React.SetStateAction<SideState>>) => (team: TeamDTO) => {
      // Pick → name + id from the registry, shield auto-filled (overridable).
      set({ team, name: team.name, img: resolveLogoUrl(team.logo) ?? '' });
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!local.team || !visitor.team) return;

    createMatch.mutate(
      {
        matchDateId: dateId,
        localTeam: local.team.name,
        visitorTeam: visitor.team.name,
        localImg: local.img.trim() || null,
        visitorImg: visitor.img.trim() || null,
        localTeamId: local.team.id,
        visitorTeamId: visitor.team.id,
        scheduledAt: scheduledAt || null,
      },
      {
        onSuccess: () => {
          setLocal({ team: null, name: '', img: '' });
          setVisitor({ team: null, name: '', img: '' });
          setScheduledAt('');
        },
      },
    );
  };

  // Both teams must be picked from the registry before the match can be created
  const canSubmit = local.team != null && visitor.team != null && !createMatch.isPending;

  return (
    <form onSubmit={handleSubmit} style={form}>
      <h4 style={title}>Agregar partido</h4>

      <div style={{ marginBottom: 16 }}>
        <label style={label} htmlFor="add-match-league">
          Liga
        </label>
        <select
          id="add-match-league"
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

      <div className="admin-grid" style={grid}>
        <div>
          <label style={label} htmlFor="add-match-local">
            Equipo Local
          </label>
          <Autocomplete
            id="add-match-local"
            options={options}
            getKey={(t) => String(t.id)}
            getLabel={(t) => t.name}
            value={local.name}
            onChange={handleType(setLocal)}
            onSelect={handleSelect(setLocal)}
            placeholder="Elegí un equipo"
          />
        </div>

        <div>
          <label style={label} htmlFor="add-match-visitor">
            Equipo Visitante
          </label>
          <Autocomplete
            id="add-match-visitor"
            options={options}
            getKey={(t) => String(t.id)}
            getLabel={(t) => t.name}
            value={visitor.name}
            onChange={handleType(setVisitor)}
            onSelect={handleSelect(setVisitor)}
            placeholder="Elegí un equipo"
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
            value={local.img}
            onChange={(e) => setLocal((prev) => ({ ...prev, img: e.target.value }))}
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
            value={visitor.img}
            onChange={(e) => setVisitor((prev) => ({ ...prev, img: e.target.value }))}
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

      {!canSubmit && allLeagues.length > 0 && (
        <p style={hintText}>Elegí un equipo de la lista para cada lado.</p>
      )}

      <button type="submit" disabled={!canSubmit} style={canSubmit ? submitBtn : submitBtnDisabled}>
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
