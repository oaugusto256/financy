import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Mail, User as UserIcon } from 'lucide-react';
import { z } from 'zod';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageShell } from '@/components/layout/PageShell';
import {
  useMeQuery,
  useUpdateProfileMutation,
} from '@/graphql/generated/graphql';
import { fieldErrorsOf } from '@/lib/graphql-errors';
import {
  useSession,
  type SessionUser,
} from '@/features/auth/useSession';

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Informe seu nome')
    .max(100, 'O nome deve ter no máximo 100 caracteres'),
});

type ProfileValues = z.infer<typeof profileSchema>;

function ProfileSkeleton() {
  return (
    <Card className="mx-auto max-w-lg p-8" aria-label="Carregando perfil">
      <div className="flex animate-pulse flex-col items-center gap-4">
        <span className="size-20 rounded-full bg-gray-200" />
        <span className="h-4 w-40 rounded bg-gray-200" />
        <span className="h-3 w-52 rounded bg-gray-200" />
      </div>
    </Card>
  );
}

function ProfileForm({ user }: { user: SessionUser }) {
  const { signOut } = useSession();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name },
  });

  const updateProfile = useUpdateProfileMutation({
    onSuccess: async () => {
      // The top bar and this page both read the current user from Me. Without
      // this the name updates in the form and stays stale everywhere else.
      await queryClient.invalidateQueries({ queryKey: useMeQuery.getKey() });
      setStatus('Alterações salvas');
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setStatus(null);
    setFormError(null);
    try {
      await updateProfile.mutateAsync({ input: { name: values.name } });
    } catch (error) {
      // Anything the server named a field for goes onto that field; the rest
      // is a form-level message. frontend.md section 8.
      const nameError = fieldErrorsOf(error).name?.[0];
      if (nameError) {
        form.setError('name', { message: nameError });
        return;
      }

      setFormError('Não foi possível salvar. Tente novamente.');
    }
  });

  return (
    <Card className="mx-auto flex max-w-lg flex-col items-center gap-6 p-8">
      <Avatar name={user.name} size="lg" />

      <div className="text-center">
        <p className="text-lg font-semibold text-gray-800">{user.name}</p>
        <p className="text-sm text-gray-500">{user.email}</p>
      </div>

      <form onSubmit={onSubmit} className="flex w-full flex-col gap-4" noValidate>
        {formError && (
          <p
            role="alert"
            className="rounded-lg bg-red-light px-3 py-2 text-sm text-red-dark"
          >
            {formError}
          </p>
        )}

        <Input
          label="Nome completo"
          icon={UserIcon}
          error={form.formState.errors.name?.message}
          {...form.register('name')}
        />

        <Input
          label="E-mail"
          icon={Mail}
          value={user.email}
          disabled
          readOnly
          helperText="O e-mail não pode ser alterado"
        />

        {/* An inline role="status" rather than a toast. frontend.md section 10
            specifies toasts; slice 2 builds that component, where three more
            mutations and two destructive confirmations need it and the shape
            of what it carries is actually known. */}
        {status && (
          <p role="status" className="text-sm text-success">
            {status}
          </p>
        )}

        <Button type="submit" disabled={updateProfile.isPending}>
          Salvar alterações
        </Button>
      </form>

      <Button
        variant="secondary"
        icon={LogOut}
        onClick={signOut}
        className="w-full text-danger"
      >
        Sair da conta
      </Button>
    </Card>
  );
}

export function ProfilePage() {
  const { user, isLoadingUser } = useSession();

  return (
    <PageShell title="Perfil" subtitle="Sua conta">
      {isLoadingUser || !user ? (
        <ProfileSkeleton />
      ) : (
        // Keyed on the user so React Hook Form's defaultValues are set once
        // the data exists rather than initialised empty.
        <ProfileForm key={user.id} user={user} />
      )}
    </PageShell>
  );
}
