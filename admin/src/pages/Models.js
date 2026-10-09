import { useEffect, useState } from 'react';
import Badge from '../components/Badge';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../lib/supabase';
import {
  MODELS,
  DEFAULT_MODEL_ID,
  getSetting,
  saveSetting,
  auditSetting,
} from '../lib/appSettings';

export default function Models() {
  const confirm = useConfirm();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [activeId, setActiveId] = useState(DEFAULT_MODEL_ID);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    getSetting('active_model')
      .then((row) => {
        const id = row?.value?.id;
        if (MODELS.some((m) => m.id === id)) setActiveId(id);
        setUpdatedAt(row?.updated_at || null);
      })
      .catch((e) => toast.error(`Could not load active model: ${e.message}`))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activate = async (model) => {
    if (model.id === activeId) return;

    const ok = await confirm({
      title: `Switch to ${model.name}?`,
      message:
        'This changes which model the app is set to use. Make sure the model file is deployed on the backend and bundled in the app build before switching.',
      confirmText: 'Switch model',
    });
    if (!ok) return;

    setBusyId(model.id);
    try {
      await saveSetting('active_model', { id: model.id });
      await auditSetting('model.switch', { from: activeId, to: model.id });
      setActiveId(model.id);
      setUpdatedAt(new Date().toISOString());
      toast.success(`Active model: ${model.name}`);
    } catch (e) {
      toast.error(`Switch failed: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <p className="text-muted">Loading…</p>;

  return (
    <div className="stack-lg">
      <div className="flex-between">
        <p className="page-subtitle">
          Choose which model the app should use for disease detection.
        </p>
        <span className="text-muted" style={{ fontSize: 12 }}>
          Last changed: {fmtDate(updatedAt)}
        </span>
      </div>

      <div className="grid-2">
        {MODELS.map((m) => {
          const active = m.id === activeId;
          return (
            <div
              key={m.id}
              className="card"
              style={active ? { borderColor: 'var(--primary)' } : undefined}
            >
              <div className="flex-between" style={{ marginBottom: 12 }}>
                <div className="card-title" style={{ marginBottom: 0 }}>
                  {m.name}
                </div>
                <Badge color={active ? 'green' : 'gray'}>
                  {active ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
                {m.notes}
              </p>

              <dl style={{ fontSize: 13, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', marginBottom: 16 }}>
                <dt className="text-muted">File</dt>
                <dd style={{ wordBreak: 'break-all' }}>{m.file}</dd>
                <dt className="text-muted">Input</dt>
                <dd>{m.input}</dd>
                <dt className="text-muted">Classes</dt>
                <dd>{m.classes}</dd>
              </dl>

              <button
                className={active ? 'btn btn-outline btn-full' : 'btn btn-primary btn-full'}
                disabled={active || busyId !== null}
                onClick={() => activate(m)}
              >
                {active ? 'Currently in use' : busyId === m.id ? 'Switching…' : 'Use this model'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}