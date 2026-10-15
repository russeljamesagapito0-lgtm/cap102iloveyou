import { createPortal } from 'react-dom';
import { useTheme } from '../context/ThemeContext';
import { useToast as _unused } from '../context/ToastContext';
import Icon from './Icon';

import { useContext } from 'react';
import { ToastContext } from '../context/ToastContext';

export default function ToastContainer() {
  const { toasts, dismiss } = useContext(ToastContext);

  if (!toasts.length) return null;

  return createPortal(
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-icon">
            <Icon
              name={t.type === 'success' ? 'check' : t.type === 'error' ? 'alert' : 'bell'}
              size={16}
            />
          </span>
          <span className="toast-message">{t.message}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}