import { useState } from 'react';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { diseases as seed } from '../data/mockData';

export default function DiseaseContent() {
  const [diseases, setDiseases] = useState(seed);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);

  const openEdit = (d) => {
    setSelected(d);
    setDraft({ ...d });
  };

  const save = () => {
    if (!draft) return;
    setDiseases((prev) =>
      prev.map((d) =>
        d.id === draft.id
          ? { ...draft, updated: new Date().toISOString().slice(0, 10) }
          : d
      )
    );
    setSelected(null);
    setDraft(null);
  };

  const togglePublish = (d) => {
    setDiseases((prev) =>
      prev.map((x) => (x.id === d.id ? { ...x, published: !x.published } : x))
    );
  };

  const setField = (key, value) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  return (
    <div className="stack-lg">
      <div className="page-header">
        <h1 className="page-title">Disease Info</h1>
        <p className="page-subtitle">Manage content shown in the mobile app</p>
      </div>

      <div className="disease-grid">
        {diseases.map((d) => (
          <div key={d.id} className="disease-card">
            <div className="flex-between" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3>{d.name}</h3>
                <p className="meta">
                  {d.type} · Severity: {d.severity}
                </p>
              </div>
              <Badge color={d.published ? 'green' : 'gray'}>
                {d.published ? 'published' : 'draft'}
              </Badge>
            </div>

            <p className="body">{d.symptoms}</p>

            <div className="footer">
              <span className="updated">Updated {d.updated}</span>
              <div className="actions">
                <button
                  className="link-btn link-btn-muted"
                  onClick={() => togglePublish(d)}
                >
                  {d.published ? 'Unpublish' : 'Publish'}
                </button>
                <button className="link-btn" onClick={() => openEdit(d)}>
                  Edit
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={draft ? `Edit: ${draft.name}` : ''}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setSelected(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save}>
              Save changes
            </button>
          </>
        }
      >
        {draft && (
          <div className="stack-md">
            <div className="form-group">
              <label className="label">Name</label>
              <input
                className="input"
                value={draft.name}
                onChange={(e) => setField('name', e.target.value)}
              />
            </div>

            <div className="grid-2-1">
              <div className="form-group">
                <label className="label">Type</label>
                <input
                  className="input"
                  value={draft.type}
                  onChange={(e) => setField('type', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="label">Severity</label>
                <input
                  className="input"
                  value={draft.severity}
                  onChange={(e) => setField('severity', e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="label">Symptoms</label>
              <textarea
                className="input"
                rows={3}
                value={draft.symptoms}
                onChange={(e) => setField('symptoms', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="label">Treatment</label>
              <textarea
                className="input"
                rows={3}
                value={draft.treatment}
                onChange={(e) => setField('treatment', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="label">Prevention</label>
              <textarea
                className="input"
                rows={3}
                value={draft.prevention}
                onChange={(e) => setField('prevention', e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}