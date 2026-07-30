import type { Prediction } from '../../types';
import { useBetSlipStore } from '../../stores/bet-slip-store';

interface BetButtonsProps {
  /** Match ID as a string (for store key) */
  matchId: string;
  /** Disable buttons (match expired) */
  disabled: boolean;
  /** Current prediction for this match, if any */
  currentPrediction: Prediction | null;
}

const PREDICTIONS: { value: Prediction; label: string }[] = [
  { value: 'L', label: 'L' },
  { value: 'E', label: 'E' },
  { value: 'V', label: 'V' },
];

/**
 * Three outcome buttons: L / E / V
 * Highlights the selected one, toggles off if clicked again.
 */
export default function BetButtons({ matchId, disabled, currentPrediction }: BetButtonsProps) {
  const setPrediction = useBetSlipStore((s) => s.setPrediction);

  const handleClick = (prediction: Prediction) => {
    if (disabled) return;
    setPrediction(matchId, prediction);
  };

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {PREDICTIONS.map(({ value, label }) => {
        const isSelected = currentPrediction === value;
        const colors = getButtonColors(value, isSelected);

        return (
          <button
            key={value}
            onClick={() => handleClick(value)}
            disabled={disabled}
            style={{
              width: 44,
              height: 44,
              border: isSelected ? `2px solid ${colors.border}` : '2px solid #d1d5db',
              borderRadius: 8,
              background: isSelected ? colors.bg : '#fff',
              color: isSelected ? colors.text : '#374151',
              fontWeight: 700,
              fontSize: 16,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.4 : 1,
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={
              value === 'L'
                ? 'Local'
                : value === 'E'
                  ? 'Empate'
                  : 'Visitante'
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function getButtonColors(
  value: Prediction,
  isSelected: boolean,
): { bg: string; border: string; text: string } {
  if (!isSelected) return { bg: '#fff', border: '#d1d5db', text: '#374151' };

  switch (value) {
    case 'L':
      return { bg: '#dcfce7', border: '#16a34a', text: '#15803d' }; // green
    case 'E':
      return { bg: '#fef9c3', border: '#ca8a04', text: '#a16207' }; // yellow
    case 'V':
      return { bg: '#dcfce7', border: '#16a34a', text: '#15803d' }; // green
  }
}
