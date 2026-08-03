import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { TextLink } from '@/components/ui/TextLink';
import { useSignInMutation } from '@/graphql/generated/graphql';
import { errorCodeOf } from '@/lib/graphql-errors';
import { AuthLayout } from './AuthLayout';
import { useSession } from './useSession';
import { signInSchema, type SignInValues } from './validation';

export function LoginPage() {
  const { signIn } = useSession();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '', remember: false },
  });

  const signInMutation = useSignInMutation();

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const data = await signInMutation.mutateAsync({
        input: { email: values.email, password: values.password },
      });
      signIn(data.signIn.token, data.signIn.user, values.remember);
    } catch (error) {
      // Every failure here renders at form level. INVALID_CREDENTIALS covers
      // both an unknown email and a wrong password by design, and attaching it
      // to the email field would undo that.
      setFormError(
        errorCodeOf(error) === 'INVALID_CREDENTIALS'
          ? 'E-mail ou senha incorretos'
          : 'Não foi possível entrar. Tente novamente.',
      );
    }
  });

  return (
    <AuthLayout>
      <h1 className="text-2xl font-bold text-gray-800">Fazer login</h1>
      <p className="mt-1 text-sm text-gray-500">
        Entre na sua conta para continuar
      </p>

      {/* noValidate: the browser's own validation bubble fires before zod and
          shows an English message in a Portuguese interface. */}
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        {formError && (
          <p
            role="alert"
            className="rounded-lg bg-red-light px-3 py-2 text-sm text-red-dark"
          >
            {formError}
          </p>
        )}

        <Input
          label="E-mail"
          type="email"
          icon={Mail}
          placeholder="mail@exemplo.com"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />

        <PasswordInput
          label="Senha"
          placeholder="Digite sua senha"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />

        <Checkbox label="Lembrar-me" {...form.register('remember')} />

        <Button type="submit" disabled={signInMutation.isPending}>
          Entrar
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />
        ou
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      {/* The design draws this as a secondary button. A TextLink keeps it a
          real link — right-clickable, middle-clickable, announced as
          navigation — styled to match. Flagged for the owner's Figma pass. */}
      <TextLink
        to="/signup"
        className="flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-200 hover:no-underline"
      >
        {/* aria-hidden, so the link's accessible name stays "Criar conta"
            rather than picking up a second, wordless element. */}
        <UserPlus aria-hidden="true" className="size-4" />
        Criar conta
      </TextLink>
    </AuthLayout>
  );
}
