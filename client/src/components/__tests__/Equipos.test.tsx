import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within, act } from '@testing-library/react';
import Equipos from '../admin/Equipos';
import type { LeagueDTO, TeamDTO } from '../../types';

// --- Mocks ---

const { createLeagueMutate, deleteLeagueMutate, createTeamMutate, updateTeamMutate, deleteTeamMutate, setTeamLogoMutate } =
  vi.hoisted(() => ({
    createLeagueMutate: vi.fn(),
    deleteLeagueMutate: vi.fn(),
    createTeamMutate: vi.fn(),
    updateTeamMutate: vi.fn(),
    deleteTeamMutate: vi.fn(),
    setTeamLogoMutate: vi.fn(),
  }));

// Toggleable mutation states (simulate async errors after a click + rerender)
const { deleteTeamState } = vi.hoisted(() => ({
  deleteTeamState: { isError: false, error: null as unknown },
}));

vi.mock('../../hooks/use-teams', () => ({
  useLeagues: vi.fn(() => ({ data: [], isLoading: false, error: null })),
  useCreateLeague: () => ({
    mutate: (payload: unknown, opts?: { onSuccess?: () => void }) => {
      createLeagueMutate(payload, opts);
      // Simulate a successful create so the form's onSuccess reset runs
      opts?.onSuccess?.();
    },
    isPending: false,
    isError: false,
    error: null,
  }),
  useDeleteLeague: () => ({
    mutate: deleteLeagueMutate,
    isPending: false,
    isError: false,
    error: null,
  }),
  useCreateTeam: () => ({
    mutate: createTeamMutate,
    isPending: false,
    isError: false,
    error: null,
  }),
  useUpdateTeam: () => ({
    mutate: updateTeamMutate,
    isPending: false,
    isError: false,
    error: null,
  }),
  useDeleteTeam: () => ({
    mutate: deleteTeamMutate,
    isPending: false,
    isError: deleteTeamState.isError,
    error: deleteTeamState.error,
  }),
  useSetTeamLogo: () => ({
    mutate: setTeamLogoMutate,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

import { useLeagues } from '../../hooks/use-teams';

afterEach(() => {
  cleanup();
  createLeagueMutate.mockClear();
  deleteLeagueMutate.mockClear();
  createTeamMutate.mockClear();
  updateTeamMutate.mockClear();
  deleteTeamMutate.mockClear();
  setTeamLogoMutate.mockClear();
  deleteTeamState.isError = false;
  deleteTeamState.error = null;
  vi.mocked(useLeagues).mockReset();
  vi.mocked(useLeagues).mockReturnValue({ data: [], isLoading: false, error: null } as any);
});

// --- Fixtures ---

const river: TeamDTO = {
  id: 11,
  name: 'River Plate',
  aliases: ['El Millonario'],
  logo: 'logos/11.png',
  leagueIds: [1],
  createdAt: '2026-08-01T00:00:00.000Z',
};

const boca: TeamDTO = {
  id: 12,
  name: 'Boca Juniors',
  aliases: null,
  logo: null,
  leagueIds: [1],
  createdAt: '2026-08-01T00:00:00.000Z',
};

/** The team a successful "San Lorenzo" create resolves with (for two-step tests). */
const sanLorenzo: TeamDTO = {
  id: 13,
  name: 'San Lorenzo',
  aliases: null,
  logo: null,
  leagueIds: [1],
  createdAt: '2026-08-01T00:00:00.000Z',
};

const liga: LeagueDTO = {
  id: 1,
  name: 'Primera División',
  country: 'Argentina',
  format: 'liga',
  createdAt: '2026-08-01T00:00:00.000Z',
  teams: [river, boca],
};

const copa: LeagueDTO = {
  id: 2,
  name: 'Copa Argentina',
  country: 'Argentina',
  format: 'copa',
  createdAt: '2026-08-01T00:00:00.000Z',
  teams: [],
};

function mockLeagues(list: LeagueDTO[] | null, extra?: { isLoading?: boolean; error?: unknown }) {
  vi.mocked(useLeagues).mockReturnValue({
    data: list,
    isLoading: extra?.isLoading ?? false,
    error: extra?.error ?? null,
  } as any);
}

function expandLeague() {
  fireEvent.click(screen.getByRole('button', { name: /Primera División/ }));
}

/** The team row div (name → info wrapper → row) for a listed team. */
function teamRow(teamName: string): HTMLElement {
  const name = screen.getByText(teamName);
  return (name.parentElement as HTMLElement).parentElement as HTMLElement;
}

/** Opens the create-team form inside an expanded league and returns it. */
function openCreateTeamForm(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: /Agregar equipo/ }));
  return screen.getByRole('button', { name: 'Crear equipo' }).closest('form') as HTMLElement;
}

// --- Tests ---

describe('Equipos', () => {
  it('shows a loading state', () => {
    mockLeagues(null, { isLoading: true });
    render(<Equipos />);
    expect(screen.getByText('Cargando equipos...')).toBeDefined();
  });

  it('shows an error state', () => {
    mockLeagues(null, { error: new Error('fail') });
    render(<Equipos />);
    expect(screen.getByText('Error al cargar los equipos.')).toBeDefined();
  });

  it('lists every league and, expanded, its nested teams', () => {
    mockLeagues([liga, copa]);
    render(<Equipos />);

    // Both leagues listed with format labels and team counts
    expect(screen.getByRole('button', { name: /Primera División.*Liga/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Copa Argentina.*Copa/ })).toBeDefined();

    expandLeague();
    // Nested teams render with their aliases
    expect(screen.getByText('River Plate')).toBeDefined();
    expect(screen.getByText('El Millonario')).toBeDefined();
    expect(screen.getByText('Boca Juniors')).toBeDefined();
  });

  it('creates a league via useCreateLeague and resets the form', () => {
    mockLeagues([]);
    render(<Equipos />);

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Primera Nacional' } });
    fireEvent.change(screen.getByLabelText('País'), { target: { value: 'Argentina' } });
    fireEvent.change(screen.getByLabelText('Formato'), { target: { value: 'liga' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear liga' }));

    expect(createLeagueMutate).toHaveBeenCalledWith(
      {
        name: 'Primera Nacional',
        country: 'Argentina',
        format: 'liga',
      },
      expect.anything(),
    );

    // Form resets after a successful create
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('País') as HTMLInputElement).value).toBe('');
  });

  it('creates a team from a league card and refreshes the list', () => {
    mockLeagues([liga]);
    const view = render(<Equipos />);
    expandLeague();

    fireEvent.click(screen.getByRole('button', { name: /Agregar equipo/ }));
    const form = screen.getByRole('button', { name: 'Crear equipo' }).closest('form') as HTMLElement;

    fireEvent.change(within(form).getByLabelText('Nombre'), { target: { value: 'San Lorenzo' } });
    fireEvent.change(within(form).getByLabelText('Alias (separados por coma)'), {
      target: { value: 'El Ciclón, Azulgrana' },
    });
    // The card league is preselected → leagueIds [1]
    expect((within(form).getByLabelText('Primera División') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(within(form).getByRole('button', { name: 'Crear equipo' }));

    expect(createTeamMutate).toHaveBeenCalledWith(
      {
        name: 'San Lorenzo',
        aliases: ['El Ciclón', 'Azulgrana'],
        leagueIds: [1],
      },
      expect.anything(),
    );

    // The create succeeds server-side; the invalidated query refetches with the
    // new team and the list shows it
    const sanLorenzo: TeamDTO = {
      id: 13,
      name: 'San Lorenzo',
      aliases: ['El Ciclón'],
      logo: null,
      leagueIds: [1],
      createdAt: '2026-08-01T00:00:00.000Z',
    };
    mockLeagues([{ ...liga, teams: [river, boca, sanLorenzo] }]);
    view.rerender(<Equipos />);

    expect(screen.getByText('San Lorenzo')).toBeDefined();
  });

  it('requires at least one league membership on create', () => {
    mockLeagues([liga]);
    render(<Equipos />);
    expandLeague();

    fireEvent.click(screen.getByRole('button', { name: /Agregar equipo/ }));
    const form = screen.getByRole('button', { name: 'Crear equipo' }).closest('form') as HTMLElement;
    const submit = within(form).getByRole('button', { name: 'Crear equipo' }) as HTMLButtonElement;

    // Unchecking the preselected league blocks the submit and shows the hint
    fireEvent.click(within(form).getByLabelText('Primera División'));
    expect((within(form).getByLabelText('Primera División') as HTMLInputElement).checked).toBe(false);
    expect(submit.disabled).toBe(true);
    expect(within(form).getByText('Seleccioná al menos una liga.')).toBeDefined();
    expect(createTeamMutate).not.toHaveBeenCalled();
  });

  it('edits a team and surfaces the last-membership error without calling the server', () => {
    mockLeagues([liga, copa]);
    render(<Equipos />);
    expandLeague();

    const riverRow = teamRow('River Plate');
    fireEvent.click(within(riverRow).getByRole('button', { name: 'Editar' }));

    const form = screen.getByRole('button', { name: 'Guardar equipo' }).closest('form') as HTMLElement;
    // Edit form prefilled from the registry record
    expect((within(form).getByLabelText('Nombre') as HTMLInputElement).value).toBe('River Plate');
    expect((within(form).getByLabelText('Alias (separados por coma)') as HTMLInputElement).value).toBe('El Millonario');
    expect((within(form).getByLabelText('Primera División') as HTMLInputElement).checked).toBe(true);

    // Removing the last membership → 400-class message in the error box
    fireEvent.click(within(form).getByLabelText('Primera División'));
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar equipo' }));

    expect(within(form).getByText('El equipo debe pertenecer a al menos una liga.')).toBeDefined();
    expect(updateTeamMutate).not.toHaveBeenCalled();
  });

  it('shows the server error when a referenced team delete is blocked and the team remains', () => {
    mockLeagues([liga]);
    const view = render(<Equipos />);
    expandLeague();

    const bocaRow = teamRow('Boca Juniors');
    // Rows offer ONLY Editar — delete lives inside the edit form
    expect(within(bocaRow).queryByRole('button', { name: 'Eliminar' })).toBeNull();
    expect(within(bocaRow).getByRole('button', { name: 'Editar' })).toBeDefined();

    fireEvent.click(within(bocaRow).getByRole('button', { name: 'Editar' }));
    const form = screen.getByRole('button', { name: 'Guardar equipo' }).closest('form') as HTMLElement;
    fireEvent.click(within(form).getByRole('button', { name: 'Eliminar equipo' }));
    expect(deleteTeamMutate).toHaveBeenCalledWith(boca.id, expect.anything());

    // The server rejects with 409 (team referenced by a match)
    deleteTeamState.isError = true;
    deleteTeamState.error = { response: { data: { message: 'El equipo está referenciado por partidos' } } };
    view.rerender(<Equipos />);

    expect(screen.getByText('El equipo está referenciado por partidos')).toBeDefined();
    // The team remains in the list — the invalidated refetch never ran
    expect(screen.getByText('Boca Juniors')).toBeDefined();
  });

  it('deletes a team from the edit form and closes the form on success', () => {
    mockLeagues([liga]);
    const view = render(<Equipos />);
    expandLeague();

    const riverRow = teamRow('River Plate');
    fireEvent.click(within(riverRow).getByRole('button', { name: 'Editar' }));
    const form = screen.getByRole('button', { name: 'Guardar equipo' }).closest('form') as HTMLElement;
    expect(within(form).getByRole('button', { name: 'Eliminar equipo' })).toBeDefined();

    // The delete resolves server-side → the edit form closes
    deleteTeamMutate.mockImplementation((_id, opts) => opts?.onSuccess?.());
    fireEvent.click(within(form).getByRole('button', { name: 'Eliminar equipo' }));
    expect(deleteTeamMutate).toHaveBeenCalledWith(river.id, expect.anything());
    expect(screen.queryByRole('button', { name: 'Guardar equipo' })).toBeNull();
  });

  it('renders the shield as a file picker restricted to images', () => {
    mockLeagues([liga]);
    render(<Equipos />);
    expandLeague();
    const form = openCreateTeamForm();

    const fileInput = within(form).getByLabelText(/Escudo/) as HTMLInputElement;
    expect(fileInput.type).toBe('file');
    expect(fileInput.accept).toBe('image/png,image/jpeg,image/webp');
  });

  it('previews a valid shield selection, enables save and revokes the old URL', () => {
    mockLeagues([liga]);
    render(<Equipos />);
    expandLeague();
    const form = openCreateTeamForm();
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

    fireEvent.change(within(form).getByLabelText('Nombre'), { target: { value: 'San Lorenzo' } });
    const file = new File(['png-bytes'], 'escudo.png', { type: 'image/png' });
    fireEvent.change(within(form).getByLabelText(/Escudo/) as HTMLInputElement, {
      target: { files: [file] },
    });

    // Live preview renders and the submit is enabled
    expect(within(form).getByAltText('Vista previa del escudo')).toBeDefined();
    expect((within(form).getByRole('button', { name: 'Crear equipo' }) as HTMLButtonElement).disabled).toBe(false);

    // Selecting a different file revokes the previous preview object URL
    const other = new File(['more-bytes'], 'otro.png', { type: 'image/png' });
    fireEvent.change(within(form).getByLabelText(/Escudo/) as HTMLInputElement, {
      target: { files: [other] },
    });
    expect(revokeSpy).toHaveBeenCalled();
    revokeSpy.mockRestore();
  });

  it('blocks save and shows an inline error for an invalid shield type', () => {
    mockLeagues([liga]);
    render(<Equipos />);
    expandLeague();
    const form = openCreateTeamForm();

    const file = new File(['not-an-image'], 'datos.txt', { type: 'text/plain' });
    fireEvent.change(within(form).getByLabelText(/Escudo/) as HTMLInputElement, {
      target: { files: [file] },
    });

    expect(within(form).getByText('El escudo debe ser PNG, JPEG o WebP.')).toBeDefined();
    const submit = within(form).getByRole('button', { name: 'Crear equipo' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(submit);
    expect(createTeamMutate).not.toHaveBeenCalled();
  });

  it('blocks save and shows an inline error for an oversized shield', () => {
    mockLeagues([liga]);
    render(<Equipos />);
    expandLeague();
    const form = openCreateTeamForm();

    const file = new File([new Uint8Array(1024 * 1024 + 1)], 'grande.png', { type: 'image/png' });
    fireEvent.change(within(form).getByLabelText(/Escudo/) as HTMLInputElement, {
      target: { files: [file] },
    });

    expect(within(form).getByText('El escudo debe pesar menos de 1 MiB.')).toBeDefined();
    const submit = within(form).getByRole('button', { name: 'Crear equipo' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(submit);
    expect(createTeamMutate).not.toHaveBeenCalled();
  });

  it('chains the shield upload with the File after the team is created', () => {
    mockLeagues([liga]);
    render(<Equipos />);
    expandLeague();
    const form = openCreateTeamForm();

    fireEvent.change(within(form).getByLabelText('Nombre'), { target: { value: 'San Lorenzo' } });
    const file = new File(['png-bytes'], 'escudo.png', { type: 'image/png' });
    fireEvent.change(within(form).getByLabelText(/Escudo/) as HTMLInputElement, {
      target: { files: [file] },
    });

    // Team create resolves with the persisted team (id 13); upload resolves stored:true
    createTeamMutate.mockImplementation((_payload, opts) => opts?.onSuccess?.(sanLorenzo));
    setTeamLogoMutate.mockImplementation((_args, opts) => {
      opts?.onSuccess?.({ team: sanLorenzo, stored: true });
      opts?.onSettled?.();
    });

    fireEvent.click(within(form).getByRole('button', { name: 'Crear equipo' }));

    expect(createTeamMutate).toHaveBeenCalledWith(
      { name: 'San Lorenzo', aliases: null, leagueIds: [1] },
      expect.anything(),
    );
    // The upload runs AFTER the team is saved, with the persisted id + the File
    expect(setTeamLogoMutate).toHaveBeenCalledWith({ teamId: 13, file }, expect.anything());
  });

  it('surfaces a not-stored upload and keeps the form open for retry', () => {
    mockLeagues([liga]);
    render(<Equipos />);
    expandLeague();
    const form = openCreateTeamForm();

    fireEvent.change(within(form).getByLabelText('Nombre'), { target: { value: 'San Lorenzo' } });
    const file = new File(['png-bytes'], 'escudo.png', { type: 'image/png' });
    fireEvent.change(within(form).getByLabelText(/Escudo/) as HTMLInputElement, {
      target: { files: [file] },
    });

    createTeamMutate.mockImplementation((_payload, opts) => opts?.onSuccess?.(sanLorenzo));
    setTeamLogoMutate.mockImplementation((_args, opts) => {
      opts?.onSuccess?.({ team: sanLorenzo, stored: false });
      opts?.onSettled?.();
    });

    fireEvent.click(within(form).getByRole('button', { name: 'Crear equipo' }));

    // Team saved, but the store backend rejected the bytes → upload error box
    expect(within(form).getByText('El escudo no se pudo guardar. El equipo se guardó sin escudo.')).toBeDefined();
    // The form stays open so the admin can retry or cancel (re-edit retry)
    expect(within(form).getByRole('button', { name: 'Crear equipo' })).toBeDefined();
  });

  it('shows the combined pending state while the chained shield upload runs', async () => {
    mockLeagues([liga]);
    render(<Equipos />);
    expandLeague();
    const form = openCreateTeamForm();

    fireEvent.change(within(form).getByLabelText('Nombre'), { target: { value: 'San Lorenzo' } });
    const file = new File(['png-bytes'], 'escudo.png', { type: 'image/png' });
    fireEvent.change(within(form).getByLabelText(/Escudo/) as HTMLInputElement, {
      target: { files: [file] },
    });

    // The upload stays pending until the test resolves it
    let resolveUpload!: (value: unknown) => void;
    const uploadPending = new Promise((resolve) => {
      resolveUpload = resolve;
    });
    createTeamMutate.mockImplementation((_payload, opts) => opts?.onSuccess?.(sanLorenzo));
    setTeamLogoMutate.mockImplementation((_args, opts) => {
      uploadPending.then(() => {
        opts?.onSuccess?.({ team: sanLorenzo, stored: true });
        opts?.onSettled?.();
      });
    });

    fireEvent.click(within(form).getByRole('button', { name: 'Crear equipo' }));

    // Combined pending state: the form stays open with the upload label
    expect(within(form).getByText('Subiendo escudo...')).toBeDefined();
    expect(setTeamLogoMutate).toHaveBeenCalledWith({ teamId: 13, file }, expect.anything());

    // The upload resolves stored:true → the form closes
    await act(async () => {
      resolveUpload(undefined);
    });
    expect(screen.getByRole('button', { name: /Agregar equipo/ })).toBeDefined();
  });
});
