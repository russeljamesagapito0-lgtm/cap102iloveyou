import { useCallback, useEffect, useState } from 'react';
import StatCard from '../components/StatCard';
import LineChart from '../components/LineChart';
import { supabase } from '../lib/supabase';
import useAutoRefresh from '../lib/useAutoRefresh';
import { formatRelativeTime, useNow } from '../lib/formatRelativeTime';

const sumCounts = (days) => days.reduce((total, d) => total + d.count, 0);

const findPeakDay = (days) =>
  days.reduce((best, d) => (d.count > (best?.count ?? -1) ? d : best), null);

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const fetchStats = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_dashboard');
    if (error) {
      setErr(error.message);
      return;
    }
    setErr('');
    setStats(data);
    setLastUpdatedAt(new Date());
  }, []);

  // Initial load
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Silent refresh — updates the timestamp above, no spinner
  useAutoRefresh(fetchStats, { intervalMs: 15000 });

  // Re-render every 30s so the "X ago" label keeps ticking
  const now = useNow(30000);

  if (err) return <p className="text-muted">Error: {err}</p>;
  if (!stats) return <p className="text-muted">Loading...</p>;

  const scansPerDay = stats.scansPerDay || [];
  const totalWeekScans = sumCounts(scansPerDay);
  const dailyAvg = (totalWeekScans / 7).toFixed(1);
  const peakDay = findPeakDay(scansPerDay);

  const scansToday = stats.scansToday;
  const isLive = scansToday > 0;

  const updatedLabel = lastUpdatedAt
    ? formatRelativeTime(lastUpdatedAt)
    : '';

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          {updatedLabel && (
            <p className="page-meta">Updated {updatedLabel}</p>
          )}
        </div>
      </div>

      <div className="grid-2">
        <StatCard
          label="Total Scans"
          value={stats.totalScans}
          trend={isLive ? `+${scansToday} today` : 'No new scans'}
          trendTone={isLive ? 'up' : 'neutral'}
          icon="scans"
          footer={`${stats.totalScans} scans recorded`}
        />
        <StatCard
          label="Scans Today"
          value={scansToday}
          trend={isLive ? 'Live' : 'Quiet'}
          trendTone={isLive ? 'up' : 'neutral'}
          icon="calendar"
          footer="New scans since midnight"
        />
      </div>

      <div className="chart-card">
        <div className="chart-head">
          <div>
            <div className="chart-title">Scans over time</div>
            <div className="chart-sub">Last 7 days</div>
          </div>
        </div>

        <div className="kpi-strip">
          <div className="kpi-cell">
            <span className="kpi-label">Daily Avg</span>
            <span className="kpi-value accent">{dailyAvg}</span>
          </div>
          <div className="kpi-cell">
            <span className="kpi-label">Peak Day</span>
            <span className="kpi-value">
              {peakDay ? `${peakDay.day} (${peakDay.count})` : '—'}
            </span>
          </div>
          <div className="kpi-cell">
            <span className="kpi-label">Week Total</span>
            <span className="kpi-value accent">{totalWeekScans}</span>
          </div>
        </div>

        {totalWeekScans === 0 ? (
          <div className="chart-empty">No scans recorded in this period.</div>
        ) : (
          <LineChart data={scansPerDay} />
        )}
      </div>
    </div>
  );
}