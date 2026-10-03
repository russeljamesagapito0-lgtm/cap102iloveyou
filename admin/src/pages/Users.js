import { useState, useEffect } from 'react';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { supabase, fmtDate } from '../lib/supabase';

export default function Users() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*, scans(count)')
      .order('created_at', { ascending: false })
      .then(({ data }) =>
        setUsers(
          (data || []).map((p) => ({
            id: p.id,
            name: p.full_name || p.email || 'Unnamed',
            email: p.email || '-',
            plan: p.plan,
            region: p.region || '-',
            scans: p.scans?.[0]?.count ?? 0,
            lastActive: fmtDate(p.last_active_at),
            status: p.status
          }))
        )
      );
  }, []);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);

  const filtered = users.filter((u) => {
    const q = query.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const toggleStatus = async () => {
    if (!selected) return;
    const status = selected.status === 'active' ? 'suspended' : 'active';
    const { error } = await supabase.from('profiles').update({ status }).eq('id', selected.id);
    if (error) return alert(error.message);
    setUsers((prev) => prev.map((u) => (u.id === selected.id ? { ...u, status } : u)));
    setSelected(null);
  };

  return (
    <div className="stack-lg">
      <div className="flex-between">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">{users.length} total users</p>
        </div>

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
              <th>Plan</th>
              <th>Region</th>
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
                <td>
                  <Badge color={u.plan === 'premium' ? 'blue' : 'gray'}>
                    {u.plan}
                  </Badge>
                </td>
                <td>{u.region}</td>
                <td className="text-right">{u.scans}</td>
                <td className="cell-muted">{u.lastActive}</td>
                <td>
                  <Badge color={u.status === 'active' ? 'green' : 'red'}>
                    {u.status}
                  </Badge>
                </td>
                <td className="text-right">
                  <button
                    className="link-btn"
                    onClick={() => setSelected(u)}
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="8" className="text-center text-muted">
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
            <button
              className="btn btn-outline"
              onClick={() => setSelected(null)}
            >
              Cancel
            </button>
            <button
              className={
                'btn ' +
                (selected?.status === 'active' ? 'btn-danger' : 'btn-primary')
              }
              onClick={toggleStatus}
            >
              {selected?.status === 'active'
                ? 'Suspend user'
                : 'Reactivate user'}
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
              <span className="info-row-label">Plan</span>
              <span className="info-row-value">{selected.plan}</span>
            </div>
            <div className="info-row">
              <span className="info-row-label">Region</span>
              <span className="info-row-value">{selected.region}</span>
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
              <span className="info-row-value">
                <Badge color={selected.status === 'active' ? 'green' : 'red'}>
                  {selected.status}
                </Badge>
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}