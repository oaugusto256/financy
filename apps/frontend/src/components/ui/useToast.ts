import { createContext, useContext } from 'react';

export type ToastVariant = 'success' | 'error';

export interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

// Exported from here rather than from Toast.tsx: a module that exports both a
// component and a non-component breaks react-refresh, which is the hazard
// slice 1 hit with SessionContext.
export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside a ToastProvider');
  return context;
}
