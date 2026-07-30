/**
 * Prediction value object — represents a match outcome prediction.
 *
 * L = Local win (triunfo local)
 * E = Draw (empate)
 * V = Visitor win (triunfo visitante)
 */
export const PREDICTIONS = ['L', 'E', 'V'] as const;
export type Prediction = (typeof PREDICTIONS)[number];

export function isPrediction(value: string): value is Prediction {
  return PREDICTIONS.includes(value as Prediction);
}

export function assertPrediction(value: string): asserts value is Prediction {
  if (!isPrediction(value)) {
    throw new Error(`Invalid prediction: "${value}". Must be one of: L, E, V`);
  }
}
