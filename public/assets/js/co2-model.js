'use strict';

// ─── CO2 Dispersion Model (Gaussian Plume, Pasquill-Gifford) ───
// Parameters derived from flare volume: 35M MSCF/yr → Q = 60,600 g/s
// Effective stack height he = 75m (buoyant plume rise, 50-100m range)
// CO2 Atmospheric Dispersion Report (guide):
//   Q = 60,600 g/s for 35 MMSCF/yr flared gas (54.6 kg CO2/MSCF).
//   Ambient wind range 1.7 - 4.0 m/s (mean 2.85 m/s).
//   Pasquill Stability Class C (slightly unstable) / D (neutral).
//   Effective stack height he scales 50-100 m (modelled 75 m).
//   Peak ground-level impact radius (downwind reach before ambient blend):
//     1.7 m/s  -> 1.5 - 3.5 km
//     4.0 m/s  -> 0.8 - 2.0 km
//     2.85 m/s -> 1.2 - 2.5 km
//   Summary: effective dispersion radius stabilizes between 1.2 km and 2.5 km.

export var CO2_PARAMS = {
  Q: 60600,
  he: 75,
  maxExtent: 2500,
  windRange: { min: 1.7, max: 4.0 },
  peakRadius: { low: 1.2, high: 2.5 },
  spread: 1.5,
};

function sigmaY(x, stability) {
  if (stability === 'C') {
    return 0.22 * x / Math.sqrt(1 + 0.0001 * x);
  }
  return 0.16 * x / Math.sqrt(1 + 0.0001 * x);
}

function sigmaZ(x, stability) {
  if (stability === 'C') {
    return 0.20 * x;
  }
  return 0.14 * x / Math.sqrt(1 + 0.0003 * x);
}

export function gaussianPlume(x, y, Q, u, he, stability) {
  if (x <= 1) return 0;
  // Widen lateral spread so the plume footprint is roughly as wide as the
  // affected community (dispersion radius) rather than a narrow streak.
  var sy = sigmaY(x, stability) * CO2_PARAMS.spread;
  var sz = sigmaZ(x, stability);
  if (sy <= 0.01 || sz <= 0.01) return 0;
  return (Q / (Math.PI * u * sy * sz)) * Math.exp(-(y * y) / (2 * sy * sy)) * Math.exp(-(he * he) / (2 * sz * sz));
}

// Approximate community impact radius (peak ground-level dispersion radius
// from the guide): 2.5 km at low wind, shrinking linearly to 1.2 km at high
// wind. Matches the summary finding (1.2 - 2.5 km).
export function pollutionRadiusMeters(u) {
  var peak = CO2_PARAMS.peakRadius;
  var wMin = CO2_PARAMS.windRange.min;
  var wMax = CO2_PARAMS.windRange.max;
  var uc = Math.min(Math.max(u, wMin), wMax);
  var t = (uc - wMin) / (wMax - wMin);
  return (peak.high - (peak.high - peak.low) * t) * 1000;
}

export var SMOKE = {
  max: 400,
  ratePerSource: 6,
  lifeMin: 5,
  lifeMax: 11,
  turb: 30,
  sizeMin: 3,
  sizeMax: 9,
};
