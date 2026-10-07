import { useState, useEffect } from 'react';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { downloadCsv } from '../lib/csv';
import { supabase, fmtDate, logAudit } from '../lib/supabase';

const PAGE_SIZE = 1000;
const LOW_CONFIDENCE = 0.7;

const confidenceClass = (c) => {
  if (c >= 0.8) return 'confidence confidence-high';
  if (c >= 0.6) return 'confidence confidence-mid';
  return 'confidence confidence-low';
};

const exportRow = (s) => ({
  id: s.id,
  created_at: s.created_at,
  user_email: s.profiles?.email,
  region: s.region,
  predicted_label: s.predicted_code || s.disease_code,
  final_label: s.disease_code,
  confidence: s.confidence,
  flagged: s.flagged,
  corrected: s.corrected,
  image_url: s.image_url,
});

export default function Scans() {
  const [scans, setScans] = useState([]);
  const [diseases, setDiseases] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    (async () => {
      const { data: d } = await supabase
        .from('diseases')
        .select('code,name')
        .order('name');

      const names = Object.fromEntries((d || []).map((x) => [x.code, x.name]));
      setDiseases(d || []);

      const { data } = await supabase
        .from('scans')
        .select('*, profiles(full_name,email)')
        .order('created_at', { ascending: false })
        .limit(200);

      setScans(
        (data || []).map((s) => ({
          id: s.id,
          code: s.disease_code,
          predicted: s.predicted_code,
          disease: names[s.disease_code] || s.disease_code || 'Unknown',
          user: s.profiles?.full_name || s.profiles?.email || 'Unknown',
          confidence: Number(s.confidence ?? 0),
          date: fmtDate(s.created_at),
          region: s.region || '-',
          image_url: s.image_url,
          flagged: s.flagged,
          corrected: s.corrected,
        }))
      );
    })();
  }, []);

  const filtered = scans.filter((s) => {
    if (filter === 'flagged') return s.flagged;
    if (filter === 'low') return s.confidence < LOW_CONFIDENCE;
    return true;
  });

  const flaggedCount = scans.filter((s) => s.flagged).length;

  const openModal = (s) => {
    setSelected(s);
    setNewLabel(s.code || '');
  };

  const saveLabel = async () => {
    if (!selected) return;

    const { error } = await supabase
      .from('scans')
      .update({
        predicted_code: selected.predicted || selected.code,
        disease_code: newLabel,
        flagged: false,
        corrected: true,
      })
      .eq('id', selected.id);

    if (error) return alert(error.message);

    logAudit('update', 'scan', selected.id, {
      from: selected.code,
      to: newLabel,
    });

    const name = diseases.find((d) => d.code === newLabel)?.name || newLabel;

    setScans((prev) =>
      prev.map((s) =>
        s.id === selected.id
          ? {
              ...s,
              predicted: s.predicted || s.code,
              code: newLabel,
              disease: name,
              flagged: false,
              corrected: true,
            }
          : s
      )
    );
    setSelected(null);
  };

  const exportCsv = async (onlyCorrected) => {
    let rows = [];

    for (let from = 0; ; from += PAGE_SIZE) {
      let q = supabase
        .from('scans')
        .select('*, profiles(email)')
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (onlyCorrected) q = q.eq('corrected', true);

      const { data, error } = await q;
      if (error) return alert(error.message);

      rows = rows.concat(data);
      if (data.length < PAGE_SIZE) break;
    }

    const suffix = onlyCorrected ? '_corrected' : '';
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`scans${suffix}_${date}.csv`, rows.map(exportRow));
  };

  return (
    <div className="stack-lg">
      <div className="flex-between">
        <p className="page-subtitle">
          {scans.length} scans · {flaggedCount} flagged for review
        </p>

        <div className="filter-bar">
          {['all', 'flagged', 'low'].map((f) => (
            <button
              key={f}
              className={'filter-btn' + (filter === f ? ' active' : '')}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'flagged' ? 'Flagged' : 'Low confidence'}
            </button>
          ))}
          <button className="filter-btn" onClick={() => exportCsv(false)}>
            Export CSV
          </button>
          <button className="filter-btn" onClick={() => exportCsv(true)}>
            Export corrected
          </button>
        </div>
      </div>

      <div className="scan-grid">
        {filtered.map((s) => (
          <div key={s.id} className="scan-card">
            <div className="scan-thumb">
              {s.image_url ? (
                <img src={s.image_url} alt="" className="scan-img" />
              ) : (
                s.disease
              )}
            </div>
            <div className="scan-body">
              <div className="scan-title-row">
                <span className="scan-title">{s.disease}</span>
                {s.flagged && <Badge color="red">flagged</Badge>}
                {s.corrected && <Badge color="blue">corrected</Badge>}
              </div>
              <p className="scan-meta">by {s.user}</p>
              <p className="scan-date">{s.date}</p>
              <div className="scan-footer">
                <span className={confidenceClass(s.confidence)}>
                  {(s.confidence * 100).toFixed(0)}% confidence
                </span>
                <button className="link-btn" onClick={() => openModal(s)}>
                  Review
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="scan-empty">No scans match this filter.</div>
        )}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Review scan"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setSelected(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={saveLabel}>
              Save correction
            </button>
          </>
        }
      >
        {selected && (
          <div className="stack-md">
            <div className="scan-thumb scan-thumb-lg">
              {selected.image_url ? (
                <img src={selected.image_url} alt="" className="scan-img" />
              ) : (
                selected.disease
              )}
            </div>

            <div>
              <div className="info-row">
                <span className="info-row-label">User</span>
                <span className="info-row-value">{selected.user}</span>
              </div>
              <div className="info-row">
                <span className="info-row-label">Region</span>
                <span className="info-row-value">{selected.region}</span>
              </div>
              <div className="info-row">
                <span className="info-row-label">Date</span>
                <span className="info-row-value">{selected.date}</span>
              </div>
              <div className="info-row">
                <span className="info-row-label">AI predicted</span>
                <span className="info-row-value">
                  {selected.disease} ({(selected.confidence * 100).toFixed(0)}%)
                </span>
              </div>
            </div>

            <div>
              <label className="label">Correct label</label>
              <select
                className="input"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              >
                {diseases.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}