export type ActivationId = 'tanh' | 'relu' | 'sigmoid' | 'linear';

export const ACTIVATIONS: ActivationId[] = ['tanh', 'relu', 'sigmoid', 'linear'];

export function sigmoid(z: number): number {
  if (z >= 0) return 1 / (1 + Math.exp(-z));
  const e = Math.exp(z);
  return e / (1 + e);
}

export function activate(id: ActivationId, z: number): number {
  switch (id) {
    case 'tanh':
      return Math.tanh(z);
    case 'relu':
      return z > 0 ? z : 0;
    case 'sigmoid':
      return sigmoid(z);
    case 'linear':
      return z;
  }
}

/** da/dz expressed with both z and a so each activation can use the cheaper form. */
export function activateDerivative(id: ActivationId, z: number, a: number): number {
  switch (id) {
    case 'tanh':
      return 1 - a * a;
    case 'relu':
      return z > 0 ? 1 : 0;
    case 'sigmoid':
      return a * (1 - a);
    case 'linear':
      return 1;
  }
}

/** Human-readable formula used by the inspector. */
export function activationFormula(id: ActivationId): string {
  switch (id) {
    case 'tanh':
      return 'tanh(z)';
    case 'relu':
      return 'max(0, z)';
    case 'sigmoid':
      return 'σ(z) = 1 / (1 + e⁻ᶻ)';
    case 'linear':
      return 'z';
  }
}
