const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function fetchDates() {
  const resp = await fetch(`${API_BASE_URL}/api/dates`);
  if (!resp.ok) throw new Error('Failed to fetch available dates');
  return await resp.json();
}

export async function fetchDayCurves(date, cutoffHour = 11) {
  const resp = await fetch(`${API_BASE_URL}/api/day-curves?date=${date}&cutoffHour=${cutoffHour}`);
  if (!resp.ok) throw new Error(`Failed to fetch day curves for ${date}`);
  return await resp.json();
}

export async function fetchAnalyticsSummary(startDate = '2026-01-01', endDate = '2026-01-31', cutoffHour = 11) {
  const resp = await fetch(`${API_BASE_URL}/api/analytics/summary?startDate=${startDate}&endDate=${endDate}&cutoffHour=${cutoffHour}`);
  if (!resp.ok) throw new Error('Failed to fetch analytics summary');
  return await resp.json();
}

export async function simulateProcurement({ deliveryDate, cutoffHour = 11, baseDemandMw = 25000, confidenceLevel = 0.90 }) {
  const resp = await fetch(`${API_BASE_URL}/api/procurement/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      delivery_date: deliveryDate,
      cutoff_hour: cutoffHour,
      base_demand_mw: baseDemandMw,
      confidence_level: confidenceLevel,
    }),
  });
  if (!resp.ok) throw new Error('Failed to run procurement simulation');
  return await resp.json();
}

