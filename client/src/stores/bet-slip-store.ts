import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Prediction } from '../types';

/**
 * Bet slip store — tracks user's predictions before payment.
 * Persisted to localStorage so selections survive page refreshes.
 */
interface BetSlipState {
  /** Map of matchId → prediction */
  predictions: Record<string, Prediction>;

  /** Set or toggle a prediction */
  setPrediction: (matchId: string, prediction: Prediction) => void;

  /** Clear a single prediction */
  removePrediction: (matchId: string) => void;

  /** Clear all predictions */
  reset: () => void;

  /** Get current predictions object */
  getPredictions: () => Record<string, Prediction>;

  /** Number of predictions currently set */
  count: () => number;
}

export const useBetSlipStore = create<BetSlipState>()(
  persist(
    (set, get) => ({
      predictions: {},

      setPrediction: (matchId, prediction) => {
        const current = get().predictions[matchId];
        // If same prediction clicked again, remove it (toggle off)
        if (current === prediction) {
          set((state) => {
            const next = { ...state.predictions };
            delete next[matchId];
            return { predictions: next };
          });
        } else {
          // Set or change prediction
          set((state) => ({
            predictions: { ...state.predictions, [matchId]: prediction },
          }));
        }
      },

      removePrediction: (matchId) => {
        set((state) => {
          const next = { ...state.predictions };
          delete next[matchId];
          return { predictions: next };
        });
      },

      reset: () => set({ predictions: {} }),

      getPredictions: () => get().predictions,

      count: () => Object.keys(get().predictions).length,
    }),
    {
      name: 'bet-slip-storage',
    },
  ),
);
