import { useState, useEffect, useMemo } from 'react';
import Modal from '../components/Modal';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { downloadCsv } from '../lib/csv';
import { supabase, fmtDate, logAudit } from '../lib/supabase';

const PAGE_SIZE = 1000;

const mapProfile = (p) => ({
  id: p.id,
  name: p.full_name || 'Unnamed',
  email: p.email || '-',
  scans: p.scans?.[0]?.count ?? 0,
  lastActive: fmtDate(p.last_active_at),
  status: p.status,
});

const statusClass = (status) =>
  'status-text ' + (status === 'active' ? 'status-active' : 'status-suspended');

const fetchAll = async (query) => {
  let rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows = rows.concat(data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
};

const toUserBackupRows = (profile, scans) => {
  const rows = [
    {
      section: 'profile',
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      status: profile.status,
      last_active_at: profile.last_active_at,
      created_at: profile.created_at,
      disease_code: '',
      predicted_code: '',
      confidence: '',
      region: '',
      flagged: '',
      corrected: '',
      scan_created_at: '',
      image_url: '',
    },
  ];

  for (const s of scans) {
    rows.push({
      section: 'scan',
      id: s.id,
      email: '',
      full_name: '',
      role: '',
      status: '',
      last_active_at: '',
      created_at: '',
      disease_code: s.disease_code,
      predicted_code: s.predicted_code,
      confidence: s.confidence,
      region: s.region,
      flagged: s.flagged,
      corrected: s.corrected,
      scan_created_at: s.created_at,
      image_url: s.image_url,
    });
  }

  return rows;
};

const toGlobalBackupRows = (profiles, scans) => {
  const rows = [];

  for (const p of profiles) {
    rows.push({
      section: 'profile',
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      role: p.role,
      status: p.status,
      last_active_at: p.last_active_at,
      created_at: p.created_at,
      disease_code: '',
      predicted_code: '',
      confidence: '',
      region: '',
      flagged: '',
      corrected: '',
      scan_created_at: '',
      image_url: '',
    });
  }

  rows.push({
    section: '--- scans below ---',
    id: '',
    email: '',
    full_name: '',
    role: '',
    status: '',
    last_active_at: '',
    created_at: '',
    disease_code: '',
    predicted_code: '',
    confidence: '',
    region: '',
    flagged: '',
    corrected: '',
    scan_created_at: '',
    image_url: '',
  });

  for (const s of scans) {
    rows.push({
      section: 'scan',
      id: s.id,
      email: '',
      full_name: '',
      role: '',
      status: '',
      last_active_at: '',
      created_at: '',
      disease_code: s.disease_code,
      predicted_code: s.predicted_code,
      confidence: s.confidence,
      region: s.region,
      flagged: s.flagged,
      corrected: s.corrected,
      scan_created_at: s.created_at,
      image_url: s.image_url,
    });
  }

  return rows;
};

const slugify = (s) =>
  (s || 'user').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const datedName = (base) => {
  const date = new Date().toISOString().slice(0, 10);
  return `${base}_${date}.csv`;
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [view, setView] = useState('active');
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*, scans(count)')
      .order('created_at', { ascending: false })
      .then(({ data }) => setUsers((data || []).map(mapProfile)));
  }, []);

  const activeCount = users.filter((u) => u.status === 'active').length;
  const suspendedCount = users.filter((u) => u.status === 'suspended').length;

  const visibleUsers = useMemo(() => {
    const q = query.toLowerCase();
    return users.filter((u) => {
      if (u.status !== view) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    });
  }, [users, view, query]);

  const toggleStatus = async () => {
    if (!selected) return;

    const isActive = selected.status === 'active';
    const nextStatus = isActive ? 'suspended' : 'active';

    const ok = await confirm({
      title: isActive ? 'Suspend user?' : 'Reactivate user?',
      message: isActive
        ? `${selected.name} will lose access to RootCare until reactivated.`
        : `${selected.name} will regain access to RootCare.`,
      confirmText: isActive ? 'Suspend' : 'Reactivate',
      tone: isActive ? 'danger' : 'primary',
    });

    if (!ok) return;

    const { error } = await supabase
      .from('profiles')
      .update({ status: nextStatus })
      .eq('id', selected.id);

    if (error) {
      toast.error('Failed to update user: ' + error.message);
      return;
    }

    logAudit(isActive ? 'suspend' : 'reactivate', 'user', selected.id, {
      email: selected.email,
    });

    setUsers((prev) =>
      prev.map((u) => (u.id === selected.id ? { ...u, status: nextStatus } : u))
    );

    toast.success(isActive ? 'User suspended' : 'User reactivated', {
      description: selected.name,
    });

    setSelected(null);
  };

  const backupUser = async () => {
    if (!selected) return;

    const ok = await confirm({
      title: `Backup ${selected.name}?`,
      message:
        'This will download a CSV containing this user’s profile and scan history. Handle the file carefully.',
      confirmText: 'Download',
      tone: 'primary',
    });
    if (!ok) return;

    setBusy(true);
    try {
      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', selected.id)
        .single();
      if (pErr) throw pErr;

      const scans = await fetchAll(
        supabase
          .from('scans')
          .select('*')
          .eq('user_id', selected.id)
          .order('created_at', { ascending: false })
      );

      const rows = toUserBackupRows(profile, scans);
      downloadCsv(datedName(`user_${slugify(selected.name)}`), rows);
      logAudit('backup.user', 'user', selected.id, {
        scans: scans.length,
        email: selected.email,
      });
      toast.success('Backup downloaded', {
        description: `${scans.length} scans`,
      });
    } catch (e) {
      toast.error('Backup failed: ' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const backupAll = async () => {
    const ok = await confirm({
      title: 'Backup all users and scans?',
      message:
        'This will download a CSV containing every profile and every scan in the system. This file may be large. Handle it carefully.',
      confirmText: 'Download',
      tone: 'primary',
    });
    if (!ok) return;

    setBusy(true);
    try {
      const profiles = await fetchAll(
        supabase.from('profiles').select('*').order('created_at')
      );
      const scans = await fetchAll(
        supabase.from('scans').select('*').order('created_at')
      );

      const rows = toGlobalBackupRows(profiles, scans);
      downloadCsv(datedName('rootcare_full_backup'), rows);
      logAudit('backup.all', 'backup', null, {
        profiles: profiles.length,
        scans: scans.length,
      });
      toast.success('Full backup downloaded', {
        description: `${profiles.length} users · ${scans.length} scans`,
      });
    } catch (e) {
      toast.error('Backup failed: ' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const selectedIsActive = selected?.status === 'active';

  const emptyMessage =
    view === 'active'
      ? query
        ? 'No active users match your search.'
        : 'No active users.'
      : query
      ? 'No suspended users match your search.'
      : 'No suspended accounts.';

  return (
    <div className="stack-lg">
      <div className="flex-between">
        <div className="filter-bar">
          <button
            className={'filter-btn' + (view === 'active' ? ' active' : '')}
            onClick={() => setView('active')}
          >
            Active ({activeCount})
          </button>
          <button
            className={'filter-btn' + (view === 'suspended' ? ' active' : '')}
            onClick={() => setView('suspended')}
          >
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
          <button
            className="btn btn-outline btn-sm"
            onClick={backupAll}
            disabled={busy}
          >
            {busy ? 'Preparing…' : 'Backup all'}
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th className="text-right">Scans</th>
              <th>Last active</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((u) => (
              <tr key={u.id}>
                <td className="cell-strong">{u.name}</td>
                <td className="cell-muted">{u.email}</td>
                <td className="text-right">{u.scans}</td>
                <td className="cell-muted">{u.lastActive}</td>
                <td className={statusClass(u.status)}>{u.status}</td>
                <td className="text-right">
                  <button className="link-btn" onClick={() => setSelected(u)}>
                    Manage
                  </button>
                </td>
              </tr>
            ))}
            {visibleUsers.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center text-muted">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Manage ${selected.name}` : ''}
        footer={
          <>
            <button
              className="btn btn-outline"
              onClick={backupUser}
              disabled={busy}
            >
              {busy ? 'Preparing…' : 'Backup user'}
            </button>
            <button className="btn btn-outline" onClick={() => setSelected(null)}>
              Cancel
            </button>
            <button
              className={'btn ' + (selectedIsActive ? 'btn-danger' : 'btn-primary')}
              onClick={toggleStatus}
            >
              {selectedIsActive ? 'Suspend user' : 'Reactivate user'}
            </button>
          </>
        }
      >
        {selected && (
          <div>
            <div className="info-row">
              <span className="info-row-label">Email</span>
              <span className="info-row-value">{selected.email}</span>
            </div>
            <div className="info-row">
              <span className="info-row-label">Total scans</span>
              <span className="info-row-value">{selected.scans}</span>
            </div>
            <div className="info-row">
              <span className="info-row-label">Last active</span>
              <span className="info-row-value">{selected.lastActive}</span>
            </div>
            <div className="info-row">
              <span className="info-row-label">Status</span>
              <span className={statusClass(selected.status)}>{selected.status}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}