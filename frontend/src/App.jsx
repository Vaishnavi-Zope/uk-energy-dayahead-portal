import React, { useState, useEffect } from 'react';
import { Wind, BarChart2, Calculator, Calendar, Clock, Database, ShieldCheck } from 'lucide-react';
import TradingDesk from './components/TradingDesk';
import AccuracyAnalytics from './components/AccuracyAnalytics';
import ProcurementSimulator from './components/ProcurementSimulator';
import { fetchDates, fetchDayCurves } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('trading'); // 'trading', 'analytics', 'simulator'
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState('2026-01-15');
  const [cutoffHour, setCutoffHour] = useState(11); // 11:00 UTC default UK auction gate closure
  const [dayData, setDayData] = useState(null);
  const [loadingDay, setLoadingDay] = useState(true);

  // Initial load of dates
  useEffect(() => {
    async function loadDates() {
      try {
        const res = await fetchDates();
        if (res.dates && res.dates.length > 0) {
          setDates(res.dates);
          if (!res.dates.includes(selectedDate)) {
            setSelectedDate(res.dates[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching dates:', err);
      }
    }
    loadDates();
  }, []);

  // Load day curves whenever selectedDate or cutoffHour changes
  useEffect(() => {
    async function loadDay() {
      try {
        setLoadingDay(true);
        const data = await fetchDayCurves(selectedDate, cutoffHour);
        setDayData(data);
      } catch (err) {
        console.error('Error fetching day curves:', err);
        setDayData({ error: err.message });
      } finally {
        setLoadingDay(false);
      }
    }
    if (selectedDate) {
      loadDay();
    }
  }, [selectedDate, cutoffHour]);

  return (
    <div>
      {/* App Header */}
      <header className="app-header">
        <div className="logo-area">
          <div className="logo-badge">UK NESO</div>
          <div className="app-title">
            <h1>Day-Ahead Renewable Procurement & Forecasting Portal</h1>
            <p>Elexon BMRS Settlement Period Analysis • January 2026 Power Purchase Desk</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="tab-nav">
          <button
            className={`tab-btn ${activeTab === 'trading' ? 'active' : ''}`}
            onClick={() => setActiveTab('trading')}
          >
            <Wind size={16} /> Trading Desk
          </button>
          <button
            className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart2 size={16} /> Forecast Accuracy
          </button>
          <button
            className={`tab-btn ${activeTab === 'simulator' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulator')}
          >
            <Calculator size={16} /> What-If Simulator
          </button>
        </nav>
      </header>

      {/* Global Filter & Control Bar */}
      <div className="glass-panel control-bar">
        <div className="control-group">
          <Calendar size={18} style={{ color: 'var(--color-forecast)' }} />
          <span className="control-label">Delivery Date:</span>
          <select
            className="select-control mono"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          >
            {dates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <Clock size={18} style={{ color: 'var(--color-actual)' }} />
          <span className="control-label">Day-Ahead Decision Cutoff:</span>
          <select
            className="select-control mono"
            value={cutoffHour}
            onChange={(e) => setCutoffHour(parseInt(e.target.value))}
          >
            <option value={9}>09:00 UTC (Early Run)</option>
            <option value={11}>11:00 UTC (EPEX Auction Default)</option>
            <option value={12}>12:00 UTC (Nord Pool Auction)</option>
            <option value={14}>14:00 UTC (Afternoon Re-optimization)</option>
          </select>
        </div>

        <div className="control-group" style={{ marginLeft: 'auto' }}>
          <span className="badge badge-green" style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}>
            <Database size={12} /> Elexon BMRS Verified
          </span>
          <span className="badge badge-cyan" style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}>
            <ShieldCheck size={12} /> Zero Lookahead Bias
          </span>
        </div>
      </div>

      {/* Main Tab Content */}
      <main className="dashboard-container">
        {activeTab === 'trading' && (
          <TradingDesk
            dayData={dayData}
            loading={loadingDay}
            cutoffHour={cutoffHour}
          />
        )}

        {activeTab === 'analytics' && (
          <AccuracyAnalytics
            cutoffHour={cutoffHour}
          />
        )}

        {activeTab === 'simulator' && (
          <ProcurementSimulator
            selectedDate={selectedDate}
            cutoffHour={cutoffHour}
          />
        )}
      </main>
    </div>
  );
}
