import { useEffect, useState } from 'react';
import theme from '../../styles/theme';
import { resolveLogoUrl } from '../../utils/format';
import {
  useLeagues,
  useCreateLeague,
  useDeleteLeague,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
  useSetTeamLogo,
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

// ─── Shield file rules (design D4 — mirrored by the server's 1 MiB cap) ────

/** 1 MiB — same cap as the server (`MAX_IMAGE_BYTES`). */
const MAX_LOGO_BYTES = 1024 * 1024;
/** Native picker filter — PNG, JPEG, WebP only (spec "Team Logo Upload UI"). */
const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp';
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** Client-side shield validation — null when the file may be uploaded. */
function validateLogo(file: File): string | null {
  if (!LOGO_TYPES.includes(file.type)) {
    return 'El escudo debe ser PNG, JPEG o WebP.';
  }
  if (file.size > MAX_LOGO_BYTES) {
    return 'El escudo debe pesar menos de 1 MiB.';
  }
  return null;
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
      <div className="admin-grid" style={grid}>
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
  /** True while the chained shield upload runs (design D4 two-step save). */
  uploading?: boolean;
  /** Server error from the team mutation (surfaced in the error box). */
  serverError?: string | null;
  /** Upload failure after the team was saved (200 stored:false or 4xx). */
  uploadError?: string | null;
  submitLabel: string;
  onCancel?: () => void;
  /** Edit mode only: delete the team from inside the form (full-width button). */
  onDelete?: () => void;
  /** Pending state for the in-form delete button. */
  deletePending?: boolean;
  /** Two-step save (design D4): team payload first, then the selected file. */
  onSubmit: (payload: CreateTeamPayload | UpdateTeamPayload, file?: File) => void;
}

function TeamForm({
  leagues,
  initial,
  defaultLeagueId,
  isPending,
  uploading = false,
  serverError,
  uploadError,
  submitLabel,
  onCancel,
  onDelete,
  deletePending = false,
  onSubmit,
}: TeamFormProps) {
  const isEdit = initial != null;
  const [name, setName] = useState(initial?.name ?? '');
  const [aliases, setAliases] = useState(aliasesToText(initial?.aliases));
  // The shield is uploaded through the logo endpoint (two-step save); it is
  // NEVER sent as logoUrl in the team payload (design D4).
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [leagueIds, setLeagueIds] = useState<number[]>(
    initial?.leagueIds ?? (defaultLeagueId != null ? [defaultLeagueId] : []),
  );
  const [localError, setLocalError] = useState<string | null>(null);

  // Revoke the object URL when the selection changes or the form unmounts.
  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const toggleLeague = (id: number) => {
    setLocalError(null);
    setLeagueIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setLogoFile(file);
    setLogoError(file ? validateLogo(file) : null);
    // The effect above revokes the previous preview URL on change.
    setLogoPreview(file ? URL.createObjectURL(file) : null);
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
    // Re-validate at submit — an invalid selection must block save (spec
    // "Invalid type blocked" / "Oversized file blocked").
    if (logoFile) {
      const error = validateLogo(logoFile);
      if (error) {
        setLogoError(error);
        return;
      }
    }
    onSubmit(
      { name: trimmedName, aliases: textToAliases(aliases), leagueIds },
      logoFile ?? undefined,
    );
  };

  const createMissingLeague = !isEdit && leagueIds.length === 0;

  return (
    <form onSubmit={handleSubmit} style={{ padding: '12px 16px' }}>
      <div className="admin-grid" style={grid}>
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
            Escudo (PNG, JPEG o WebP)
          </label>
          <input
            id={`team-logo-${initial?.id ?? 'new'}`}
            type="file"
            accept={LOGO_ACCEPT}
            style={input}
            onChange={handleLogoChange}
            title="Máximo 1 MiB"
          />
          {logoPreview && !logoError && (
            <img
              src={logoPreview}
              alt="Vista previa del escudo"
              style={{ width: 40, height: 40, objectFit: 'contain', marginTop: 8 }}
            />
          )}
          {logoError && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: theme.rojo }}>{logoError}</p>
          )}
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
          disabled={isPending || uploading || createMissingLeague || !!logoError}
          style={
            isPending || uploading || createMissingLeague || !!logoError
              ? primaryBtnDisabled
              : primaryBtn
          }
        >
          {uploading ? 'Subiendo escudo...' : isPending ? 'Guardando...' : submitLabel}
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
      {uploadError && <div style={errorBox}>{uploadError}</div>}

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deletePending}
          style={{
            width: '100%',
            marginTop: 24,
            padding: '10px 0',
            border: 'none',
            borderRadius: 8,
            background: theme.rojo,
            color: theme.blanco,
            fontSize: 14,
            fontWeight: 600,
            cursor: deletePending ? 'not-allowed' : 'pointer',
            opacity: deletePending ? 0.7 : 1,
          }}
        >
          {deletePending ? 'Eliminando...' : 'Eliminar equipo'}
        </button>
      )}
    </form>
  );
}

// ─── League card (accordion) ────────────────────────────────────────────────

function LeagueCard({ league, allLeagues }: { league: LeagueDTO; allLeagues: LeagueDTO[] }) {
  const [expanded, setExpanded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const deleteLeague = useDeleteLeague();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();
  const uploadLogo = useSetTeamLogo();

  const cardError = [
    deleteLeague.isError && apiErrorMessage(deleteLeague.error),
    deleteTeam.isError && apiErrorMessage(deleteTeam.error),
    updateTeam.isError && apiErrorMessage(updateTeam.error),
    createTeam.isError && apiErrorMessage(createTeam.error),
  ].find((msg): msg is string => !!msg);

  const handleDeleteTeam = (team: TeamDTO) => {
    // Blocked deletes (409 referenced by matches) surface here — the list
    // state is untouched because invalidation only runs on success.
    deleteTeam.mutate(team.id, {
      onSuccess: () => setEditingTeamId(null),
    });
  };

  /** Two-step save (design D4): the chained shield upload runs after the team
   *  create/update succeeds, keeping the form open with a combined pending
   *  state ("Subiendo escudo..."). A failed upload (4xx or 200 stored:false)
   *  surfaces in the upload error box and the team stays saved without a logo;
   *  the admin can retry via re-edit. */
  const chainLogoUpload = (teamId: number, wasCreating: boolean, file: File) => {
    setUploading(true);
    uploadLogo.mutate(
      { teamId, file },
      {
        onSuccess: (result) => {
          if (result.stored) {
            if (wasCreating) setCreating(false);
            else setEditingTeamId(null);
          } else {
            setUploadError('El escudo no se pudo guardar. El equipo se guardó sin escudo.');
          }
        },
        onError: (err) => {
          setUploadError(apiErrorMessage(err) || 'No se pudo subir el escudo.');
        },
        onSettled: () => setUploading(false),
      },
    );
  };

  const handleCreateSubmit = (payload: CreateTeamPayload, file?: File) => {
    setUploadError(null);
    createTeam.mutate(payload, {
      onSuccess: (team) => {
        if (file) {
          chainLogoUpload(team.id, true, file);
        } else {
          setCreating(false);
        }
      },
    });
  };

  const handleUpdateSubmit = (team: TeamDTO, payload: UpdateTeamPayload, file?: File) => {
    setUploadError(null);
    updateTeam.mutate(
      { teamId: team.id, ...payload },
      {
        onSuccess: () => {
          if (file) {
            chainLogoUpload(team.id, false, file);
          } else {
            setEditingTeamId(null);
          }
        },
      },
    );
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
                  <div className="team-row-actions">
                    <button
                      type="button"
                      style={smallBtn}
                      onClick={() =>
                        setEditingTeamId((id) => (id === team.id ? null : team.id))
                      }
                    >
                      Editar
                    </button>
                  </div>
                </div>

                {editingTeamId === team.id && (
                  <TeamForm
                    leagues={allLeagues}
                    initial={team}
                    isPending={updateTeam.isPending}
                    uploading={uploading}
                    serverError={updateTeam.isError ? apiErrorMessage(updateTeam.error) : null}
                    uploadError={uploadError}
                    submitLabel="Guardar equipo"
                    onCancel={() => setEditingTeamId(null)}
                    onDelete={() => handleDeleteTeam(team)}
                    deletePending={deleteTeam.isPending}
                    onSubmit={(payload, file) =>
                      handleUpdateSubmit(team, payload as UpdateTeamPayload, file)
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
              uploading={uploading}
              serverError={createTeam.isError ? apiErrorMessage(createTeam.error) : null}
              uploadError={uploadError}
              submitLabel="Crear equipo"
              onCancel={() => setCreating(false)}
              onSubmit={(payload, file) =>
                handleCreateSubmit(payload as CreateTeamPayload, file)
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
