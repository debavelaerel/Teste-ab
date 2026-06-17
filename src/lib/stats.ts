// Abramowitz & Stegun normal CDF approximation (error < 7.5e-8)
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const poly =
    t * (0.319381530 +
    t * (-0.356563782 +
    t * (1.781477937 +
    t * (-1.821255978 +
    t * 1.330274429))))
  const pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)
  const cdf = z >= 0 ? 1 - pdf * poly : pdf * poly
  return cdf
}

/**
 * Two-proportion Z-test.
 * Returns confidence as a value between 0 and 1, or null if not enough data.
 * control: the baseline (variant A)
 * test: the variant being compared
 */
export function calcConfidence(
  controlVisits: number,
  controlConversions: number,
  testVisits: number,
  testConversions: number,
): number | null {
  if (controlVisits < 30 || testVisits < 30) return null
  if (controlConversions === 0 && testConversions === 0) return null

  const p1 = controlConversions / controlVisits
  const p2 = testConversions / testVisits
  const pPool =
    (controlConversions + testConversions) / (controlVisits + testVisits)
  const se = Math.sqrt(
    pPool * (1 - pPool) * (1 / controlVisits + 1 / testVisits),
  )
  if (se === 0) return null

  const z = Math.abs((p2 - p1) / se)
  // Two-tailed p-value → confidence
  const confidence = 2 * normalCDF(z) - 1
  return Math.max(0, Math.min(1, confidence))
}

export function fmtPct(n: number): string {
  return (n * 100).toFixed(2) + '%'
}
