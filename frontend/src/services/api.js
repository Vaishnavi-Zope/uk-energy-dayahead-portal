import fallbackBundle from '../data/fallbackData.json';

// In production, uses VITE_API_URL if set (e.g. your Render or public backend URL).
// In local dev, Vite proxies /api to http://localhost:8000.
// If backend is not deployed or unreachable, seamlessly falls back to pre-indexed January 2026 data.
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export let isLiveBackendConnected = false;

export async function fetchDates() {
  try {
    const url = API_BASE_URL ? `${API_BASE_URL}/api/dates` : '/api/dates';
    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json();
      isLiveBackendConnected = true;
      return data;
    }
  } catch (err) {
    console.warn('Backend API unavailable, serving bundled January 2026 dataset:', err.message);
  }
  return { dates: fallbackBundle.dates };
}

export async function fetchDayCurves(date, cutoffHour = 11) {
  try {
    const url = API_BASE_URL
      ? `${API_BASE_URL}/api/day-curves?date=${date}&cutoffHour=${cutoffHour}`
      : `/api/day-curves?date=${date}&cutoffHour=${cutoffHour}`;
    const resp = await fetch(url);
    if (resp.ok) {
      isLiveBackendConnected = true;
      return await resp.json();
    }
  } catch (err) {
    console.warn(`Backend API unavailable for ${date}, using fallback day curve.`);
  }

  // Fallback to pre-indexed day data
  if (fallbackBundle.days && fallbackBundle.days[date]) {
    return fallbackBundle.days[date];
  }
  
  // If exact date not found, return first available day
  const firstAvailable = Object.values(fallbackBundle.days || {})[0];
  if (firstAvailable) return firstAvailable;

  throw new Error(`No data available for ${date}`);
}

export async function fetchAnalyticsSummary(startDate = '2026-01-01', endDate = '2026-01-31', cutoffHour = 11) {
  try {
    const url = API_BASE_URL
      ? `${API_BASE_URL}/api/analytics/summary?startDate=${startDate}&endDate=${endDate}&cutoffHour=${cutoffHour}`
      : `/api/analytics/summary?startDate=${startDate}&endDate=${endDate}&cutoffHour=${cutoffHour}`;
    const resp = await fetch(url);
    if (resp.ok) {
      isLiveBackendConnected = true;
      return await resp.json();
    }
  } catch (err) {
    console.warn('Backend API unavailable for analytics summary, using fallback summary.');
  }

  return fallbackBundle.summary;
}

export async function simulateProcurement({ deliveryDate, cutoffHour = 11, baseDemandMw = 25000, confidenceLevel = 0.90 }) {
  try {
    const url = API_BASE_URL ? `${API_BASE_URL}/api/procurement/simulate` : '/api/procurement/simulate';
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delivery_date: deliveryDate,
        cutoff_hour: cutoffHour,
        base_demand_mw: baseDemandMw,
        confidence_level: confidenceLevel,
      }),
    });
    if (resp.ok) {
      isLiveBackendConnected = true;
      return await resp.json();
    }
  } catch (err) {
    console.warn('Backend API unavailable for procurement simulation, running client-side simulation.');
  }

  // Client-side simulation fallback
  return runClientSideProcurementSimulation(deliveryDate, baseDemandMw, confidenceLevel);
}

function runClientSideProcurementSimulation(deliveryDate, baseDemandMw, confidenceLevel) {
  const dayData = fallbackBundle.days?.[deliveryDate] || Object.values(fallbackBundle.days || {})[0];
  const quantiles = fallbackBundle.summary?.metrics?.quantiles || {
    p50_mw: 1450,
    p75_mw: 2850,
    p90_mw: 4340,
    p95_mw: 5200,
  };

  let bufferMw = 0;
  if (confidenceLevel <= 0.50) bufferMw = Math.max(0, quantiles.p50_mw || 0);
  else if (confidenceLevel <= 0.75) bufferMw = Math.max(0, quantiles.p75_mw || 0);
  else if (confidenceLevel <= 0.90) bufferMw = Math.max(0, quantiles.p90_mw || 0);
  else bufferMw = Math.max(0, quantiles.p95_mw || 0);

  const demandFactors = [
    0.72, 0.70, 0.68, 0.66, 0.65, 0.65, 0.67, 0.71,
    0.78, 0.85, 0.95, 1.05, 1.10, 1.12, 1.14, 1.15,
    1.14, 1.12, 1.10, 1.08, 1.06, 1.05, 1.04, 1.03,
    1.02, 1.02, 1.03, 1.04, 1.06, 1.10, 1.15, 1.20,
    1.25, 1.28, 1.27, 1.24, 1.18, 1.12, 1.05, 0.98,
    0.92, 0.86, 0.82, 0.78, 0.75, 0.74, 0.73, 0.71,
  ];

  let totalNaiveMwh = 0;
  let totalAdjustedMwh = 0;
  let totalNaiveShortageMwh = 0;
  let totalAdjustedShortageMwh = 0;

  const periodsResult = (dayData?.half_hourly || []).map((sp, i) => {
    const factor = demandFactors[i] ?? 1.0;
    const demandSp = Math.round(baseDemandMw * factor * 10) / 10;
    const fcWind = sp.forecast_mw ?? 0.0;
    const actWind = sp.actual_mw ?? 0.0;

    const naiveThermal = Math.max(0, demandSp - fcWind);
    const adjustedThermal = Math.max(0, demandSp - fcWind + bufferMw);

    const naiveSupplied = naiveThermal + actWind;
    const adjustedSupplied = adjustedThermal + actWind;

    const naiveShortage = Math.max(0, demandSp - naiveSupplied);
    const adjustedShortage = Math.max(0, demandSp - adjustedSupplied);

    totalNaiveMwh += naiveThermal * 0.5;
    totalAdjustedMwh += adjustedThermal * 0.5;
    totalNaiveShortageMwh += naiveShortage * 0.5;
    totalAdjustedShortageMwh += adjustedShortage * 0.5;

    return {
      settlement_period: sp.settlement_period,
      time_label: sp.time_label,
      demand_mw: demandSp,
      forecast_wind_mw: fcWind,
      actual_wind_mw: actWind,
      naive_procurement_mw: Math.round(naiveThermal * 10) / 10,
      adjusted_procurement_mw: Math.round(adjustedThermal * 10) / 10,
      buffer_mw: Math.round(bufferMw * 10) / 10,
      naive_shortage_mw: Math.round(naiveShortage * 10) / 10,
      adjusted_shortage_mw: Math.round(adjustedShortage * 10) / 10,
    };
  });

  const cashoutSpread = 85.0;
  const naivePenaltyCost = Math.round(totalNaiveShortageMwh * cashoutSpread * 100) / 100;
  const adjustedPenaltyCost = Math.round(totalAdjustedShortageMwh * cashoutSpread * 100) / 100;
  const estimatedSavings = Math.max(0, Math.round((naivePenaltyCost - adjustedPenaltyCost) * 100) / 100);

  return {
    delivery_date: deliveryDate,
    base_demand_mw: baseDemandMw,
    confidence_level: confidenceLevel,
    recommended_buffer_mw: Math.round(bufferMw * 10) / 10,
    summary: {
      total_naive_procurement_gwh: Math.round((totalNaiveMwh / 1000) * 100) / 100,
      total_adjusted_procurement_gwh: Math.round((totalAdjustedMwh / 1000) * 100) / 100,
      naive_shortage_exposure_mwh: Math.round(totalNaiveShortageMwh * 10) / 10,
      adjusted_shortage_exposure_mwh: Math.round(totalAdjustedShortageMwh * 10) / 10,
      shortage_reduction_pct: totalNaiveShortageMwh > 0
        ? Math.round(((totalNaiveShortageMwh - totalAdjustedShortageMwh) / totalNaiveShortageMwh) * 1000) / 10
        : 100.0,
      estimated_cashout_savings_gbp: estimatedSavings,
    },
    half_hourly: periodsResult,
  };
}
