import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import MatchRow from '../admin/MatchRow';
import type { MatchDTO } from '../../types';

// --- Mocks ---

const { updateDetailsMutate } = vi.hoisted(() => ({ updateDetailsMutate: vi.fn() }));

vi.mock('../../hooks/use-admin', () => ({
  useUpdateMatchDetails: vi.fn(() => ({
    mutate: updateDetailsMutate,
    isPending: false,
    isError: false,
    error: null,
  })),
}));

import { useUpdateMatchDetails } from '../../hooks/use-admin';

afterEach(() => {
  cleanup();
  updateDetailsMutate.mockClear();
  vi.mocked(useUpdateMatchDetails).mockReset();
  vi.mocked(useUpdateMatchDetails).mockReturnValue({
    mutate: updateDetailsMutate,
    isPending: false,
    isError: false,
    error: null,
  } as any);
});

// --- Fixtures ---

/** Local wall-clock 15:30 — round-trips through ISO regardless of the test TZ */
const scheduledIso = new Date(2026, 7, 2, 15, 30).toISOString();

const openMatch: MatchDTO = {
  id: 11,
  matchDateId: 2,
  localTeam: 'River Plate',
  visitorTeam: 'Boca Juniors',
  localImg: null,
  visitorImg: null,
  localTeamId: null,
  visitorTeamId: null,
  scheduledAt: null,
  result: null,
  score: null,
};

const closedMatch: MatchDTO = {
  id: 21,
  matchDateId: 1,
  localTeam: 'Gimnasia',
  visitorTeam: 'Estudiantes',
  localImg: 'http://localhost/gimnasia.png',
  visitorImg: 'http://localhost/estudiantes.png',
  localTeamId: null,
  visitorTeamId: null,
  scheduledAt: scheduledIso,
  result: 'L',
  score: '2-1',
};

// --- Tests ---

describe('MatchRow', () => {
  describe('read-only mode (closed / results dates)', () => {
    it('renders teams, shields, schedule and result without edit controls', () => {
      render(<MatchRow match={closedMatch} editable={false} />);

      expect(screen.getByText(/Gimnasia/)).toBeDefined();
      expect(screen.getByText(/Estudiantes/)).toBeDefined();
      // Both shields render
      expect(screen.getByAltText('Gimnasia')).toBeDefined();
      expect(screen.getByAltText('Estudiantes')).toBeDefined();
      // Schedule renders as date + time (locale formatting may vary the time part)
      expect(screen.getByText(/02\/08\/2026/)).toBeDefined();
      // Result + score
      expect(screen.getByText('L (2-1)')).toBeDefined();

      // No edit controls and no save action
      expect(screen.queryByLabelText('Equipo Local')).toBeNull();
      expect(screen.queryByRole('button', { name: /Guardar/ })).toBeNull();
    });

    it('shows a dash when a read-only match has no result', () => {
      render(
        <MatchRow match={{ ...openMatch, result: null, score: null }} editable={false} />,
      );
      expect(screen.getByText('—')).toBeDefined();
    });
  });

  describe('editable mode (open date)', () => {
    it('renders editable inputs with the current values and a save button', () => {
      render(<MatchRow match={openMatch} editable />);

      expect(screen.getByDisplayValue('River Plate')).toBeDefined();
      expect(screen.getByDisplayValue('Boca Juniors')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeDefined();
    });

    it('keeps the save button disabled until a field changes', () => {
      render(<MatchRow match={openMatch} editable />);
      const saveBtn = screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(true);

      fireEvent.change(screen.getByLabelText('Equipo Local'), {
        target: { value: 'San Lorenzo' },
      });
      expect(
        (screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement).disabled,
      ).toBe(false);
    });

    it('saves only the changed fields via useUpdateMatchDetails', () => {
      render(<MatchRow match={openMatch} editable />);

      fireEvent.change(screen.getByLabelText('Equipo Local'), {
        target: { value: 'San Lorenzo' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(updateDetailsMutate).toHaveBeenCalledWith({
        matchId: 11,
        localTeam: 'San Lorenzo',
      });
    });

    it('saves image URLs and the schedule when changed', () => {
      render(<MatchRow match={{ ...openMatch, localImg: 'http://localhost/river.png' }} editable />);

      fireEvent.change(screen.getByLabelText('Escudo Visitante (URL)'), {
        target: { value: 'http://localhost/boca.png' },
      });
      fireEvent.change(screen.getByLabelText('Fecha y Horario'), {
        target: { value: '2026-08-02T15:30' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(updateDetailsMutate).toHaveBeenCalledWith({
        matchId: 11,
        visitorImg: 'http://localhost/boca.png',
        scheduledAt: scheduledIso,
      });
    });

    it('sends null to clear an image URL that was emptied', () => {
      render(<MatchRow match={{ ...openMatch, localImg: 'http://localhost/river.png' }} editable />);

      fireEvent.change(screen.getByLabelText('Escudo Local (URL)'), {
        target: { value: '   ' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(updateDetailsMutate).toHaveBeenCalledWith({
        matchId: 11,
        localImg: null,
      });
    });

    it('shows a pending state and disables the save button while saving', () => {
      const view = render(<MatchRow match={openMatch} editable />);
      fireEvent.change(screen.getByLabelText('Equipo Local'), {
        target: { value: 'San Lorenzo' },
      });

      vi.mocked(useUpdateMatchDetails).mockReturnValue({
        mutate: updateDetailsMutate,
        isPending: true,
        isError: false,
        error: null,
      } as any);
      view.rerender(<MatchRow match={openMatch} editable />);

      const saveBtn = screen.getByRole('button', { name: 'Guardando...' }) as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(true);
    });

    it('shows an error message when the save fails', () => {
      vi.mocked(useUpdateMatchDetails).mockReturnValue({
        mutate: updateDetailsMutate,
        isPending: false,
        isError: true,
        error: { response: { data: { message: 'La fecha no está abierta' } } },
      } as any);

      render(<MatchRow match={openMatch} editable />);
      expect(screen.getByText(/No se pudo guardar el partido/)).toBeDefined();
    });

    it('re-syncs inputs to the refetched match after a successful save', () => {
      const view = render(<MatchRow match={openMatch} editable />);
      fireEvent.change(screen.getByLabelText('Equipo Local'), {
        target: { value: 'San Lorenzo' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      // The save succeeds; invalidation refetches and the row shows the saved state
      view.rerender(<MatchRow match={{ ...openMatch, localTeam: 'San Lorenzo' }} editable />);

      expect(screen.getByDisplayValue('San Lorenzo')).toBeDefined();
      // Nothing changed vs the persisted match → save disables again
      expect(
        (screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement).disabled,
      ).toBe(true);
    });
  });
});
