import React, { useState, useCallback } from 'react';

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let toastCounter = 0;

export const ToastContainer: React.FC<{
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}> = ({ toasts, onDismiss }) => (
  <div
    className="fixed bottom-6 right-6 z-[300] flex flex-col gap-2 pointer-events-none max-w-sm"
    aria-live="polite"
  >
    {toasts.map((t) => (
      <div
        key={t.id}
        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl font-mono-custom text-xs tracking-wide backdrop-blur-xl transition-all duration-300 motion-reduce:transition-none ${
          t.type === 'success'
            ? 'bg-dark-100/95 border-eg/40 text-eg'
            : t.type === 'error'
            ? 'bg-dark-100/95 border-red-500/40 text-red-300'
            : 'bg-dark-100/95 border-white/20 text-white/80'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            t.type === 'success' ? 'bg-eg' : t.type === 'error' ? 'bg-red-400' : 'bg-white/50'
          }`}
        />
        <span className="flex-1">{t.message}</span>
        <button
          type="button"
          onClick={() => onDismiss(t.id)}
          className="text-white/30 hover:text-white ml-1 flex-shrink-0"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    ))}
  </div>
);

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const show = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, show, dismiss };
}
