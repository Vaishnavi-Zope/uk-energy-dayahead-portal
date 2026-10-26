import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { BarChart3, TrendingUp, AlertCircle, Clock, Calendar, ShieldAlert } from 'lucide-react';
import MetricCard from './MetricCard';
import { fetchAnalyticsSummary } from '../services/api';

export default function AccuracyAnalytics({ cutoffHour }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await fetchAnalyticsSummary('2026-01-01', '2026-01-31', cutoffHour);
        setAnalytics(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [cutoffHour]);

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Calculating January 2026 Forecast Error Distribution...</p>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', borderColor: 'var(--color-error-pos)' }}>
        <AlertCircle size={36} style={{ color: 'var(--color-error-pos)', margin: '0 auto 1rem' }} />
        <h3>Failed to load analytics</h3>
        <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
      </div>
    );
  }

  const m = analytics.metrics;
  const quantiles = m.quantiles;

  return (
    <div className="animate-fade">
      {/* Macro Scorecards */}
      <div className="kpi-grid">
        <MetricCard
          title="Monthly MAE"
          value={m.mae_mw.toLocaleString()}
          unit="MW"
          badgeText={`WAPE: ${m.wape_pct}%`}
          badgeType="cyan"
          subtext="Mean Absolute Deviation"
          icon={BarChart3}
        />
        <MetricCard
          title="Monthly RMSE"
          value={m.rmse_mw.toLocaleString()}
          unit="MW"
          badgeText="Quadratic Penalty"
          badgeType="amber"
          subtext="Standard risk metric"
          icon={TrendingUp}
        />
        <MetricCard
          title="Mean Forecast Bias"
          value={m.mean_bias_mw > 0 ? `+${m.mean_bias_mw}` : m.mean_bias_mw}
          unit="MW"
          badgeText={`+${m.mean_bias_pct}% of Generation`}
          badgeType={m.mean_bias_mw > 0 ? 'red' : 'green'}
          subtext="Persistent over-prediction"
          icon={ShieldAlert}
        />
        <MetricCard
          title="P90 Risk Margin"
          value={`+${quantiles.p90_mw?.toLocaleString()}`}
          unit="MW"
          badgeText="90% Tail Protection"
          badgeType="amber"
          subtext="Suggested thermal buffer"
          icon={AlertCircle}
        />
      </div>

      {/* Two Column Grid: Error Distribution Histogram & Diurnal Profile */}
      <div className="two-col-grid">
        {/* Error Distribution Histogram */}
        <div className="glass-panel chart-card">
          <div className="chart-header">
            <div className="chart-title-area">
              <h2>
                <BarChart3 size={18} style={{ color: 'var(--color-forecast)' }} />
                Forecast Error Distribution (MW)
              </h2>
              <p>Frequency distribution across 1,488 settlement periods in January 2026</p>
            </div>
          </div>

          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.histogram} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                <XAxis
                  dataKey="bin_start"
                  stroke="var(--text-muted)"
                  fontSize={10}
                  tickFormatter={(val) => `${val > 0 ? '+' : ''}${val}`}
                  angle={-35}
                  textAnchor="end"
                />
                <YAxis stroke="var(--text-muted)" fontSize={10} unit=" SPs" />
                <Tooltip
                  formatter={(value, name, props) => [`${value} periods (${props.payload.percentage}%)`, 'Frequency']}
                  labelFormatter={(val, payload) => payload?.[0]?.payload?.label || val}
                  contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)', borderRadius: '8px' }}
                />
                <ReferenceLine x={0} stroke="rgba(255, 255, 255, 0.3)" />
                <Bar
                  dataKey="count"
                  fill="#06b6d4"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <div>P10: <span className="mono" style={{ color: '#fff', fontWeight: 600 }}>{quantiles.p10_mw} MW</span></div>
            <div>P50 (Median): <span className="mono" style={{ color: '#fff', fontWeight: 600 }}>{quantiles.p50_mw} MW</span></div>
            <div>P90: <span className="mono" style={{ color: '#fff', fontWeight: 600 }}>+{quantiles.p90_mw} MW</span></div>
            <div>P95: <span className="mono" style={{ color: '#fff', fontWeight: 600 }}>+{quantiles.p95_mw} MW</span></div>
          </div>
        </div>

        {/* Diurnal Error Profile (Hour of Day) */}
        <div className="glass-panel chart-card">
          <div className="chart-header">
            <div className="chart-title-area">
              <h2>
                <Clock size={18} style={{ color: 'var(--color-actual)' }} />
                Diurnal Accuracy Profile (Hour of Day)
              </h2>
              <p>Average Actual vs Forecasted generation across the 24 hours</p>
            </div>
            <div className="legend-custom">
              <div className="legend-item">
                <span className="legend-dot" style={{ background: 'var(--color-actual)' }}></span>
                <span>Actual</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: 'var(--color-forecast)' }}></span>
                <span>Forecast</span>
              </div>
            </div>
          </div>

          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.diurnal_profile} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                <XAxis dataKey="time_label" stroke="var(--text-muted)" fontSize={10} interval={2} />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} unit=" MW" />
                <Tooltip
                  formatter={(val) => [`${val.toLocaleString()} MW`, '']}
                  contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)', borderRadius: '8px' }}
                />
                <Line type="monotone" dataKey="avg_actual_mw" name="Avg Actual" stroke="var(--color-actual)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="avg_forecast_mw" name="Avg Forecast" stroke="var(--color-forecast)" strokeWidth={2} strokeDasharray="3 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Peak forecasting error occurs during afternoon ramps (14:00 - 18:00 UTC) with average delta exceeding +2,100 MW.
          </div>
        </div>
      </div>

      {/* Daily Performance Breakdown Table */}
      <div className="glass-panel chart-card">
        <div className="chart-header">
          <div className="chart-title-area">
            <h2>
              <Calendar size={18} style={{ color: 'var(--color-thermal)' }} />
              January 2026 Daily Outturn & Error Audit
            </h2>
            <p>Evaluation of all 31 days with Day-Ahead 11:00 UTC cutoff</p>
          </div>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Actual Energy (GWh)</th>
                <th>Forecast Energy (GWh)</th>
                <th>MAE (MW)</th>
                <th>RMSE (MW)</th>
                <th>Mean Bias (MW)</th>
                <th>Bias Tendency</th>
              </tr>
            </thead>
            <tbody>
              {analytics.daily_breakdown.map((d) => (
                <tr key={d.date}>
                  <td className="mono" style={{ fontWeight: 600 }}>{d.date}</td>
                  <td className="mono" style={{ color: 'var(--color-actual)' }}>{d.actual_energy_gwh.toLocaleString()}</td>
                  <td className="mono" style={{ color: 'var(--color-forecast)' }}>{d.forecast_energy_gwh.toLocaleString()}</td>
                  <td className="mono">{d.mae_mw.toLocaleString()}</td>
                  <td className="mono">{d.rmse_mw.toLocaleString()}</td>
                  <td className="mono" style={{ color: d.bias_mw > 0 ? 'var(--color-error-pos)' : 'var(--color-error-neg)', fontWeight: 600 }}>
                    {d.bias_mw > 0 ? `+${d.bias_mw}` : d.bias_mw}
                  </td>
                  <td>
                    <span className={`badge ${d.bias_mw > 0 ? 'badge-red' : 'badge-green'}`}>
                      {d.bias_mw > 0 ? 'Over-Forecast' : 'Under-Forecast'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
