import { useEffect, useState } from 'react';
import StatCard from '../components/StatCard';
import LineChart from '../components/LineChart';
import { supabase } from '../lib/supabase';

const sumCounts = (days) => days.reduce((total, d) => total + d.count, 0);

const findPeakDay = (days) =>
  days.reduce((best, d) => (d.count > (best?.count ?? -1) ? d : best), null);

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase.rpc('admin_dashboard').then(({ data, error }) => {
      if (error) setErr(error.message);
      else setStats(data);
    });
  }, []);

  if (err) return <p className="text-muted">Error: {err}</p>;
  if (!stats) return <p className="text-muted">Loading...</p>;

  const scansPerDay = stats.scansPerDay || [];
  const totalWeekScans = sumCounts(scansPerDay);
  const dailyAvg = (totalWeekScans / 7).toFixed(1);
  const peakDay = findPeakDay(scansPerDay);

  const scansToday = stats.scansToday;
  const isLive = scansToday > 0;

  return (
    <div className="stack-lg">
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