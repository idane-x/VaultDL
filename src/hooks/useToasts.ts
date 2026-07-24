import { useCallback, useState } from 'react';
import type { ToastMessage } from '../components/Toast';

export interface UseToastsResult {
  toasts: ToastMessage[];
  pushToast: (toast: Omit<ToastMessage, 'id'>) => string;
  dismissToast: (id: string) => void;
}

let seq = 0;

/** Minimal in-memory toast queue. No auto-dismiss timer — errors stay until the user reads them. */
export function useToasts(): UseToastsResult {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${++seq}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, pushToast, dismissToast };
}
