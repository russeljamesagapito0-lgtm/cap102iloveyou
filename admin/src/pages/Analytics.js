import { useEffect, useMemo, useState } from 'react';
import StatCard from '../components/StatCard';
import LineChart from '../components/LineChart';
import BarList from '../components/BarList';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import {
  RANGES,
  sinceFor,
  fetchAll,
  bucketSeries,
  summarizeByDisease,
  pct,
  avgConfidence,
  personName,
} from '../lib/analytics';

const SCAN_COLS =
  'id,created_at,user_id,region,disease_code,predicted_code,confidence,flagged,corrected';
const LOW_CONFIDENCE = 0.7;

const CONF_BUCKETS = [
  { label: 'Below 60%', test: (c) => c < 0.6 },
  { label: '60 – 69%', test: (c) => c >= 0.6 && c < 0.7 },
  { label: '70 – 79%', test: (c) => c >= 0.7 && c < 0.8 },
  { label: '80 – 89%', test: (c) => c >= 0.8 && c < 0.9 },
  { label: '90% and above', test: (c) => c >= 0.9 },
];

export default function Analytics() {
  const toast = useToast();
  const [rangeKey, setRangeKey] = useState('30d');
  const [scans, setScans] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [diseases, setDiseases] = useState([]);
  const [loading, setLoading] = useState(true);

  const range = RANGES.find((r) => r.key === rangeKey);

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('id, full_name, email, region, created_at'),
      supabase.from('diseases').select('code,name'),
    ]).then(([p, d]) => {
      setProfiles(p.data || []);
      setDiseases(d.data || []);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAll('scans', SCAN_COLS, { since: sinceFor(range.days) })
      .then((rows) => !cancelled && setScans(rows))
      .catch((e) => toast.error(`Could not load analytics: ${e.message}`))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  const data = useMemo(() => {
    const names = Object.fromEntries(diseases.map((d) => [d.code, d.name]));
    const profMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
    const total = scans.length;

    const corrected = scans.filter((s) => s.corrected).length;
    const flagged = scans.filter((s) => s.flagged).length;
    const lowConf = scans.filter((s) => Number(s.confidence) < LOW_CONFIDENCE).length;
    const activeUsers = new Set(scans.map((s) => s.user_id).filter(Boolean)).size;

    const scanSeries = bucketSeries(scans, range.days);
    const since = sinceFor(range.days);
    const newUsers = profiles.filter((p) => !since || p.created_at >= since);
    const userSeries = bucketSeries(newUsers, range.days);

    const diseaseItems = summarizeByDisease(scans, names).map((d) => ({
      label: d.name,
      value: d.scans,
    }));

    const confItems = CONF_BUCKETS.map((b) => ({
      label: b.label,
      value: scans.filter((s) => b.test(Number(s.confidence) || 0)).length,
    }));

    const regionCounts = {};
    scans.forEach((s) => {
      const r = s.region || profMap[s.user_id]?.region || 'Unspecified';
      regionCounts[r] = (regionCounts[r] || 0) + 1;
    });
    const regionItems = Object.entries(regionCounts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Which predictions admins end up changing — a rough read on model accuracy.
    const byPredicted = {};
    const pairs = {};
    scans.forEach((s) => {
      if (!s.predicted_code) return;
      const row = (byPredicted[s.predicted_code] ||= { code: s.predicted_code, scans: 0, corrected: 0 });
      row.scans += 1;
      if (s.corrected) {
        row.corrected += 1;
        const key = `${s.predicted_code}>${s.disease_code}`;
        pairs[key] = (pairs[key] || 0) + 1;
      }
    });
    const predictedRows = Object.values(byPredicted)
      .map((r) => ({ ...r, name: names[r.code] || r.code }))
      .sort((a, b) => b.corrected - a.corrected || b.scans - a.scans);
    const topCorrections = Object.entries(pairs)
      .map(([k, count]) => {
        const [from, to] = k.split('>');
        return { from: names[from] || from, to: names[to] || to, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const perUser = {};
    scans.forEach((s) => {
      if (s.user_id) perUser[s.user_id] = (perUser[s.user_id] || 0) + 1;
    });
    const topUsers = Object.entries(perUser)
      .map(([id, count]) => ({ id, count, name: personName(profMap[id]) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const peak = scanSeries.points.reduce(
      (best, p) => (p.count > (best?.count ?? -1) ? p : best),
      null
    );

    return {
      total, corrected, flagged, lowConf, activeUsers,
      scanSeries, userSeries, newUsersCount: newUsers.length,
      diseaseItems, confItems, regionItems, predictedRows, topCorrections, topUsers, peak,
    };
  }, [scans, profiles, diseases, range]);

  const avgPerBucket = data.scanSeries.points.length
    ? (data.total / data.scanSeries.points.length).toFixed(1)
    : '0';

  return (
    <div className="stack-lg">
      <div className="flex-between">
        <p className="page-subtitle">
          {loading ? 'Loading…' : `${data.total} scans · ${range.days ? `last ${range.label}` : 'all time'}`}
        </p>
        <div className="filter-bar">
          {RANGES.map((r) => (
            <button
              key={r.key}
              className={'filter-btn' + (rangeKey === r.key ? ' active' : '')}
              onClick={() => setRangeKey(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-4">
        <StatCard label="Total Scans" value={data.total} icon="scans" footer={`${data.lowConf} below 70% confidence`} />
        <StatCard label="Active Users" value={data.activeUsers} icon="users" footer={`${data.newUsersCount} new sign-ups`} />
        <StatCard label="Avg Confidence" value={avgConfidence(scans)} icon="check" footer="Across all scans in range" />
        <StatCard
          label="Correction Rate"
          value={pct(data.corrected, data.total, 1)}
          icon="alert"
          footer={`${data.corrected} corrected · ${data.flagged} flagged`}
        />
      </div>

      <div className="chart-card">
        <div className="chart-head">
          <div>
            <div className="chart-title">Scans over time</div>
            <div className="chart-sub">Per {data.scanSeries.unit}</div>
          </div>
        </div>
        <div className="kpi-strip">
          <div className="kpi-cell">
            <span className="kpi-label">Total</span>
            <span className="kpi-value accent">{data.total}</span>
          </div>
          <div className="kpi-cell">
            <span className="kpi-label">Avg per {data.scanSeries.unit}</span>
            <span className="kpi-value">{avgPerBucket}</span>
          </div>
          <div className="kpi-cell">
            <span className="kpi-label">Peak</span>
            <span className="kpi-value">
              {data.peak && data.peak.count > 0 ? `${data.peak.day} (${data.peak.count})` : '—'}
            </span>
          </div>
        </div>
        {data.total === 0 ? (
          <div className="chart-empty">No scans recorded in this period.</div>
        ) : (
          <LineChart data={data.scanSeries.points} labelEvery={data.scanSeries.labelEvery} unit="scan" />
        )}
      </div>

      <div className="grid-2">
        <div className="chart-card">
          <div>
            <div className="chart-title">Disease distribution</div>
            <div className="chart-sub">Final label of each scan</div>
          </div>
          <BarList items={data.diseaseItems} total={data.total} />
        </div>

        <div className="chart-card">
          <div>
            <div className="chart-title">User growth</div>
            <div className="chart-sub">New sign-ups per {data.userSeries.unit}</div>
          </div>
          {data.newUsersCount === 0 ? (
            <div className="chart-empty">No new users in this period.</div>
          ) : (
            <LineChart data={data.userSeries.points} labelEvery={data.userSeries.labelEvery} unit="user" />
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="chart-card">
          <div>
            <div className="chart-title">Confidence distribution</div>
            <div className="chart-sub">How sure the model was</div>
          </div>
          <BarList items={data.confItems} total={data.total} />
        </div>

        <div className="chart-card">
          <div>
            <div className="chart-title">Scans by region</div>
            <div className="chart-sub">Top 8</div>
          </div>
          <BarList items={data.regionItems} total={data.total} />
        </div>
      </div>

      <div className="grid-2">
        <div className="chart-card">
          <div>
            <div className="chart-title">Model corrections</div>
            <div className="chart-sub">How often each prediction was changed on review</div>
          </div>
          {data.predictedRows.length === 0 ? (
            <div className="chart-empty">No predictions recorded.</div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Predicted</th>
                    <th className="text-right">Scans</th>
                    <th className="text-right">Corrected</th>
                    <th className="text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.predictedRows.map((r) => (
                    <tr key={r.code}>
                      <td className="cell-strong">{r.name}</td>
                      <td className="text-right">{r.scans}</td>
                      <td className="text-right">{r.corrected}</td>
                      <td className="text-right cell-muted">{pct(r.corrected, r.scans, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.topCorrections.length > 0 && (
            <div>
              <div className="kpi-label" style={{ marginBottom: 8 }}>Most common corrections</div>
              {data.topCorrections.map((c) => (
                <div className="info-row" key={`${c.from}-${c.to}`}>
                  <span className="info-row-label">{c.from} → {c.to}</span>
                  <span className="info-row-value">{c.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="chart-card">
          <div>
            <div className="chart-title">Most active users</div>
            <div className="chart-sub">By scans in this period</div>
          </div>
          {data.topUsers.length === 0 ? (
            <div className="chart-empty">No activity in this period.</div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th className="text-right">Scans</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="cell-strong">{u.name}</td>
                      <td className="text-right">{u.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}