import { useState, useEffect, useMemo } from 'react';
import Modal from '../components/Modal';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../lib/supabase';
import { listAdmins, createAdmin, setAdminSuspended, resetAdminPassword } from '../lib/superadmin';

const EMPTY_FORM = { full_name: '', email: '', password: '' };

const statusClass = (status) =>
  'status-text ' + (status === 'active' ? 'status-active' : 'status-suspended');

const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
};

export default function SuperAdmin() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('active');
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPw, setResetPw] = useState('');
  const [showResetPw, setShowResetPw] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  const load = async () => {
    try {
      setAdmins(await listAdmins());
    } catch (e) {
      toast.error('Failed to load admins: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const activeCount = admins.filter((a) => a.status === 'active').length;
  const suspendedCount = admins.filter((a) => a.status === 'suspended').length;

  const visible = useMemo(() => {
    const q = query.toLowerCase();
    return admins.filter((a) => {
      if (a.status !== view) return false;
      if (!q) return true;
      return (a.full_name || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q);
    });
  }, [admins, view, query]);

  const closeCreate = () => {
    setCreateOpen(false);
    setForm(EMPTY_FORM);
    setShowPw(false);
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createAdmin(form);
      toast.success('Admin account created', { description: form.email });
      closeCreate();
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const closeReset = () => {
    setResetTarget(null);
    setResetPw('');
    setShowResetPw(false);
  };

  const submitReset = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await resetAdminPassword(resetTarget.id, resetPw);
      toast.success('Password reset', { description: resetTarget.email });
      closeReset();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (a) => {
    const suspend = a.status === 'active';
    const ok = await confirm({
      title: suspend ? 'Suspend admin?' : 'Reactivate admin?',
      message: suspend
        ? `${a.full_name || a.email} will be signed out and unable to sign in until reactivated.`
        : `${a.full_name || a.email} will be able to sign in again.`,
      confirmText: suspend ? 'Suspend' : 'Reactivate',
      tone: suspend ? 'danger' : 'primary',
    });
    if (!ok) return;

    setBusy(true);
    try {
      await setAdminSuspended(a.id, suspend);
      setAdmins((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, status: suspend ? 'suspended' : 'active' } : x))
      );
      toast.success(suspend ? 'Admin suspended' : 'Admin reactivated', { description: a.email });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const emptyMessage = loading
    ? 'Loading...'
    : query
    ? `No ${view} admins match your search.`
    : view === 'active'
    ? 'No active admins yet. Create one to get started.'
    : 'No suspended admins.';

  return (
    <div className="stack-lg">
      <div className="flex-between">
        <div className="filter-bar">
          <button className={'filter-btn' + (view === 'active' ? ' active' : '')} onClick={() => setView('active')}>
            Active ({activeCount})
          </button>
          <button className={'filter-btn' + (view === 'suspended' ? ' active' : '')} onClick={() => setView('suspended')}>
            Suspended ({suspendedCount})
          </button>
        </div>

        <div className="flex-center" style={{ gap: 10 }}>
          <input
            className="input"
            style={{ width: 280 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email..."
          />
          <button className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
            + Create admin
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Last active</th>
              <th>Created</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((a) => (
              <tr key={a.id}>
                <td className="cell-strong">{a.full_name || 'Unnamed'}</td>
                <td className="cell-muted">{a.email}</td>
                <td className="cell-muted">{fmtDate(a.last_active_at)}</td>
                <td className="cell-muted">{fmtDate(a.created_at)}</td>
                <td className={statusClass(a.status)}>{a.status}</td>
                <td className="text-right">
                  <button
                    className="link-btn"
                    style={{ marginRight: 12 }}
                    onClick={() => setResetTarget(a)}
                    disabled={busy}
                  >
                    Reset password
                  </button>
                  <button className="link-btn" onClick={() => toggle(a)} disabled={busy}>
                    {a.status === 'active' ? 'Suspend' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center text-muted">{emptyMessage}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={createOpen}
        onClose={closeCreate}
        title="Create admin account"
        footer={
          <>
            <button className="btn btn-outline" type="button" onClick={closeCreate}>Cancel</button>
            <button className="btn btn-primary" type="submit" form="create-admin-form" disabled={busy}>
              {busy ? 'Creating...' : 'Create admin'}
            </button>
          </>
        }
      >
        <form id="create-admin-form" onSubmit={submitCreate}>
          <div className="form-group">
            <label className="label">Full name</label>
            <input
              className="input"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Juan Dela Cruz"
            />
          </div>
          <div className="form-group">
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="label">Temporary password</label>
            <div className="flex-center" style={{ gap: 8 }}>
              <input
                className="input"
                type={showPw ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => { setForm({ ...form, password: generatePassword() }); setShowPw(true); }}
              >
                Generate
              </button>
            </div>
            <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
              At least 8 characters. Share it with the admin securely; it can't be viewed again.
            </p>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!resetTarget}
        onClose={closeReset}
        title="Reset admin password"
        footer={
          <>
            <button className="btn btn-outline" type="button" onClick={closeReset}>Cancel</button>
            <button className="btn btn-primary" type="submit" form="reset-admin-form" disabled={busy}>
              {busy ? 'Resetting...' : 'Reset password'}
            </button>
          </>
        }
      >
        <form id="reset-admin-form" onSubmit={submitReset}>
          <p className="text-muted" style={{ marginBottom: 12 }}>
            Set a new password for {resetTarget?.full_name || resetTarget?.email}. They will be signed
            out everywhere and must log in with the new password.
          </p>
          <div className="form-group">
            <label className="label">New password</label>
            <div className="flex-center" style={{ gap: 8 }}>
              <input
                className="input"
                type={showResetPw ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                value={resetPw}
                onChange={(e) => setResetPw(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => { setResetPw(generatePassword()); setShowResetPw(true); }}
              >
                Generate
              </button>
            </div>
            <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
              At least 8 characters. Copy it before submitting; it can't be viewed again.
            </p>
          </div>
        </form>
      </Modal>
    </div>
  );
}
