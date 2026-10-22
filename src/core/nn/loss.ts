/**
 * Binary cross-entropy computed from the output logit for numerical stability:
 * L = max(z, 0) − z·y + log(1 + e^−|z|). Its gradient w.r.t. z is σ(z) − y.
 */
export function bceFromLogit(z: number, y: number): number {
  return Math.max(z, 0) - z * y + Math.log1p(Math.exp(-Math.abs(z)));
}
