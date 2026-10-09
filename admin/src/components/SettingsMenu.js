import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from './ConfirmDialog';
import Icon from './Icon';

const MENU_WIDTH = 240;
const MENU_HEIGHT = 200;
const VIEWPORT_PAD = 8;

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

export default function SettingsMenu({ align = 'down' }) {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const confirm = useConfirm();

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
    const ok = await confirm({
      title: 'Sign out?',
      message: 'You will need to sign in again to continue.',
      confirmText: 'Sign out',
      tone: 'danger',
    });
    if (!ok) return;
    await signOut();
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