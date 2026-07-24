export interface ToastMessage {
  id: string;
  variant: 'error' | 'info';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface ToastStackProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

/**
 * A stack of dismissible banner notices, fixed to the top of the viewport. Used to
 * surface errors (e.g. enqueue failures) that would otherwise only hit console.error.
 */
export default function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm shadow-2xl backdrop-blur ${
            toast.variant === 'error'
              ? 'border-rose-500/40 bg-rose-950/90 text-rose-100'
              : 'border-vault-accent/40 bg-vault-panel text-vault-text'
          }`}
        >
          <span className="shrink-0 text-base">{toast.variant === 'error' ? '⚠️' : 'ℹ️'}</span>
          <span className="flex-1">{toast.message}</span>
          {toast.actionLabel && toast.onAction && (
            <button
              type="button"
              onClick={() => {
                toast.onAction?.();
                onDismiss(toast.id);
              }}
              className="shrink-0 rounded-md bg-vault-accent px-2.5 py-1 text-xs font-medium text-vault-bg hover:brightness-110"
            >
              {toast.actionLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss"
            className="shrink-0 text-vault-muted hover:text-vault-text"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
