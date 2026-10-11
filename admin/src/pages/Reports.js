import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon';
import { useToast } from '../context/ToastContext';
import { downloadCsv } from '../lib/csv';
import { supabase, fmtDate, logAudit } from '../lib/supabase';
import {
  fetchAll,
  addDays,
  toDateInput,
  summarizeByDisease,
  pct,
  avgConfidence,
} from '../lib/analytics';
import { formatDetails, adminName } from './Audit';

const SCAN_COLS =
  'id,created_at,user_id,region,disease_code,predicted_code,confidence,flagged,corrected,image_url,profiles(full_name,email)';

const PRESETS = [
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
];

const dayStart = (s) => new Date(`${s}T00:00:00`);

export default function Reports() {
  const toast = useToast();
  const today = toDateInput(new Date());
  const [from, setFrom] = useState(toDateInput(addDays(new Date(), -29)));
  const [to, setTo] = useState(today);
  const [scans, setScans] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [diseases, setDiseases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const since = from ? dayStart(from).toISOString() : null;
  const until = to ? addDays(dayStart(to), 1).toISOString() : null;
  const rangeLabel = from || to ? `${from || 'start'} to ${to || 'today'}` : 'All time';
  const fileTag = `${from || 'all'}_${to || 'all'}`;

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('id, full_name, email, region, plan, status, created_at, last_active_at'),
      supabase.from('diseases').select('code,name'),
    ]).then(([p, d]) => {
      setProfiles(p.data || []);
      setDiseases(d.data || []);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAll('scans', SCAN_COLS, { since, until })
      .then((rows) => !cancelled && setScans(rows))
      .catch((e) => toast.error(`Could not load report data: ${e.message}`))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const names = useMemo(
    () => Object.fromEntries(diseases.map((d) => [d.code, d.name])),
    [diseases]
  );
  const summary = useMemo(() => summarizeByDisease(scans, names), [scans, names]);
  const activeUsers = useMemo(
    () => new Set(scans.map((s) => s.user_id).filter(Boolean)).size,
    [scans]
  );

  const applyPreset = (p) => {
    setTo(p.days ? today : '');
    setFrom(p.days ? toDateInput(addDays(new Date(), -(p.days - 1))) : '');
  };

  const finish = (type, rows, name) => {
    downloadCsv(`rootcare-${name}_${fileTag}.csv`, rows);
    if (rows.length) logAudit('report.export', 'report', type, { report: name, rows: rows.length, from: from || null, to: to || null });
  };

  const exportScans = () =>
    finish('scans', scans.map((s) => ({
      id: s.id,
      scanned_at: s.created_at,
      user_email: s.profiles?.email,
      region: s.region,
      predicted_label: names[s.predicted_code || s.disease_code] || s.predicted_code || s.disease_code,
      final_label: names[s.disease_code] || s.disease_code,
      confidence: s.confidence,
      flagged: s.flagged,
      corrected: s.corrected,
      image_url: s.image_url,
    })), 'scans');

  const exportUsers = () => {
    const counts = {};
    scans.forEach((s) => { if (s.user_id) counts[s.user_id] = (counts[s.user_id] || 0) + 1; });
    finish('users', profiles.map((p) => ({
      name: p.full_name,
      email: p.email,
      region: p.region,
      plan: p.plan,
      status: p.status,
      joined: p.created_at,
      last_active: p.last_active_at,
      scans_in_range: counts[p.id] || 0,
    })), 'users');
  };

  const exportDiseases = () =>
    finish('diseases', summary.map((d) => ({
      disease: d.name,
      code: d.code,
      scans: d.scans,
      share: pct(d.scans, scans.length, 1),
      avg_confidence: pct(d.confSum, d.scans, 1),
      corrected: d.corrected,
      flagged: d.flagged,
    })), 'disease-summary');

  const exportAudit = async () => {
    setBusy('audit');
    try {
      const rows = await fetchAll('audit_log', 'id,created_at,action,details,profiles(full_name,email)', { since, until });
      finish('audit', rows.map((r) => ({
        when: r.created_at,
        admin: adminName(r.profiles),
        action: r.action,
        details: formatDetails(r.action, r.details),
      })), 'audit-log');
    } catch (e) {
      toast.error(`Export failed: ${e.message}`);
    } finally {
      setBusy('');
    }
  };

  const REPORTS = [
    { title: 'Scan report', desc: 'Every scan in the range with user, region, predicted vs final label and confidence.', count: `${scans.length} rows`, run: exportScans },
    { title: 'User report', desc: 'All users with plan, status, last activity and how many scans they made in the range.', count: `${profiles.length} rows`, run: exportUsers },
    { title: 'Disease summary', desc: 'Scan volume, share, average confidence, corrections and flags per disease.', count: `${summary.length} rows`, run: exportDiseases },
    { title: 'Audit log', desc: 'Admin actions and sessions in the range.', count: 'Fetched on download', run: exportAudit, key: 'audit' },
  ];

  return (
    <div className="stack-lg">
      <div className="chart-card no-print">
        <div className="chart-head">
          <div>
            <div className="chart-title">Date range</div>
            <div className="chart-sub">Applies to every report below</div>
          </div>
          <div className="filter-bar">
            {PRESETS.map((p) => (
              <button key={p.key} className="filter-btn" onClick={() => applyPreset(p)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-center" style={{ gap: 12, flexWrap: 'wrap' }}>
          <input className="input" type="date" style={{ width: 170 }} value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-muted">to</span>
          <input className="input" type="date" style={{ width: 170 }} value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="grid-2 no-print">
        {REPORTS.map((r) => (
          <div className="chart-card" key={r.title}>
            <div>
              <div className="chart-title">{r.title}</div>
              <div className="chart-sub">{r.desc}</div>
            </div>
            <div className="flex-between">
              <span className="text-muted" style={{ fontSize: 12 }}>{loading ? 'Loading…' : r.count}</span>
              <button className="btn btn-outline btn-sm" onClick={r.run} disabled={loading || busy === r.key}>
                <Icon name="download" size={14} /> {busy === r.key ? 'Preparing…' : 'Download CSV'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="chart-card">
        <div className="chart-head">
          <div>
            <div className="chart-title">Summary report</div>
            <div className="chart-sub">RootCare · {rangeLabel} · generated {fmtDate(new Date().toISOString())}</div>
          </div>
          <button className="btn btn-primary btn-sm no-print" onClick={() => window.print()} disabled={loading}>
            Print / Save as PDF
          </button>
        </div>

        <div className="kpi-strip">
          <div className="kpi-cell">
            <span className="kpi-label">Total scans</span>
            <span className="kpi-value accent">{scans.length}</span>
          </div>
          <div className="kpi-cell">
            <span className="kpi-label">Active users</span>
            <span className="kpi-value">{activeUsers}</span>
          </div>
          <div className="kpi-cell">
            <span className="kpi-label">Avg confidence</span>
            <span className="kpi-value">{avgConfidence(scans)}</span>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Disease</th>
                <th className="text-right">Scans</th>
                <th className="text-right">Share</th>
                <th className="text-right">Avg confidence</th>
                <th className="text-right">Corrected</th>
                <th className="text-right">Flagged</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((d) => (
                <tr key={d.code}>
                  <td className="cell-strong">{d.name}</td>
                  <td className="text-right">{d.scans}</td>
                  <td className="text-right cell-muted">{pct(d.scans, scans.length, 1)}</td>
                  <td className="text-right cell-muted">{pct(d.confSum, d.scans, 1)}</td>
                  <td className="text-right">{d.corrected}</td>
                  <td className="text-right">{d.flagged}</td>
                </tr>
              ))}
              {!loading && summary.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center text-muted">No scans in this range.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}