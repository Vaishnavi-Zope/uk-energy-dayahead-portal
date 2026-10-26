import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { ShieldCheck, PoundSterling, AlertTriangle, Zap, Sliders, CheckCircle2 } from 'lucide-react';
import MetricCard from './MetricCard';
import { simulateProcurement } from '../services/api';

export default function ProcurementSimulator({ selectedDate, cutoffHour }) {
  const [demandMw, setDemandMw] = useState(25000);
  const [confidence, setConfidence] = useState(0.90);
  const [simResult, setSimResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function runSim() {
      try {
        setLoading(true);
        const res = await simulateProcurement({
          deliveryDate: selectedDate,
          cutoffHour: cutoffHour,
          baseDemandMw: demandMw,
          confidenceLevel: confidence,
        });
        setSimResult(res);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    runSim();
  }, [selectedDate, cutoffHour, demandMw, confidence]);

  if (!simResult) return null;

  const sum = simResult.summary;

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="glass-panel" style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', border: '1px solid var(--border-highlight)' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.4rem', color: '#fff' }}>
            Period {d.settlement_period} ({d.time_label})
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1.2rem', color: 'var(--color-demand)' }}>
            <span>Target Demand:</span>
            <span className="mono" style={{ fontWeight: 600 }}>{d.demand_mw?.toLocaleString()} MW</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1.2rem', color: 'var(--color-forecast)' }}>
            <span>Wind Forecast:</span>
            <span className="mono" style={{ fontWeight: 600 }}>{d.forecast_wind_mw?.toLocaleString()} MW</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1.2rem', color: 'var(--color-actual)' }}>
            <span>Wind Actual:</span>
            <span className="mono" style={{ fontWeight: 600 }}>{d.actual_wind_mw?.toLocaleString()} MW</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1.2rem', color: 'var(--color-thermal)', marginTop: '0.2rem', paddingTop: '0.2rem', borderTop: '1px solid var(--border-subtle)' }}>
            <span>Procured Thermal:</span>
            <span className="mono" style={{ fontWeight: 700 }}>{d.adjusted_procurement_mw?.toLocaleString()} MW</span>
          </div>
          {d.naive_shortage_mw > 0 && (
            <div style={{ color: 'var(--color-error-pos)', marginTop: '0.2rem', fontSize: '0.75rem' }}>
              ⚠️ Unbuffered Shortage Risk: {d.naive_shortage_mw?.toLocaleString()} MW
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="animate-fade">
      {/* Interactive Controls */}
      <div className="glass-panel chart-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Sliders size={20} style={{ color: 'var(--color-forecast)' }} />
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Day-Ahead Thermal Procurement Simulator</h2>
        </div>

        <div className="sim-controls">
          {/* Base Consumer Demand Slider */}
          <div className="slider-group">
            <div className="slider-header">
              <span className="control-label">Peak Consumer Demand</span>
              <span className="mono" style={{ color: 'var(--color-forecast)', fontWeight: 700, fontSize: '1rem' }}>
                {demandMw.toLocaleString()} MW
              </span>
            </div>
            <input
              type="range"
              min="15000"
              max="35000"
              step="500"
              value={demandMw}
              onChange={(e) => setDemandMw(parseFloat(e.target.value))}
              className="slider-input"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              <span>15,000 MW (Low)</span>
              <span>25,000 MW (Normal)</span>
              <span>35,000 MW (Winter Peak)</span>
            </div>
          </div>

          {/* Risk Tolerance / Confidence Level Selector */}
          <div className="slider-group">
            <div className="slider-header">
              <span className="control-label">Forecast Error Risk Buffer (Percentile)</span>
              <span className="badge badge-amber mono" style={{ fontSize: '0.85rem' }}>
                {(confidence * 100).toFixed(0)}% Confidence (+{simResult.recommended_buffer_mw} MW)
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              {[
                { label: '50% (P50 Median)', val: 0.50 },
                { label: '75% (Moderate)', val: 0.75 },
                { label: '90% (High Security)', val: 0.90 },
                { label: '95% (Extreme)', val: 0.95 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => setConfidence(opt.val)}
                  className="tab-btn"
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    background: confidence === opt.val ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(6, 182, 212, 0.2))' : 'rgba(255, 255, 255, 0.04)',
                    borderColor: confidence === opt.val ? 'var(--color-thermal)' : 'var(--border-subtle)',
                    color: confidence === opt.val ? '#fbbf24' : 'var(--text-secondary)',
                    fontSize: '0.75rem',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Derives thermal procurement buffer from January 2026 forecast error quantiles to prevent cashout imbalance spikes.
            </p>
          </div>
        </div>
      </div>

      {/* Financial & Operational Impact KPIs */}
      <div className="kpi-grid">
        <MetricCard
          title="Procurement Buffer"
          value={`+${simResult.recommended_buffer_mw.toLocaleString()}`}
          unit="MW"
          badgeText={`${(confidence * 100).toFixed(0)}% Error Protection`}
          badgeType="amber"
          subtext="Added to Day-Ahead Thermal order"
          icon={ShieldCheck}
        />
        <MetricCard
          title="Shortage Risk Reduction"
          value={`${sum.shortage_reduction_pct}%`}
          unit=""
          badgeText={sum.adjusted_shortage_exposure_mwh === 0 ? 'Zero Imbalance Deficit' : `${sum.adjusted_shortage_exposure_mwh} MWh remaining`}
          badgeType="green"
          subtext="Eliminates peak shortfall exposure"
          icon={CheckCircle2}
        />
        <MetricCard
          title="Avoided Cashout Penalty"
          value={`£${(sum.estimated_cashout_savings_gbp / 1000000).toFixed(2)}M`}
          unit=""
          badgeText="Estimated Cost Protection"
          badgeType="green"
          subtext={`Saved on ${selectedDate}`}
          icon={PoundSterling}
        />
        <MetricCard
          title="Total Procurement"
          value={sum.total_adjusted_procurement_gwh.toLocaleString()}
          unit="GWh"
          badgeText={`Naive: ${sum.total_naive_procurement_gwh} GWh`}
          badgeType="cyan"
          subtext="Total Day-Ahead thermal energy"
          icon={Zap}
        />
      </div>

      {/* Procurement Curve Visualization */}
      <div className="glass-panel chart-card">
        <div className="chart-header">
          <div className="chart-title-area">
            <h2>
              <Zap size={18} style={{ color: 'var(--color-thermal)' }} />
              Settlement Period Energy Balance & Procurement Stack
            </h2>
            <p>
              Target Date: {selectedDate} | Showing Thermal Procurement layered with Wind Generation to meet consumer demand
            </p>
          </div>
          <div className="legend-custom">
            <div className="legend-item">
              <span className="legend-dot" style={{ background: 'var(--color-demand)' }}></span>
              <span>Consumer Demand</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: 'var(--color-thermal)' }}></span>
              <span>Thermal Procured</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: 'var(--color-actual)' }}></span>
              <span>Actual Wind</span>
            </div>
          </div>
        </div>

        <div style={{ width: '100%', height: 380 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={simResult.half_hourly} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis dataKey="time_label" stroke="var(--text-muted)" fontSize={11} interval={3} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} unit=" MW" />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="adjusted_procurement_mw"
                name="Thermal Procured"
                fill="rgba(245, 158, 11, 0.2)"
                stroke="var(--color-thermal)"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="actual_wind_mw"
                name="Actual Wind"
                stroke="var(--color-actual)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="demand_mw"
                name="Consumer Demand"
                stroke="var(--color-demand)"
                strokeWidth={2.5}
                strokeDasharray="5 5"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
