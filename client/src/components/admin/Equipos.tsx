import { useState } from 'react';
import theme from '../../styles/theme';
import { resolveLogoUrl } from '../../utils/format';
import {
  useLeagues,
  useCreateLeague,
  useDeleteLeague,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
} from '../../hooks/use-teams';
import type { LeagueDTO, LeagueFormat, TeamDTO } from '../../types';
import type { CreateLeaguePayload, CreateTeamPayload, UpdateTeamPayload } from '../../api/admin-api';

// ─── Shared styles ──────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: theme.tarjeta,
  borderRadius: 12,
  padding: 24,
  border: `1px solid ${theme.border}`,
  boxShadow: theme.glow,
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

const primaryBtn: React.CSSProperties = {
  padding: '10px 20px',
  border: 'none',
  borderRadius: 8,
  background: theme.amarilloBet,
  color: theme.fondo,
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};

const primaryBtnDisabled: React.CSSProperties = {
  ...primaryBtn,
  background: theme.disabled,
  color: theme.textoSecundario,
  cursor: 'not-allowed',
};

const smallBtn: React.CSSProperties = {
  padding: '4px 10px',
  border: `1px solid ${theme.border}`,
  borderRadius: 6,
  background: 'transparent',
  color: theme.blanco,
  fontSize: 12,
  cursor: 'pointer',
};

const dangerBtn: React.CSSProperties = {
  padding: '4px 10px',
  border: 'none',
  borderRadius: 6,
  background: theme.rojo,
  color: theme.blanco,
  fontSize: 12,
  cursor: 'pointer',
};

const errorBox: React.CSSProperties = {
  marginTop: 12,
  padding: '10px 16px',
  background: theme.dangerBg,
  color: theme.rojo,
  borderRadius: 8,
  fontSize: 14,
};

const accordionItem: React.CSSProperties = {
  background: theme.tarjeta,
  border: `1px solid ${theme.border}`,
  borderRadius: 8,
};

const headerBtn = (expanded: boolean): React.CSSProperties => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  width: '100%',
  padding: '14px 16px',
  border: 'none',
  borderRadius: 8,
  background: expanded ? theme.inputBg : 'transparent',
  color: theme.blanco,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'left',
  gap: 12,
});

const teamRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 0',
  borderBottom: `1px solid ${theme.border}`,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function apiErrorMessage(err: unknown): string {
  return ((err as any)?.response?.data?.message as string) ?? '';
}

function aliasesToText(aliases: string[] | null | undefined): string {
  return (aliases ?? []).join(', ');
}

function textToAliases(text: string): string[] | null {
  const parts = text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : null;
}

// ─── Create league form ─────────────────────────────────────────────────────

function CreateLeagueForm() {
  const createLeague = useCreateLeague();
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [format, setFormat] = useState<LeagueFormat>('liga');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedCountry = country.trim();
    if (!trimmedName || !trimmedCountry) return;
    const payload: CreateLeaguePayload = {
      name: trimmedName,
      country: trimmedCountry,
      format,
    };
    createLeague.mutate(payload, {
      onSuccess: () => {
        setName('');
        setCountry('');
        setFormat('liga');
      },
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: theme.blanco }}>
        Nueva liga
      </h4>
      <div style={grid}>
        <div>
          <label style={label} htmlFor="league-name">
            Nombre
          </label>
          <input
            id="league-name"
            style={input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Primera División"
            required
          />
        </div>
        <div>
          <label style={label} htmlFor="league-country">
            País
          </label>
          <input
            id="league-country"
            style={input}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Argentina"
            required
          />
        </div>
        <div>
          <label style={label} htmlFor="league-format">
            Formato
          </label>
          <select
            id="league-format"
            style={input}
            value={format}
            onChange={(e) => setFormat(e.target.value as LeagueFormat)}
          >
            <option value="liga">Liga</option>
            <option value="copa">Copa</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={createLeague.isPending}
        style={createLeague.isPending ? primaryBtnDisabled : { ...primaryBtn, marginTop: 16 }}
      >
        {createLeague.isPending ? 'Creando...' : 'Crear liga'}
      </button>

      {createLeague.isError && (
        <div style={errorBox}>
          No se pudo crear la liga. {apiErrorMessage(createLeague.error)}
        </div>
      )}
    </form>
  );
}

// ─── Team form (create + edit) ──────────────────────────────────────────────

interface TeamFormProps {
  /** All leagues — membership multi-select (design D9). */
  leagues: LeagueDTO[];
  /** null → create mode; a team → edit mode with its current values. */
  initial?: TeamDTO | null;
  /** League preselected when creating from a league card. */
  defaultLeagueId?: number;
  isPending: boolean;
  /** Server error from the mutation (surfaced in the error box). */
  serverError?: string | null;
  submitLabel: string;
  onCancel?: () => void;
  onSubmit: (payload: CreateTeamPayload | UpdateTeamPayload) => void;
}

function TeamForm({
  leagues,
  initial,
  defaultLeagueId,
  isPending,
  serverError,
  submitLabel,
  onCancel,
  onSubmit,
}: TeamFormProps) {
  const isEdit = initial != null;
  const [name, setName] = useState(initial?.name ?? '');
  const [aliases, setAliases] = useState(aliasesToText(initial?.aliases));
  // The logo field only carries a REMOTE URL for the shield pipeline; leaving
  // it empty keeps the current logo (server treats null as "no change").
  const [logoUrl, setLogoUrl] = useState('');
  const [leagueIds, setLeagueIds] = useState<number[]>(
    initial?.leagueIds ?? (defaultLeagueId != null ? [defaultLeagueId] : []),
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const toggleLeague = (id: number) => {
    setLocalError(null);
    setLeagueIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    if (leagueIds.length === 0) {
      // Create requires ≥1; edit removing the last membership is the same 400
      // the server would return (spec "Remove last membership rejected").
      setLocalError('El equipo debe pertenecer a al menos una liga.');
      return;
    }
    onSubmit({
      name: trimmedName,
      aliases: textToAliases(aliases),
      logoUrl: logoUrl.trim() || null,
      leagueIds,
    });
  };

  const createMissingLeague = !isEdit && leagueIds.length === 0;

  return (
    <form onSubmit={handleSubmit} style={{ padding: '12px 16px' }}>
      <div style={grid}>
        <div>
          <label style={label} htmlFor={`team-name-${initial?.id ?? 'new'}`}>
            Nombre
          </label>
          <input
            id={`team-name-${initial?.id ?? 'new'}`}
            style={input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="River Plate"
            required
          />
        </div>
        <div>
          <label style={label} htmlFor={`team-aliases-${initial?.id ?? 'new'}`}>
            Alias (separados por coma)
          </label>
          <input
            id={`team-aliases-${initial?.id ?? 'new'}`}
            style={input}
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
            placeholder="El Millonario, La Banda"
          />
        </div>
        <div>
          <label style={label} htmlFor={`team-logo-${initial?.id ?? 'new'}`}>
            Escudo (URL)
          </label>
          <input
            id={`team-logo-${initial?.id ?? 'new'}`}
            style={input}
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <span style={label}>Ligas</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {leagues.map((league) => {
            const checked = leagueIds.includes(league.id);
            return (
              <label
                key={league.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  background: checked ? theme.amarilloBet : theme.searchBg,
                  color: checked ? theme.fondo : theme.blanco,
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleLeague(league.id)}
                />
                {league.name}
              </label>
            );
          })}
        </div>
        {createMissingLeague && (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: theme.rojo }}>
            Seleccioná al menos una liga.
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button
          type="submit"
          disabled={isPending || createMissingLeague}
          style={isPending || createMissingLeague ? primaryBtnDisabled : primaryBtn}
        >
          {isPending ? 'Guardando...' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" style={smallBtn} onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>

      {(localError || serverError) && (
        <div style={errorBox}>{localError ?? serverError}</div>
      )}
    </form>
  );
}

// ─── League card (accordion) ────────────────────────────────────────────────

function LeagueCard({ league, allLeagues }: { league: LeagueDTO; allLeagues: LeagueDTO[] }) {
  const [expanded, setExpanded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);

  const deleteLeague = useDeleteLeague();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();

  const cardError = [
    deleteLeague.isError && apiErrorMessage(deleteLeague.error),
    deleteTeam.isError && apiErrorMessage(deleteTeam.error),
    updateTeam.isError && apiErrorMessage(updateTeam.error),
    createTeam.isError && apiErrorMessage(createTeam.error),
  ].find((msg): msg is string => !!msg);

  const handleDeleteTeam = (team: TeamDTO) => {
    // Blocked deletes (409 referenced by matches) surface here — the list
    // state is untouched because invalidation only runs on success.
    deleteTeam.mutate(team.id);
  };

  return (
    <div style={accordionItem}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{ ...headerBtn(expanded), flex: 1 }}
          aria-expanded={expanded}
        >
          <span style={{ flex: 1 }}>
            {league.name} · {league.country} · {league.format === 'liga' ? 'Liga' : 'Copa'} ·{' '}
            {league.teams.length} equipos
          </span>
          <span aria-hidden="true">{expanded ? '▲' : '▼'}</span>
        </button>
        <button
          type="button"
          style={{ ...dangerBtn, marginRight: 8 }}
          onClick={() => deleteLeague.mutate(league.id)}
          title="Eliminar liga"
        >
          Eliminar
        </button>
      </div>

      {expanded && (
        <div style={{ padding: '4px 16px 16px' }}>
          {cardError && <div style={errorBox}>{cardError}</div>}

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {league.teams.map((team) => (
              <div key={team.id}>
                <div style={teamRowStyle}>
                  {team.logo && (
                    <img
                      src={resolveLogoUrl(team.logo) ?? undefined}
                      alt={team.name}
                      style={{ width: 28, height: 28, objectFit: 'contain' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: theme.blanco }}>
                      {team.name}
                    </div>
                    {team.aliases && team.aliases.length > 0 && (
                      <div style={{ fontSize: 12, color: theme.textoSecundario }}>
                        {team.aliases.join(', ')}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    style={smallBtn}
                    onClick={() =>
                      setEditingTeamId((id) => (id === team.id ? null : team.id))
                    }
                  >
                    Editar
                  </button>
                  <button type="button" style={dangerBtn} onClick={() => handleDeleteTeam(team)}>
                    Eliminar
                  </button>
                </div>

                {editingTeamId === team.id && (
                  <TeamForm
                    leagues={allLeagues}
                    initial={team}
                    isPending={updateTeam.isPending}
                    serverError={updateTeam.isError ? apiErrorMessage(updateTeam.error) : null}
                    submitLabel="Guardar equipo"
                    onCancel={() => setEditingTeamId(null)}
                    onSubmit={(payload) =>
                      updateTeam.mutate({ teamId: team.id, ...payload }, {
                        onSuccess: () => setEditingTeamId(null),
                      })
                    }
                  />
                )}
              </div>
            ))}
          </div>

          {creating ? (
            <TeamForm
              leagues={allLeagues}
              initial={null}
              defaultLeagueId={league.id}
              isPending={createTeam.isPending}
              serverError={createTeam.isError ? apiErrorMessage(createTeam.error) : null}
              submitLabel="Crear equipo"
              onCancel={() => setCreating(false)}
              onSubmit={(payload) =>
                createTeam.mutate(payload as CreateTeamPayload, {
                  onSuccess: () => setCreating(false),
                })
              }
            />
          ) : (
            <button
              type="button"
              style={{ ...smallBtn, marginTop: 12 }}
              onClick={() => setCreating(true)}
            >
              + Agregar equipo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function Equipos() {
  const { data: leagues, isLoading, error } = useLeagues();

  if (isLoading) {
    return (
      <div style={card}>
        <p style={{ color: theme.textoSecundario, textAlign: 'center' }}>Cargando equipos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={card}>
        <p style={{ color: theme.rojo, textAlign: 'center' }}>Error al cargar los equipos.</p>
      </div>
    );
  }

  const allLeagues = leagues ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={card}>
        <CreateLeagueForm />
      </div>

      <div style={card}>
        <h3 style={{ margin: '0 0 12px', fontSize: 18, color: theme.blanco }}>Ligas y equipos</h3>
        {allLeagues.length === 0 ? (
          <p style={{ color: theme.textoSecundario, textAlign: 'center' }}>
            No hay ligas todavía. Creá la primera arriba.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allLeagues.map((league) => (
              <LeagueCard key={league.id} league={league} allLeagues={allLeagues} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
