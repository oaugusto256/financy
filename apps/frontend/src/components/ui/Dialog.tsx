import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

// Radix handles focus trapping, restoring focus on close, Escape, scroll
// locking and the ARIA wiring. Hand-rolling those is how a dialog ends up
// unusable by keyboard.
export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  children,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-gray-800/40" />
        <RadixDialog.Content
          className="fixed left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2
            -translate-y-1/2 rounded-xl bg-white p-6 shadow-lg focus:outline-none"
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <RadixDialog.Title className="text-base font-bold text-gray-800">
                {title}
              </RadixDialog.Title>
              {subtitle && (
                <RadixDialog.Description className="mt-0.5 text-sm text-gray-500">
                  {subtitle}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close
              aria-label="Fechar"
              className="rounded p-1 text-gray-500 hover:bg-gray-200
                focus:outline-none focus:ring-2 focus:ring-brand-base/30"
            >
              <X aria-hidden="true" className="size-4" />
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
