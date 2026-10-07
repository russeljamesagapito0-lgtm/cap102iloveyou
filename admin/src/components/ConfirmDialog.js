import { createContext, useContext, useState, useCallback } from 'react';
import Modal from './Modal';

const ConfirmContext = createContext();

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setState({
        ...options,
        onResolve: (ok) => {
          setState(null);
          resolve(ok);
        },
      });
    });
  }, []);

  const tone = state?.tone || 'primary';
  const confirmClass = tone === 'danger' ? 'btn btn-danger' : 'btn btn-primary';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => state?.onResolve(false)}
        title={state?.title || ''}
        footer={
          <>
            <button
              className="btn btn-outline"
              onClick={() => state?.onResolve(false)}
            >
              {state?.cancelText || 'Cancel'}
            </button>
            <button
              className={confirmClass}
              onClick={() => state?.onResolve(true)}
            >
              {state?.confirmText || 'Confirm'}
            </button>
          </>
        }
      >
        {state?.message && (
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)' }}>
            {state.message}
          </p>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
};