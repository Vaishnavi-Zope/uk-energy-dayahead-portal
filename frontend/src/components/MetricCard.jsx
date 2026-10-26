import React from 'react';

export default function MetricCard({ title, value, unit = '', subtext, badgeText, badgeType = 'cyan', icon: Icon }) {
  return (
    <div className="glass-panel kpi-card">
      <div className="kpi-header">
        <span className="kpi-title">{title}</span>
        {Icon && <Icon className="kpi-icon" size={18} />}
      </div>
      <div className="kpi-value mono">
        {value} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{unit}</span>
      </div>
      <div className="kpi-subtext">
        {badgeText && <span className={`badge badge-${badgeType}`}>{badgeText}</span>}
        <span>{subtext}</span>
      </div>
    </div>
  );
}
