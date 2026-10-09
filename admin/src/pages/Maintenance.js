import { useEffect, useState } from 'react';
import Badge from '../components/Badge';
import Icon from '../components/Icon';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../lib/supabase';
import {
  DEFAULT_MAINTENANCE,
  getSetting,
  saveSetting,
  auditSetting,
} from '../lib/appSettings';

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time.
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function Maintenance() {
  const confirm = useConfirm();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState(DEFAULT_MAINTENANCE);
  const [draft, setDraft] = useState(DEFAULT_MAINTENANCE);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    getSetting('maintenance')
      .then((row) => {
        const value = { ...DEFAULT_MAINTENANCE, ...(row?.value || {}) };
        setState(value);
        setDraft(value);
        setUpdatedAt(row?.updated_at || null);
      })
      .catch((e) => toast.error(`Could not load maintenance state: ${e.message}`))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = async (next, action) => {
    setSaving(true);
    try {
      await saveSetting('maintenance', next);
      await auditSetting(action, {
        enabled: next.enabled,
        message: next.message,
        eta: next.eta,
      });
      setState(next);
      setDraft(next);
      setUpdatedAt(new Date().toISOString());
      return true;
    } catch (e) {
      toast.error(`Save failed: ${e.message}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggle = async () => {
    const turningOn = !state.enabled;
    const ok = await confirm({
      title: turningOn ? 'Enable maintenance mode?' : 'Disable maintenance mode?',
      message: turningOn
        ? 'All users will be blocked from using the app until you turn this off. Anyone currently in the app will see the maintenance screen within about 30 seconds.'
        : 'The app will become usable again for everyone.',
      confirmText: turningOn ? 'Enable' : 'Disable',
      tone: turningOn ? 'danger' : 'primary',
    });
    if (!ok) return;

    const next = { ...draft, enabled: turningOn };
    if (await persist(next, turningOn ? 'maintenance.on' : 'maintenance.off')) {
      toast.success(turningOn ? 'Maintenance mode is ON' : 'Maintenance mode is OFF');
    }
  };

  const saveDetails = async () => {
    const next = { ...draft, enabled: state.enabled };
    if (await persist(next, 'maintenance.update')) {
      toast.success('Maintenance details saved');
    }
  };

  const dirty =
    draft.message !== state.message || (draft.eta || null) !== (state.eta || null);

  if (loading) return <p className="text-muted">Loading…</p>;

  return (
    <div className="stack-lg">
      <div className="card">
        <div className="flex-between">
          <div>
            <div className="card-title" style={{ marginBottom: 4 }}>
              Maintenance mode
            </div>
            <p className="page-subtitle">
              Blocks every user from the mobile app and shows them a maintenance screen.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Badge color={state.enabled ? 'red' : 'green'}>
              {state.enabled ? 'App is DOWN' : 'App is live'}
            </Badge>
            <button
              type="button"
              role="switch"
              aria-checked={state.enabled}
              aria-label="Toggle maintenance mode"
              className={'toggle-pill' + (state.enabled ? ' on' : '')}
              onClick={toggle}
              disabled={saving}
              style={{ cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              <span className="toggle-dot" />
            </button>
          </div>
        </div>

        {state.enabled && (
          <p
            style={{
              marginTop: 16,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              fontSize: 13,
              color: 'var(--warning-text)',
            }}
          >
            <Icon name="alert" size={16} />
            Users are currently locked out.
          </p>
        )}
      </div>

      <div className="card">
        <div className="card-title">What users will see</div>

        <div className="form-group">
          <label className="text-muted" style={{ fontSize: 13 }}>
            Message
          </label>
          <textarea
            className="input"
            rows={3}
            maxLength={300}
            value={draft.message}
            onChange={(e) => setDraft({ ...draft, message: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="text-muted" style={{ fontSize: 13 }}>
            Expected back (optional)
          </label>
          <input
            className="input"
            type="datetime-local"
            value={toLocalInput(draft.eta)}
            onChange={(e) =>
              setDraft({
                ...draft,
                eta: e.target.value ? new Date(e.target.value).toISOString() : null,
              })
            }
          />
        </div>

        <div className="flex-between">
          <span className="text-muted" style={{ fontSize: 12 }}>
            Last changed: {fmtDate(updatedAt)}
          </span>
          <button
            className="btn btn-primary"
            onClick={saveDetails}
            disabled={!dirty || saving || !draft.message.trim()}
          >
            Save details
          </button>
        </div>
      </div>
    </div>
  );
}