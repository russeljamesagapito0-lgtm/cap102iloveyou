import { useState, useEffect } from 'react';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { supabase, fmtDate } from '../lib/supabase';

export default function Scans() {
  const [scans, setScans] = useState([]);
  const [diseases, setDiseases] = useState([]);

  useEffect(() => {
    (async () => {
      const { data: d } = await supabase.from('diseases').select('code,name').order('name');
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
          disease: names[s.disease_code] || s.disease_code || 'Unknown',
          user: s.profiles?.full_name || s.profiles?.email || 'Unknown',
          confidence: Number(s.confidence ?? 0),
          date: fmtDate(s.created_at),
          region: s.region || '-',
          image_url: s.image_url,
          flagged: s.flagged,
          corrected: s.corrected
        }))
      );
    })();
  }, []);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [newLabel, setNewLabel] = useState('');

  const filtered = scans.filter((s) => {
    if (filter === 'flagged') return s.flagged;
    if (filter === 'low') return s.confidence < 0.7;
    return true;
  });

  const openModal = (s) => {
    setSelected(s);
    setNewLabel(s.code || '');
  };

  const saveLabel = async () => {
    if (!selected) return;
    const { error } = await supabase
      .from('scans')
      .update({ disease_code: newLabel, flagged: false, corrected: true })
      .eq('id', selected.id);
    if (error) return alert(error.message);
    const name = diseases.find((d) => d.code === newLabel)?.name || newLabel;
    setScans((prev) =>
      prev.map((s) =>
        s.id === selected.id
          ? { ...s, code: newLabel, disease: name, flagged: false, corrected: true }
          : s
      )
    );
    setSelected(null);
  };

  const confidenceClass = (c) => {
    if (c >= 0.8) return 'confidence confidence-high';
    if (c >= 0.6) return 'confidence confidence-mid';
    return 'confidence confidence-low';
  };

  return (
    <div className="stack-lg">
      <div className="flex-between">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Scans</h1>
          <p className="page-subtitle">
            {scans.length} scans · {scans.filter((s) => s.flagged).length} flagged for review
          </p>
        </div>

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
        </div>
      </div>

      <div className="scan-grid">
        {filtered.map((s) => (
          <div key={s.id} className="scan-card">
            <div className="scan-thumb">
              {s.image_url ? <img src={s.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : s.disease}
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
          <div className="text-center text-muted" style={{ gridColumn: '1 / -1', padding: '40px 0' }}>
            No scans match this filter.
          </div>
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
            <div className="scan-thumb" style={{ height: 160, borderRadius: 8 }}>
              {selected.image_url ? <img src={selected.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : selected.disease}
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