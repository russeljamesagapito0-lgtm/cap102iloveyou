import { useState, useEffect } from 'react';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { supabase, logAudit } from '../lib/supabase';

// Add more languages here, e.g. { code: 'ceb', label: 'Cebuano' }
const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'fil', label: 'Filipino' }
];
const TR_FIELDS = ['name', 'symptoms', 'treatment', 'prevention'];
const EMPTY = { code: '', name: '', type: '', severity: 'Medium', symptoms: '', treatment: '', prevention: '', published: false, tr: {} };
const slug = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export default function DiseaseContent() {
  const [diseases, setDiseases] = useState([]);
  const [draft, setDraft] = useState(null); // null = closed; draft.id present = editing
  const [lang, setLang] = useState('en');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from('diseases').select('*, disease_translations(lang)').order('name');
    if (error) alert(error.message);
    else setDiseases(data);
  };
  useEffect(() => { load(); }, []);

  const isNew = draft && !draft.id;

  const openNew = () => { setLang('en'); setDraft({ ...EMPTY, tr: {} }); };

  const openEdit = async (d) => {
    setLang('en');
    setDraft({ ...d, tr: {} });
    const { data } = await supabase.from('disease_translations').select('*').eq('disease_id', d.id);
    setDraft((p) => (p && p.id === d.id ? { ...p, tr: Object.fromEntries((data || []).map((t) => [t.lang, t])) } : p));
  };

  const val = (k) => (lang === 'en' ? draft[k] || '' : draft.tr?.[lang]?.[k] || '');
  const setVal = (k, v) =>
    lang === 'en'
      ? setDraft((p) => ({ ...p, [k]: v }))
      : setDraft((p) => ({ ...p, tr: { ...p.tr, [lang]: { ...p.tr?.[lang], [k]: v } } }));

  const save = async () => {
    if (!draft.name.trim()) return alert('English name is required.');
    setBusy(true);
    const { id, tr = {}, disease_translations, ...rest } = draft;
    const now = new Date().toISOString();
    const row = { ...rest, code: slug(draft.code || draft.name), updated_at: now };

    let did = id, error;
    if (id) {
      ({ error } = await supabase.from('diseases').update(row).eq('id', id));
    } else {
      const r = await supabase.from('diseases').insert(row).select('id').single();
      error = r.error;
      did = r.data?.id;
    }
    if (error) {
      setBusy(false);
      return alert(error.message.includes('duplicate') ? 'That code already exists.' : error.message);
    }

    const translated = [];
    for (const l of LANGS.filter((x) => x.code !== 'en')) {
      const t = tr[l.code] || {};
      if (TR_FIELDS.some((f) => (t[f] || '').trim())) {
        const payload = Object.fromEntries(TR_FIELDS.map((f) => [f, (t[f] || '').trim() || null]));
        const r = await supabase
          .from('disease_translations')
          .upsert({ disease_id: did, lang: l.code, ...payload, updated_at: now }, { onConflict: 'disease_id,lang' });
        if (r.error) alert(`${l.label}: ${r.error.message}`);
        translated.push(l.code);
      } else if (id) {
        await supabase.from('disease_translations').delete().eq('disease_id', did).eq('lang', l.code);
      }
    }

    logAudit(id ? 'update' : 'create', 'disease', did, { name: draft.name, translations: translated });
    setBusy(false);
    setDraft(null);
    load();
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${draft.name}" and its translations? This cannot be undone.`)) return;
    const { error } = await supabase.from('diseases').delete().eq('id', draft.id);
    if (error) return alert(error.message);
    logAudit('delete', 'disease', draft.id, { name: draft.name });
    setDraft(null);
    load();
  };

  const togglePublish = async (d) => {
    const { error } = await supabase
      .from('diseases')
      .update({ published: !d.published, updated_at: new Date().toISOString() })
      .eq('id', d.id);
    if (error) return alert(error.message);
    logAudit('update', 'disease', d.id, { name: d.name, published: !d.published });
    setDiseases((prev) => prev.map((x) => (x.id === d.id ? { ...x, published: !d.published } : x)));
  };

  const field = (k, label, textarea = true) => (
    <div className="form-group">
      <label className="label">{label}</label>
      {textarea ? (
        <textarea className="input" rows={3} value={val(k)} placeholder={lang === 'en' ? '' : draft[k]} onChange={(e) => setVal(k, e.target.value)} />
      ) : (
        <input className="input" value={val(k)} placeholder={lang === 'en' ? '' : draft[k]} onChange={(e) => setVal(k, e.target.value)} />
      )}
    </div>
  );

  return (
    <div className="stack-lg">
      <div className="flex-between">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Disease Info</h1>
          <p className="page-subtitle">Manage content shown in the mobile app</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Add disease</button>
      </div>

      <div className="disease-grid">
        {diseases.map((d) => (
          <div key={d.id} className="disease-card">
            <div className="flex-between" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3>{d.name}</h3>
                <p className="meta">
                  {d.type || '-'} · Severity: {d.severity || '-'}
                  {d.disease_translations?.length > 0 &&
                    ` · ${d.disease_translations.map((t) => t.lang.toUpperCase()).join(', ')}`}
                </p>
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
                <button className="link-btn" onClick={() => openEdit(d)}>Edit</button>
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
            {!isNew && <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={remove}>Delete</button>}
            <button className="btn btn-outline" onClick={() => setDraft(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{isNew ? 'Create' : 'Save changes'}</button>
          </>
        }
      >
        {draft && (
          <div className="stack-md">
            <div className="filter-bar" style={{ alignSelf: 'flex-start' }}>
              {LANGS.map((l) => (
                <button key={l.code} className={'filter-btn' + (lang === l.code ? ' active' : '')} onClick={() => setLang(l.code)}>
                  {l.label}
                </button>
              ))}
            </div>

            {lang !== 'en' && (
              <p className="text-muted" style={{ fontSize: 12 }}>
                Leave a field blank to fall back to English in the app.
              </p>
            )}

            {field('name', 'Name', false)}

            {lang === 'en' && (
              <>
                <div className="form-group">
                  <label className="label">Code (must match the model's class label)</label>
                  <input className="input" placeholder={slug(draft.name) || 'auto from name'} value={draft.code} onChange={(e) => setVal('code', e.target.value)} />
                </div>
                <div className="grid-2-1">
                  <div className="form-group">
                    <label className="label">Type</label>
                    <input className="input" placeholder="Viral, Fungal, Pest..." value={draft.type || ''} onChange={(e) => setVal('type', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="label">Severity</label>
                    <select className="input" value={draft.severity || 'Medium'} onChange={(e) => setVal('severity', e.target.value)}>
                      {['None', 'Low', 'Medium', 'High'].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}

            {field('symptoms', 'Symptoms')}
            {field('treatment', 'Treatment')}
            {field('prevention', 'Prevention')}

            {lang === 'en' && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                <input type="checkbox" checked={draft.published} onChange={(e) => setVal('published', e.target.checked)} />
                Published (visible in the mobile app)
              </label>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
