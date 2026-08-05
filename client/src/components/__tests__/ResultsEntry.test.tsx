import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import ResultsEntry from '../admin/ResultsEntry';
import type { TournamentDateDTO } from '../../api/admin-api';

// --- Mocks ---

vi.mock('../../hooks/use-matches', () => ({
  useCurrentMatches: vi.fn(),
  // Default: no matches loaded for a specific date until a test sets them
  useMatchesByDate: vi.fn(() => ({
    data: { matchDate: null, matches: [] },
    isLoading: false,
    error: null,
  })),
}));

const { publishMutate, setResultMutate, setResultHandlers } = vi.hoisted(() => {
  const publishMutate = vi.fn();
  const setResultMutate = vi.fn();
  const setResultHandlers: {
    onSuccess?: () => void;
    onError?: (error: unknown) => void;
  } = {};
  // Capture the react-query mutate callbacks so tests can simulate success/error
  // (a plain vi.fn() would swallow the handlers and the UI could never progress).
  setResultMutate.mockImplementation(
    (_payload: unknown, handlers?: { onSuccess?: () => void; onError?: (error: unknown) => void }) => {
      setResultHandlers.onSuccess = handlers?.onSuccess;
      setResultHandlers.onError = handlers?.onError;
    },
  );
  return { publishMutate, setResultMutate, setResultHandlers };
});

vi.mock('../../hooks/use-admin', () => ({
  useAdminTournaments: vi.fn(),
  useSetMatchResult: () => ({
    mutate: setResultMutate,
    isSuccess: false,
    isError: false,
    variables: null,
  }),
  useCloseDate: () => ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    error: null,
  }),
  usePublishResults: vi.fn(() => ({
    mutate: publishMutate,
    isPending: false,
    isSuccess: false,
    error: null,
  })),
}));

import { useCurrentMatches, useMatchesByDate } from '../../hooks/use-matches';
import { useAdminTournaments, usePublishResults } from '../../hooks/use-admin';

afterEach(() => {
  cleanup();
  publishMutate.mockClear();
  setResultMutate.mockClear();
  setResultHandlers.onSuccess = undefined;
  setResultHandlers.onError = undefined;
  vi.mocked(useMatchesByDate).mockClear();
});

const openDate: TournamentDateDTO = {
  id: 1,
  dateNumber: 3,
  status: 'open',
  pozo: 0,
  betAmount: 1500,
  commission: 15,
  winners: [],
};

const closedDate: TournamentDateDTO = {
  id: 2,
  dateNumber: 4,
  status: 'closed',
  pozo: 5700,
  betAmount: 1500,
  commission: 10,
  winners: [],
};

const resultsDate: TournamentDateDTO = {
  id: 3,
  dateNumber: 5,
  status: 'results',
  pozo: 1000,
  betAmount: 1500,
  commission: 15,
  winners: [
    { ticketId: 7, userId: 'u1', username: 'ana', prize: 334 },
    { ticketId: 8, userId: 'u2', username: 'leo', prize: 333 },
  ],
};

const openMatches = [
  { id: 11, matchDateId: 1, localTeam: 'River Plate', visitorTeam: 'Boca Juniors', result: null, score: null },
  { id: 12, matchDateId: 1, localTeam: 'Racing', visitorTeam: 'Independiente', result: null, score: null },
];

// Single-match closed-date fixtures for the two-score entry interactions
const savedMatch = {
  id: 21, matchDateId: 2, localTeam: 'River Plate', visitorTeam: 'Boca Juniors', result: 'L', score: '2-1',
};
const noResultMatch = {
  id: 22, matchDateId: 2, localTeam: 'Racing', visitorTeam: 'Independiente', result: null, score: null,
};

function mockTournaments(dates: TournamentDateDTO[]) {
  vi.mocked(useAdminTournaments).mockReturnValue({
    data: [
      {
        id: 1,
        name: 'Torneo 1',
        commission: 15,
        status: 'active',
        finishedAt: null,
        carryover: 0,
        createdAt: '2026-07-28T00:00:00.000Z',
        dates,
      },
    ],
    isLoading: false,
    error: null,
  } as any);
}

function mockCurrent(matchDate: TournamentDateDTO | null, matches: unknown[] = []) {
  vi.mocked(useCurrentMatches).mockReturnValue({
    data: { matchDate, matches, carryover: 0 },
    isLoading: false,
    error: null,
  } as any);
}

function mockMatchesByDate(matches: unknown[]) {
  vi.mocked(useMatchesByDate).mockReturnValue({
    data: { matchDate: null, matches },
    isLoading: false,
    error: null,
  } as any);
}

describe('ResultsEntry', () => {
  it('shows match cards and close button when the date is open', () => {
    mockTournaments([openDate]);
    mockCurrent(openDate, openMatches);

    render(<ResultsEntry />);
    expect(screen.getByText('Resultados — Fecha 3')).toBeDefined();
    expect(screen.getByText(/Procesar y Cerrar Puntos de la Fecha/)).toBeDefined();
    // Team names render across nested nodes ("River Plate" <span>vs</span> "Boca Juniors")
    expect(screen.getByText(/River Plate/)).toBeDefined();
    expect(screen.getByText(/Boca Juniors/)).toBeDefined();
    expect(screen.getByText(/Racing/)).toBeDefined();
    expect(screen.getByText(/Independiente/)).toBeDefined();
    // Publish button must NOT be shown while open
    expect(screen.queryByText(/Publicar resultados y pagar/)).toBeNull();
  });

  it('shows publish button and financials when the date is closed', () => {
    mockTournaments([closedDate]);
    mockCurrent(null);

    render(<ResultsEntry />);
    expect(screen.getByText(/Publicar resultados y pagar/)).toBeDefined();
    expect(screen.getByText('Pozo')).toBeDefined();
    expect(screen.getByText('$57.00')).toBeDefined();
    expect(screen.getByText('Comisión de la casa')).toBeDefined();
    expect(screen.getByText('10%')).toBeDefined();
    // Close button must NOT be shown while closed
    expect(screen.queryByText(/Procesar y Cerrar Puntos de la Fecha/)).toBeNull();
  });

  it('loads a closed date\'s matches so results can be corrected before publishing', () => {
    mockTournaments([closedDate]);
    mockCurrent(null);
    const closedMatches = [
      { id: 21, matchDateId: 2, localTeam: 'River Plate', visitorTeam: 'Boca Juniors', result: 'L', score: '2-1' },
      { id: 22, matchDateId: 2, localTeam: 'Racing', visitorTeam: 'Independiente', result: null, score: null },
    ];
    mockMatchesByDate(closedMatches);

    render(<ResultsEntry />);
    // The closed date's matches come from the per-date endpoint, not /current
    expect(useMatchesByDate).toHaveBeenCalledWith(closedDate.id);
    expect(screen.getByText(/River Plate/)).toBeDefined();
    expect(screen.getByText(/Racing/)).toBeDefined();
    // The admin can still review and publish after correcting results
    expect(screen.getByText(/Publicar resultados y pagar/)).toBeDefined();
  });

  it('shows winners breakdown and commission when results are published', () => {
    mockTournaments([resultsDate]);
    mockCurrent(null);

    render(<ResultsEntry />);
    expect(screen.getByText('Ganadores')).toBeDefined();
    expect(screen.getByText(/Ticket #7 — ana/)).toBeDefined();
    expect(screen.getByText('$3.34')).toBeDefined();
    expect(screen.getByText(/Ticket #8 — leo/)).toBeDefined();
    expect(screen.getByText('$3.33')).toBeDefined();
    expect(screen.getByText('15%')).toBeDefined();
    expect(screen.queryByText(/Publicar resultados y pagar/)).toBeNull();
  });

  it('shows a carryover note when a published date had no winners', () => {
    mockTournaments([{ ...resultsDate, winners: [] }]);
    mockCurrent(null);

    render(<ResultsEntry />);
    expect(screen.getByText(/Sin ganadores/)).toBeDefined();
    expect(screen.getByText(/se acumuló para la próxima fecha/)).toBeDefined();
  });

  it('asks for confirmation before publishing and aborts when declined', () => {
    mockTournaments([closedDate]);
    mockCurrent(null);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<ResultsEntry />);
    fireEvent.click(screen.getByRole('button', { name: /Publicar resultados y pagar/ }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // Confirmation shows the pozo snapshot
    expect(confirmSpy.mock.calls[0][0]).toContain('$57.00');
    // Declined → no mutation fired
    expect(publishMutate).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('publishes after the admin confirms', () => {
    mockTournaments([closedDate]);
    mockCurrent(null);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ResultsEntry />);
    fireEvent.click(screen.getByRole('button', { name: /Publicar resultados y pagar/ }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(publishMutate).toHaveBeenCalledWith(2); // closedDate.id

    confirmSpy.mockRestore();
  });

  it('disables the publish button once results are published', () => {
    mockTournaments([closedDate]);
    mockCurrent(null);
    vi.mocked(usePublishResults).mockReturnValue({
      mutate: publishMutate,
      isPending: false,
      isSuccess: true,
      error: null,
      variables: 2, // closedDate.id — the keyed guard only disables for the published date
    } as any);

    render(<ResultsEntry />);
    const button = screen.getByRole('button', { name: /Publicar resultados y pagar/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('does not list open dates from other tournaments in the selector', () => {    const otherOpenDate: TournamentDateDTO = {
      id: 5,
      dateNumber: 1,
      status: 'open',
      pozo: 0,
      betAmount: 1500,
      commission: 15,
      winners: [],
    };
    vi.mocked(useAdminTournaments).mockReturnValue({
      data: [
        {
          id: 1,
          name: 'Torneo 1',
          commission: 15,
          status: 'active',
          finishedAt: null,
          carryover: 0,
          createdAt: '2026-07-28T00:00:00.000Z',
          dates: [openDate],
        },
        {
          id: 2,
          name: 'Torneo 2',
          commission: 15,
          status: 'active',
          finishedAt: null,
          carryover: 0,
          createdAt: '2026-07-28T00:00:00.000Z',
          dates: [otherOpenDate],
        },
      ],
      isLoading: false,
      error: null,
    } as any);
    mockCurrent(openDate, openMatches);

    render(<ResultsEntry />);
    // First combobox is the date selector (result selects come after it)
    const select = screen.getAllByRole('combobox')[0];
    // The current open date is listed; the other tournament's open date is NOT
    // (its matches cannot be shown and saving would patch the wrong date).
    expect(select.textContent).toContain('Fecha 3');
    expect(select.textContent).not.toContain('Fecha 1');
    // Matches rendered belong to the current open date
    expect(screen.getByText(/River Plate/)).toBeDefined();
  });

  it('does not list dates from finished tournaments in the selector', () => {
    const finishedDate: TournamentDateDTO = {
      id: 7,
      dateNumber: 1,
      status: 'closed',
      pozo: 2000,
      betAmount: 1500,
      commission: 15,
      winners: [],
    };
    vi.mocked(useAdminTournaments).mockReturnValue({
      data: [
        {
          id: 1,
          name: 'Torneo 1',
          commission: 15,
          status: 'active',
          finishedAt: null,
          carryover: 0,
          createdAt: '2026-07-28T00:00:00.000Z',
          dates: [openDate],
        },
        {
          id: 2,
          name: 'Torneo 2',
          commission: 15,
          status: 'finished',
          finishedAt: '2026-08-01T00:00:00.000Z',
          carryover: 0,
          createdAt: '2026-07-28T00:00:00.000Z',
          dates: [finishedDate],
        },
      ],
      isLoading: false,
      error: null,
    } as any);
    mockCurrent(openDate, openMatches);

    render(<ResultsEntry />);
    // First combobox is the date selector
    const select = screen.getAllByRole('combobox')[0];
    // Only the active tournament's dates are selectable — the finished one is frozen
    expect(select.textContent).toContain('Fecha 3');
    expect(select.textContent).not.toContain('Fecha 1');
  });

  it('keeps a manual date selection when the current date changes', () => {
    mockTournaments([openDate, closedDate]);
    mockCurrent(openDate, openMatches);

    const { rerender } = render(<ResultsEntry />);
    // First combobox is the date selector (result selects come after it)
    const dateSelect = screen.getAllByRole('combobox')[0];
    // Admin picks the closed date manually
    fireEvent.change(dateSelect, { target: { value: String(closedDate.id) } });
    expect((screen.getAllByRole('combobox')[0] as HTMLSelectElement).value).toBe(String(closedDate.id));

    // /matches/current resolves again with a different open date
    mockCurrent({ ...openDate, id: 99 });
    rerender(<ResultsEntry />);

    // Manual selection survives — it is NOT reset to the new open date
    expect((screen.getAllByRole('combobox')[0] as HTMLSelectElement).value).toBe(String(closedDate.id));
  });

  describe('two-score entry (PR 4)', () => {
    it('renders local and visitor score inputs for every match', () => {
      mockTournaments([openDate]);
      mockCurrent(openDate, openMatches);

      render(<ResultsEntry />);

      // Local inputs carry placeholder "2", Visita inputs placeholder "1"
      expect(screen.getAllByPlaceholderText('2')).toHaveLength(2);
      expect(screen.getAllByPlaceholderText('1')).toHaveLength(2);
    });

    it('prefills both inputs from a persisted score', () => {
      mockTournaments([closedDate]);
      mockCurrent(null);
      mockMatchesByDate([savedMatch]);

      render(<ResultsEntry />);

      expect((screen.getByPlaceholderText('2') as HTMLInputElement).value).toBe('2');
      expect((screen.getByPlaceholderText('1') as HTMLInputElement).value).toBe('1');
    });

    it("prefills 'x' when a winner was saved without a score", () => {
      mockTournaments([closedDate]);
      mockCurrent(null);
      mockMatchesByDate([{ ...savedMatch, result: 'L', score: null }]);

      render(<ResultsEntry />);

      expect((screen.getByPlaceholderText('2') as HTMLInputElement).value).toBe('x');
      expect((screen.getByPlaceholderText('1') as HTMLInputElement).value).toBe('');
    });

    it('keeps Guardar hidden until the inputs are dirty AND valid', () => {
      mockTournaments([closedDate]);
      mockCurrent(null);
      mockMatchesByDate([noResultMatch]);

      render(<ResultsEntry />);

      // Untouched (both empty) → no Guardar
      expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();

      const local = screen.getByPlaceholderText('2');

      // One side empty without 'x' → invalid → hidden
      fireEvent.change(local, { target: { value: '3' } });
      expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();

      // Out-of-range → invalid → hidden
      fireEvent.change(local, { target: { value: '21' } });
      expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();

      // Back to a valid local, fill the visitor → Guardar appears
      fireEvent.change(local, { target: { value: '3' } });
      fireEvent.change(screen.getByPlaceholderText('1'), { target: { value: '2' } });
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeDefined();
    });

    it('shows the exact Spanish message for invalid input on interaction', () => {
      mockTournaments([closedDate]);
      mockCurrent(null);
      mockMatchesByDate([noResultMatch]);

      render(<ResultsEntry />);

      fireEvent.change(screen.getByPlaceholderText('2'), { target: { value: '21' } });
      fireEvent.change(screen.getByPlaceholderText('1'), { target: { value: '2' } });

      expect(screen.getByText('Ingresá un marcador válido (0 a 20)')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
    });

    it('shows the one-empty hint when only one side is filled', () => {
      mockTournaments([closedDate]);
      mockCurrent(null);
      mockMatchesByDate([noResultMatch]);

      render(<ResultsEntry />);

      fireEvent.change(screen.getByPlaceholderText('2'), { target: { value: '3' } });

      expect(screen.getByText("Usá números o 'x' para ganador sin marcador")).toBeDefined();
    });

    it('calls setResult with the raw score inputs when Guardar is clicked', () => {
      mockTournaments([closedDate]);
      mockCurrent(null);
      mockMatchesByDate([noResultMatch]);

      render(<ResultsEntry />);

      fireEvent.change(screen.getByPlaceholderText('2'), { target: { value: '2' } });
      fireEvent.change(screen.getByPlaceholderText('1'), { target: { value: '1' } });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(setResultMutate).toHaveBeenCalledWith(
        { matchId: noResultMatch.id, localScore: '2', visitorScore: '1' },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      );
    });

    it('replaces Guardar with a green checkmark after a successful save', () => {
      mockTournaments([closedDate]);
      mockCurrent(null);
      mockMatchesByDate([noResultMatch]);

      render(<ResultsEntry />);

      fireEvent.change(screen.getByPlaceholderText('2'), { target: { value: '2' } });
      fireEvent.change(screen.getByPlaceholderText('1'), { target: { value: '1' } });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(setResultHandlers.onSuccess).toBeDefined();
      act(() => {
        setResultHandlers.onSuccess?.();
      });

      expect(screen.getByText('✓')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
    });

    it('restores Guardar when the admin edits a saved entry', () => {
      mockTournaments([closedDate]);
      mockCurrent(null);
      mockMatchesByDate([savedMatch]);

      render(<ResultsEntry />);

      // Saved result → checkmark shown, Guardar hidden
      expect(screen.getByText('✓')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();

      fireEvent.change(screen.getByPlaceholderText('2'), { target: { value: '3' } });

      expect(screen.queryByText('✓')).toBeNull();
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeDefined();
    });

    it('shows Limpiar only for saved results and clears via an empty payload', () => {
      mockTournaments([closedDate]);
      mockCurrent(null);
      mockMatchesByDate([savedMatch, noResultMatch]);

      render(<ResultsEntry />);

      // Only the match with a persisted result gets a Limpiar button
      const limpiar = screen.getAllByRole('button', { name: 'Limpiar' });
      expect(limpiar).toHaveLength(1);

      fireEvent.click(limpiar[0]);

      expect(setResultMutate).toHaveBeenCalledWith(
        { matchId: savedMatch.id, localScore: '', visitorScore: '' },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      );
    });

    it('removes the checkmark and empties the inputs after Limpiar succeeds', () => {
      mockTournaments([closedDate]);
      mockCurrent(null);
      mockMatchesByDate([savedMatch]);

      render(<ResultsEntry />);

      expect(screen.getByText('✓')).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
      act(() => {
        setResultHandlers.onSuccess?.();
      });

      expect(screen.queryByText('✓')).toBeNull();
      expect((screen.getByPlaceholderText('2') as HTMLInputElement).value).toBe('');
      expect((screen.getByPlaceholderText('1') as HTMLInputElement).value).toBe('');
    });

    it('surfaces the server error message and keeps Guardar for retry', () => {
      mockTournaments([closedDate]);
      mockCurrent(null);
      mockMatchesByDate([noResultMatch]);

      render(<ResultsEntry />);

      fireEvent.change(screen.getByPlaceholderText('2'), { target: { value: '2' } });
      fireEvent.change(screen.getByPlaceholderText('1'), { target: { value: '1' } });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      act(() => {
        setResultHandlers.onError?.({
          response: { data: { message: 'Ingresá un marcador válido (0 a 20)' } },
        });
      });

      expect(screen.getByText('Ingresá un marcador válido (0 a 20)')).toBeDefined();
      // Button returns for retry
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeDefined();
    });

    it('resyncs non-dirty entries after a refetch but preserves in-flight edits', () => {
      mockTournaments([closedDate]);
      mockCurrent(null);
      mockMatchesByDate([savedMatch, noResultMatch]);

      const { rerender } = render(<ResultsEntry />);

      // Admin edits the second match (no result yet) — becomes dirty
      const localInputs = screen.getAllByPlaceholderText('2');
      fireEvent.change(localInputs[1], { target: { value: '3' } });

      // Refetch lands: the first match keeps its saved result, the second is now persisted
      mockMatchesByDate([savedMatch, { ...noResultMatch, result: 'L', score: '3-1' }]);
      rerender(<ResultsEntry />);

      const localInputsAfter = screen.getAllByPlaceholderText('2');
      // Dirty entry keeps the in-flight edit (not clobbered by the resync)
      expect((localInputsAfter[1] as HTMLInputElement).value).toBe('3');
      // Non-dirty entry resets to the persisted baseline
      expect((localInputsAfter[0] as HTMLInputElement).value).toBe('2');
    });
  });
});
