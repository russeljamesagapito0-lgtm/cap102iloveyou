import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import { supabase, fmtDate, logAudit } from '../lib/supabase';

const mapProfile = (p) => ({
  id: p.id,
  name: p.full_name || p.email || 'Unnamed',
  email: p.email || '-',
  scans: p.scans?.[0]?.count ?? 0,
  lastActive: fmtDate(p.last_active_at),
  status: p.status,
});

const statusClass = (status) =>
  'status-text ' + (status === 'active' ? 'status-active' : 'status-suspended');

export default function Users() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*, scans(count)')
      .order('created_at', { ascending: false })
      .then(({ data }) => setUsers((data || []).map(mapProfile)));
  }, []);

  const filtered = users.filter((u) => {
    const q = query.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const toggleStatus = async () => {
    if (!selected) return;

    const status = selected.status === 'active' ? 'suspended' : 'active';
    const { error } = await supabase
      .from('profiles')
      .update({ status })
      .eq('id', selected.id);

    if (error) return alert(error.message);

    logAudit(
      status === 'suspended' ? 'suspend' : 'reactivate',
      'user',
      selected.id,
      { email: selected.email }
    );

    setUsers((prev) =>
      prev.map((u) => (u.id === selected.id ? { ...u, status } : u))
    );
    setSelected(null);
  };

  const isActive = selected?.status === 'active';

  return (
    <div className="stack-lg">
      <div className="flex-between">
        <p className="page-subtitle">{users.length} total users</p>
        <input
          className="input"
          style={{ width: 300 }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email..."
        />
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
            {filtered.map((u) => (
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center text-muted">
                  No users found.
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
            <button className="btn btn-outline" onClick={() => setSelected(null)}>
              Cancel
            </button>
            <button
              className={'btn ' + (isActive ? 'btn-danger' : 'btn-primary')}
              onClick={toggleStatus}
            >
              {isActive ? 'Suspend user' : 'Reactivate user'}
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