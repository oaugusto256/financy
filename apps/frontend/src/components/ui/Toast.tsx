import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import * as RadixToast from '@radix-ui/react-toast';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ToastContext, type ToastVariant } from './useToast';

interface ToastMessage {
  id: number;
  message: string;
  variant: ToastVariant;
}

const VARIANTS = {
  success: { icon: CheckCircle2, className: 'text-success' },
  error: { icon: XCircle, className: 'text-danger' },
} as const;

// Radix owns the timer, the swipe gesture, the live region and the focus
// behavior that returns the user where they were. The same reasoning as Dialog.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'success') => {
      nextId.current += 1;
      setToasts((current) => [
        ...current,
        { id: nextId.current, message, variant },
      ]);
    },
    [],
  );

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      <RadixToast.Provider swipeDirection="right" duration={5000}>
        {children}

        {toasts.map((toast) => {
          const { icon: Icon, className } = VARIANTS[toast.variant];

          return (
            <RadixToast.Root
              key={toast.id}
              open
              role="status"
              onOpenChange={(open) => !open && dismiss(toast.id)}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white
                px-4 py-3 shadow-lg"
            >
              <Icon aria-hidden="true" className={cn('size-4', className)} />
              <RadixToast.Title className="text-sm text-gray-800">
                {toast.message}
              </RadixToast.Title>
              <RadixToast.Close
                aria-label="Fechar aviso"
                className="ml-auto rounded p-1 text-gray-500 hover:bg-gray-200
                  focus:outline-none focus:ring-2 focus:ring-brand-base/30"
              >
                <X aria-hidden="true" className="size-4" />
              </RadixToast.Close>
            </RadixToast.Root>
          );
        })}

        <RadixToast.Viewport
          className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)]
            flex-col gap-2 outline-none"
        />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
