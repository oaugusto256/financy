import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';

/** The public shell: the logo above a centered card on gray-100. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Logo className="mb-6 h-9" />
      <Card className="w-full max-w-md p-8">{children}</Card>
    </main>
  );
}
