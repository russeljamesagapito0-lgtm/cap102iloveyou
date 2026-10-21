import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import LineChart from '../components/LineChart';
import BarList from '../components/BarList';
import { useToast } from '../context/ToastContext';
import { supabase, fetchPages } from '../lib/supabase';
import {
  RANGES,
  sinceFor,
  fetchAll,
  bucketSeries,
  summarizeByDisease,
  avgConfidence,
} from '../lib/analytics';

const SCAN_COLS = 'id,created_at,user_id,region,disease_code,confidence';
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
      fetchPages(() =>
        supabase.from('profiles').select('id, full_name, email, region, created_at').order('id')
      ).catch(() => []),
      supabase.from('diseases').select('code,name'),
    ]).then(([p, d]) => {
      setProfiles(p);
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
   
  }, [rangeKey]);

  const data = useMemo(() => {
    const names = Object.fromEntries(diseases.map((d) => [d.code, d.name]));
    const total = scans.length;

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

    const peak = scanSeries.points.reduce(
      (best, p) => (p.count > (best?.count ?? -1) ? p : best),
      null
    );

    return {
      total, lowConf, activeUsers,
      scanSeries, userSeries, newUsersCount: newUsers.length,
      diseaseItems, confItems, peak,
    };
  }, [scans, profiles, diseases, range]);

  const avgPerBucket = data.scanSeries.points.length
    ? (data.total / data.scanSeries.points.length).toFixed(1)
    : '0';

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={
          loading
            ? 'Loading…'
            : `${data.total} scans · ${range.days ? `last ${range.label}` : 'all time'}`
        }
      />

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

        <div className="grid-3">
          <StatCard label="Total Scans" value={data.total} icon="scans" footer={`${data.lowConf} below 70% confidence`} />
          <StatCard label="Active Users" value={data.activeUsers} icon="users" footer={`${data.newUsersCount} new sign-ups`} />
          <StatCard label="Avg Confidence" value={avgConfidence(scans)} icon="check" footer="Across all scans in range" />
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

        <div className="chart-card">
          <div className="chart-head">
            <div>
              <div className="chart-title">Confidence distribution</div>
              <div className="chart-sub">How confident the model was across scans in range</div>
            </div>
          </div>
          {data.total === 0 ? (
            <div className="chart-empty">No scans recorded in this period.</div>
          ) : (
            <BarList items={data.confItems} total={data.total} />
          )}
        </div>
      </div>
    </>
  );
}