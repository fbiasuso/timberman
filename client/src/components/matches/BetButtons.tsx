import type { CSSProperties } from 'react';
import type { Prediction } from '../../types';
import { useBetSlipStore } from '../../stores/bet-slip-store';
import theme from '../../styles/theme';

interface BetButtonsProps {
  /** Match ID as a string (for store key) */
  matchId: string;
  /** Disable buttons (match expired) */
  disabled: boolean;
  /** Current prediction for this match, if any */
  currentPrediction: Prediction | null;
  /**
   * 'row' (default): L/E/V side by side at the end of the match row.
   * 'grid': each button centered under its team column (mobile layout).
   */
  layout?: 'row' | 'grid';
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
export default function BetButtons({
  matchId,
  disabled,
  currentPrediction,
  layout = 'row',
}: BetButtonsProps) {
  const setPrediction = useBetSlipStore((s) => s.setPrediction);

  const handleClick = (prediction: Prediction) => {
    if (disabled) return;
    setPrediction(matchId, prediction);
  };

  const containerStyle: CSSProperties =
    layout === 'grid'
      ? { display: 'grid', gridTemplateColumns: '1fr 60px 1fr', gap: 16, width: '100%' }
      : { display: 'flex', gap: 6 };

  return (
    <div data-testid="bet-buttons" style={containerStyle}>
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
              justifySelf: layout === 'grid' ? 'center' : undefined,
              border: isSelected ? `2px solid ${colors.border}` : `2px solid ${theme.border}`,
              borderRadius: 8,
              background: isSelected ? colors.bg : theme.searchBg,
              color: isSelected ? colors.text : theme.textoSecundario,
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
  if (!isSelected) return { bg: theme.searchBg, border: theme.border, text: theme.textoSecundario };

  switch (value) {
    case 'L':
      return { bg: theme.betL, border: theme.headerBg, text: theme.blanco }; // green
    case 'E':
      return { bg: theme.betE, border: theme.amarilloBet, text: theme.amarilloBet }; // yellow
    case 'V':
      return { bg: theme.betV, border: theme.verdeBet, text: theme.blanco }; // green
  }
}
