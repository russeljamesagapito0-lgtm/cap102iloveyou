import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase, fmtDate } from '../lib/supabase';
import { downloadCsv } from '../lib/csv';
import Icon from './Icon';

const MENU_WIDTH = 240;
const MENU_HEIGHT = 220;
const VIEWPORT_PAD = 8;

const buildDashboardRows = (data) => [
  { metric: 'Exported at', value: fmtDate(new Date()) },
  { metric: 'Total scans', value: data.totalScans ?? 0 },
  { metric: 'Total users', value: data.totalUsers ?? 0 },
  { metric: 'Active users (7d)', value: data.activeUsers7d ?? 0 },
  { metric: 'Scans today', value: data.scansToday ?? 0 },
  { metric: '', value: '' },
  { metric: 'Day', value: 'Scans' },
  ...(data.scansPerDay || []).map((d) => ({ metric: d.day, value: d.count })),
];

const computePosition = (rect, align) => {
  let top, left;

  if (align === 'up') {
    top = rect.top - MENU_HEIGHT - VIEWPORT_PAD;
    left = rect.right + VIEWPORT_PAD;
  } else {
    top = rect.bottom + VIEWPORT_PAD;
    left = rect.right - MENU_WIDTH;
  }

  if (left + MENU_WIDTH > window.innerWidth - VIEWPORT_PAD) {
    left = window.innerWidth - MENU_WIDTH - VIEWPORT_PAD;
  }
  if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;
  if (top < VIEWPORT_PAD) top = rect.bottom + VIEWPORT_PAD;
  if (top + MENU_HEIGHT > window.innerHeight - VIEWPORT_PAD) {
    top = rect.top - MENU_HEIGHT - VIEWPORT_PAD;
  }

  return { top, left };
};

export default function SettingsMenu({ align = 'up' }) {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos(computePosition(rect, align));
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const roleLabel = (profile?.role || 'admin').toUpperCase();

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
  };

  const handleExport = async () => {
    setOpen(false);
    setExporting(true);
    try {
      const { data, error } = await supabase.rpc('admin_dashboard');
      if (error) throw error;

      const date = new Date().toISOString().slice(0, 10);
      downloadCsv(`rootcare-dashboard-${date}.csv`, buildDashboardRows(data));
    } catch (e) {
      alert('Export failed: ' + (e?.message || e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={'icon-btn' + (open ? ' active' : '')}
        onClick={() => setOpen((v) => !v)}
        aria-label="Settings"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Icon name="settings" size={18} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="settings-menu"
            style={{ position: 'fixed', top: pos.top, left: pos.left }}
            role="menu"
          >
            <div className="settings-menu-header">
              <p className="settings-menu-role">{roleLabel}</p>
              <p className="settings-menu-sub">Signed in as admin</p>
            </div>

            <div className="settings-menu-sep" />

            <button
              type="button"
              className="settings-menu-item"
              onClick={toggleDarkMode}
              role="menuitem"
            >
              <Icon name={isDarkMode ? 'sun' : 'moon'} size={16} />
              <span>{isDarkMode ? 'Light mode' : 'Dark mode'}</span>
              <span className={'toggle-pill' + (isDarkMode ? ' on' : '')}>
                <span className="toggle-dot" />
              </span>
            </button>

            <button
              type="button"
              className="settings-menu-item"
              onClick={handleExport}
              disabled={exporting}
              role="menuitem"
            >
              <Icon name="download" size={16} />
              <span>{exporting ? 'Exporting…' : 'Export report'}</span>
            </button>

            <div className="settings-menu-sep" />

            <button
              type="button"
              className="settings-menu-item danger"
              onClick={handleSignOut}
              role="menuitem"
            >
              <Icon name="logout" size={16} />
              <span>Sign out</span>
            </button>
          </div>,
          document.body
        )}
    </>
  );
}