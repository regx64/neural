import { useEffect } from 'react';
import { useLab } from '@state/store';
import styles from './Toast.module.css';

const DURATION_MS = 3200;

export function Toast() {
  const toast = useLab((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => {
      if (useLab.getState().toast?.id === toast.id) useLab.setState({ toast: null });
    }, DURATION_MS);
    return () => clearTimeout(id);
  }, [toast]);
  if (!toast) return null;
  return (
    <div key={toast.id} className={styles.toast} role="status" data-testid="toast">
      {toast.text}
    </div>
  );
}
