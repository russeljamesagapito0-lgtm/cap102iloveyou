import { useState, useEffect } from 'react';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabase';

const EMPTY = { code: '', name: '', type: '', severity: 'Medium', symptoms: '', treatment: '', prevention: '', published: false };
const slug = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export default function DiseaseContent() {
  const [diseases, setDiseases] = useState([]);
  const [draft, setDraft] = useState(null); // null = closed; draft.id present = editing
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from('diseases').select('*').order('name');
    if (error) alert(error.message);
    else setDiseases(data);
  };
  useEffect(() => { load(); }, []);

  const setField = (k, v) => setDraft((p) => ({ ...p, [k]: v }));
  const isNew = draft && !draft.id;

  const save = async () => {
    if (!draft.name.trim()) return alert('Name is required.');
    setBusy(true);
    const { id, ...rest } = draft;
    const row = { ...rest, code: slug(draft.code || draft.name), updated_at: new Date().toISOString() };
    const { error } = id
      ? await supabase.from('diseases').update(row).eq('id', id)
      : await supabase.from('diseases').insert(row);
    setBusy(false);
    if (error) return alert(error.message.includes('duplicate') ? 'That code already exists.' : error.message);
    setDraft(null);
    load();
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${draft.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('diseases').delete().eq('id', draft.id);
    if (error) return alert(error.message);
    setDraft(null);
    load();
  };

  const togglePublish = async (d) => {
    const { error } = await supabase
      .from('diseases')
      .update({ published: !d.published, updated_at: new Date().toISOString() })
      .eq('id', d.id);
    if (error) return alert(error.message);
    setDiseases((prev) => prev.map((x) => (x.id === d.id ? { ...x, published: !d.published } : x)));
  };

  const area = (key, label) => (
    <div className="form-group">
      <label className="label">{label}</label>
      <textarea className="input" rows={3} value={draft[key] || ''} onChange={(e) => setField(key, e.target.value)} />
    </div>
  );

  return (
    <div className="stack-lg">
      <div className="flex-between">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Disease Info</h1>
          <p className="page-subtitle">Manage content shown in the mobile app</p>
        </div>
        <button className="btn btn-primary" onClick={() => setDraft({ ...EMPTY })}>
          + Add disease
        </button>
      </div>

      <div className="disease-grid">
        {diseases.map((d) => (
          <div key={d.id} className="disease-card">
            <div className="flex-between" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3>{d.name}</h3>
                <p className="meta">{d.type || '-'} · Severity: {d.severity || '-'}</p>
              </div>
              <Badge color={d.published ? 'green' : 'gray'}>{d.published ? 'published' : 'draft'}</Badge>
            </div>

            <p className="body">{d.symptoms}</p>

            <div className="footer">
              <span className="updated">Updated {d.updated_at?.slice(0, 10)}</span>
              <div className="actions">
                <button className="link-btn link-btn-muted" onClick={() => togglePublish(d)}>
                  {d.published ? 'Unpublish' : 'Publish'}
                </button>
                <button className="link-btn" onClick={() => setDraft({ ...d })}>Edit</button>
              </div>
            </div>
          </div>
        ))}
        {diseases.length === 0 && <p className="text-muted">No disease entries yet.</p>}
      </div>

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={isNew ? 'Add disease' : `Edit: ${draft?.name}`}
        footer={
          <>
            {!isNew && (
              <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={remove}>Delete</button>
            )}
            <button className="btn btn-outline" onClick={() => setDraft(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {isNew ? 'Create' : 'Save changes'}
            </button>
          </>
        }
      >
        {draft && (
          <div className="stack-md">
            <div className="form-group">
              <label className="label">Name</label>
              <input className="input" value={draft.name} onChange={(e) => setField('name', e.target.value)} />
            </div>

            <div className="form-group">
              <label className="label">Code (must match the model's class label)</label>
              <input
                className="input"
                placeholder={slug(draft.name) || 'auto from name'}
                value={draft.code}
                onChange={(e) => setField('code', e.target.value)}
              />
            </div>

            <div className="grid-2-1">
              <div className="form-group">
                <label className="label">Type</label>
                <input className="input" placeholder="Viral, Fungal, Pest..." value={draft.type || ''} onChange={(e) => setField('type', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Severity</label>
                <select className="input" value={draft.severity || 'Medium'} onChange={(e) => setField('severity', e.target.value)}>
                  {['None', 'Low', 'Medium', 'High'].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {area('symptoms', 'Symptoms')}
            {area('treatment', 'Treatment')}
            {area('prevention', 'Prevention')}

            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
              <input type="checkbox" checked={draft.published} onChange={(e) => setField('published', e.target.checked)} />
              Published (visible in the mobile app)
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
