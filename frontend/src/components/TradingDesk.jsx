import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { Wind, Activity, TrendingUp, AlertTriangle, Layers, Clock } from 'lucide-react';
import MetricCard from './MetricCard';

export default function TradingDesk({ dayData, loading, cutoffHour }) {
  const [viewMode, setViewMode] = useState('half_hourly'); // 'half_hourly' or 'hourly'
  const [showTable, setShowTable] = useState(false);

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center' }}>
        <Activity className="animate-spin" size={32} style={{ color: 'var(--color-forecast)', margin: '0 auto 1rem' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading UK Day-Ahead Market Settlement Periods...</p>
      </div>
    );
  }

  if (!dayData || dayData.error) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', borderColor: 'var(--color-error-pos)' }}>
        <AlertTriangle size={36} style={{ color: 'var(--color-error-pos)', margin: '0 auto 1rem' }} />
        <h3 style={{ marginBottom: '0.5rem' }}>Data Unavailable</h3>
        <p style={{ color: 'var(--text-secondary)' }}>{dayData?.error || 'Unable to retrieve wind generation curves.'}</p>
      </div>
    );
  }

  const chartData = viewMode === 'half_hourly' ? dayData.half_hourly : dayData.hourly;
  const summary = dayData.summary;

  // Custom chart tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="glass-panel" style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', border: '1px solid var(--border-highlight)' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.4rem', color: '#fff' }}>
            {viewMode === 'half_hourly' ? `Settlement Period ${dataPoint.settlement_period} (${dataPoint.time_label})` : `Hour ${dataPoint.time_label}`}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', color: 'var(--color-actual)' }}>
            <span>Actual Wind:</span>
            <span className="mono" style={{ fontWeight: 600 }}>{dataPoint.actual_mw?.toLocaleString()} MW</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', color: 'var(--color-forecast)' }}>
            <span>Day-Ahead Forecast:</span>
            <span className="mono" style={{ fontWeight: 600 }}>{dataPoint.forecast_mw?.toLocaleString()} MW</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', color: dataPoint.error_mw > 0 ? 'var(--color-error-pos)' : 'var(--color-error-neg)', marginTop: '0.2rem', paddingTop: '0.2rem', borderTop: '1px solid var(--border-subtle)' }}>
            <span>Forecast Error:</span>
            <span className="mono" style={{ fontWeight: 700 }}>
              {dataPoint.error_mw > 0 ? `+${dataPoint.error_mw?.toLocaleString()}` : dataPoint.error_mw?.toLocaleString()} MW
            </span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Published: {dataPoint.forecast_publish_time ? dataPoint.forecast_publish_time.replace('T', ' ').replace('Z', ' UTC') : 'N/A'}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="animate-fade">
      {/* KPI Cards */}
      <div className="kpi-grid">
        <MetricCard
          title="Daily MAE"
          value={summary.mae_mw.toLocaleString()}
          unit="MW"
          badgeText="Mean Absolute Error"
          badgeType="cyan"
          subtext="Avg deviation from actuals"
          icon={Activity}
        />
        <MetricCard
          title="Daily RMSE"
          value={summary.rmse_mw.toLocaleString()}
          unit="MW"
          badgeText="Root Mean Sq Error"
          badgeType="amber"
          subtext="Penalizes large peak misses"
          icon={TrendingUp}
        />
        <MetricCard
          title="Forecast Bias"
          value={summary.bias_mw > 0 ? `+${summary.bias_mw}` : summary.bias_mw}
          unit="MW"
          badgeText={summary.bias_type === 'OVER_FORECAST' ? 'Over-Predicted' : 'Under-Predicted'}
          badgeType={summary.bias_type === 'OVER_FORECAST' ? 'red' : 'green'}
          subtext={summary.bias_type === 'OVER_FORECAST' ? 'System shortage risk' : 'Excess renewable spillover'}
          icon={AlertTriangle}
        />
        <MetricCard
          title="Total Generation"
          value={summary.actual_energy_gwh.toLocaleString()}
          unit="GWh"
          badgeText={`FC: ${summary.forecast_energy_gwh} GWh`}
          badgeType="green"
          subtext="Daily total outturn energy"
          icon={Wind}
        />
      </div>

      {/* Main Chart Card */}
      <div className="glass-panel chart-card">
        <div className="chart-header">
          <div className="chart-title-area">
            <h2>
              <Wind size={20} style={{ color: 'var(--color-actual)' }} />
              UK Wind Generation: Actual vs Day-Ahead Forecast
            </h2>
            <p>
              Decision Cutoff: Locked at {cutoffHour}:00 UTC on Day D-1 (No lookahead bias). Target Date: {dayData.delivery_date}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {/* View Mode Toggle */}
            <div className="tab-nav">
              <button
                className={`tab-btn ${viewMode === 'half_hourly' ? 'active' : ''}`}
                onClick={() => setViewMode('half_hourly')}
              >
                <Layers size={14} /> 48 Settlement Periods
              </button>
              <button
                className={`tab-btn ${viewMode === 'hourly' ? 'active' : ''}`}
                onClick={() => setViewMode('hourly')}
              >
                <Clock size={14} /> 24 Hourly Blocks
              </button>
            </div>

            {/* Custom Legend */}
            <div className="legend-custom">
              <div className="legend-item">
                <span className="legend-dot" style={{ background: 'var(--color-actual)' }}></span>
                <span>Actual Wind</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: 'var(--color-forecast)' }}></span>
                <span>Day-Ahead Forecast</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: 'var(--color-error-pos)' }}></span>
                <span>Forecast Delta (MW)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Curve Chart */}
        <div style={{ width: '100%', height: 380 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis
                dataKey="time_label"
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                interval={viewMode === 'half_hourly' ? 3 : 1}
              />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={11}
                tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                unit=" MW"
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="actual_mw"
                name="Actual Wind"
                stroke="var(--color-actual)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 6, fill: 'var(--color-actual)', stroke: '#fff', strokeWidth: 2 }}
              />
              <Line
                type="stepAfter"
                dataKey="forecast_mw"
                name="Day-Ahead Forecast"
                stroke="var(--color-forecast)"
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={false}
                activeDot={{ r: 6, fill: 'var(--color-forecast)', stroke: '#fff', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Error Difference Chart */}
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Forecast Error (Forecast minus Actual in MW)
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Positive = Over-predicted (Shortfall) | Negative = Under-predicted (Surplus)
            </span>
          </div>

          <div style={{ width: '100%', height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                <XAxis dataKey="time_label" hide />
                <YAxis
                  stroke="var(--text-muted)"
                  fontSize={10}
                  tickFormatter={(val) => `${val > 0 ? '+' : ''}${val}`}
                  unit=" MW"
                />
                <ReferenceLine y={0} stroke="rgba(255, 255, 255, 0.2)" />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="error_mw"
                  fill="var(--color-error-pos)"
                  isAnimationActive={true}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table Toggle Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button
          className="tab-btn"
          style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-subtle)' }}
          onClick={() => setShowTable(!showTable)}
        >
          {showTable ? 'Hide Settlement Periods Table' : 'Inspect 48 Settlement Periods & Publish Timestamps'}
        </button>
      </div>

      {/* Settlement Periods Inspection Table */}
      {showTable && (
        <div className="glass-panel chart-card animate-fade">
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', fontWeight: 600 }}>
            Settlement Period Audit Trail (Gate Closure Validation)
          </h3>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SP</th>
                  <th>Time Interval (UTC)</th>
                  <th>Actual Wind (MW)</th>
                  <th>Day-Ahead Forecast (MW)</th>
                  <th>Error (MW)</th>
                  <th>Absolute Error</th>
                  <th>Forecast Publication Timestamp</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {dayData.half_hourly.map((sp) => {
                  const isOver = (sp.error_mw || 0) > 0;
                  return (
                    <tr key={sp.settlement_period}>
                      <td className="mono" style={{ fontWeight: 600 }}>{sp.settlement_period}</td>
                      <td>{sp.time_label} - {sp.settlement_period % 2 === 1 ? `${sp.time_label.split(':')[0]}:30` : `${(parseInt(sp.time_label.split(':')[0]) + 1).toString().padStart(2, '0')}:00`}</td>
                      <td className="mono" style={{ color: 'var(--color-actual)' }}>{sp.actual_mw?.toLocaleString()}</td>
                      <td className="mono" style={{ color: 'var(--color-forecast)' }}>{sp.forecast_mw?.toLocaleString()}</td>
                      <td className="mono" style={{ color: isOver ? 'var(--color-error-pos)' : 'var(--color-error-neg)', fontWeight: 600 }}>
                        {isOver ? `+${sp.error_mw?.toLocaleString()}` : sp.error_mw?.toLocaleString()}
                      </td>
                      <td className="mono">{sp.abs_error_mw?.toLocaleString()}</td>
                      <td className="mono" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        {sp.forecast_publish_time?.replace('T', ' ').replace('Z', ' UTC')}
                      </td>
                      <td>
                        <span className={`badge ${isOver ? 'badge-red' : 'badge-green'}`}>
                          {isOver ? 'Shortage Risk' : 'Surplus Wind'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
