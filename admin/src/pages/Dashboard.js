import StatCard from '../components/StatCard';
import { useEffect, useState } from 'react';
import { supabase, fmtDate } from '../lib/supabase';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#06b6d4', '#22c55e', '#8b5cf6', '#ec4899'];

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

  const scansPerDay = stats.scansPerDay;
  const diseaseBreakdown = stats.diseaseBreakdown.map((d, i) => ({ ...d, color: COLORS[i % COLORS.length] }));
  const recentActivity = stats.recent.map((r, i) => ({ id: i, text: r.text, time: fmtDate(r.created_at) }));
  const maxCount = Math.max(1, ...scansPerDay.map((d) => d.count));

  return (
    <div className="stack-lg">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of RootCare activity</p>
      </div>

      <div className="grid-4">
        <StatCard
          label="Total Users"
          value={stats.totalUsers}
          sub={`${stats.activeUsers7d} active this week`}
        />
        <StatCard
          label="Total Scans"
          value={stats.totalScans}
          sub={`${stats.scansToday} today`}
        />
        <StatCard
          label="Pending Feedback"
          value={stats.pendingFeedback}
          sub="awaiting reply"
        />
        <StatCard
          label="Flagged Scans"
          value={stats.flaggedScans}
          sub="need review"
        />
      </div>

      <div className="grid-2-1">
        <div className="card">
          <h2 className="card-title">Scans this week</h2>
          <div className="bar-chart">
            {scansPerDay.map((d) => (
              <div key={d.day} className="bar-col">
                <div className="bar-track">
                  <div
                    className="bar"
                    style={{ height: `${(d.count / maxCount) * 100}%` }}
                    title={`${d.count} scans`}
                  />
                </div>
                <span className="bar-label">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Disease breakdown</h2>
          <div className="legend-list">
            {diseaseBreakdown.map((d) => (
              <div key={d.name} className="legend-item">
                <div className="legend-left">
                  <span
                    className="legend-dot"
                    style={{ background: d.color }}
                  />
                  <span className="legend-name">{d.name}</span>
                </div>
                <span className="legend-count">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Recent activity</h2>
        <div className="activity-list">
          {recentActivity.map((a) => (
            <div key={a.id} className="activity-item">
              <span className="activity-text">{a.text}</span>
              <span className="activity-time">{a.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}