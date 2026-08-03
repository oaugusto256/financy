import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { TextLink } from '@/components/ui/TextLink';
import { useSignUpMutation } from '@/graphql/generated/graphql';
import { errorCodeOf, fieldErrorsOf } from '@/lib/graphql-errors';
import { AuthLayout } from './AuthLayout';
import { useSession } from './useSession';
import { signUpSchema, type SignUpValues } from './validation';

export function SignUpPage() {
  const { signIn } = useSession();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const signUpMutation = useSignUpMutation();

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const data = await signUpMutation.mutateAsync({ input: values });
      // remember: false. There is no checkbox on this form, and defaulting a
      // brand new account to a token that survives the browser closing is a
      // decision the user did not make. They can choose it on their next login.
      signIn(data.signUp.token, data.signUp.user, false);
    } catch (error) {
      if (errorCodeOf(error) === 'EMAIL_ALREADY_EXISTS') {
        form.setError('email', { message: 'Este e-mail já está em uso' });
        return;
      }

      // Anything the server named a field for goes onto that field; the rest
      // is a form-level message. frontend.md section 8.
      const fieldErrors = fieldErrorsOf(error);
      const named = Object.entries(fieldErrors);
      if (named.length > 0) {
        for (const [field, messages] of named) {
          if (field in form.getValues() && messages[0]) {
            form.setError(field as keyof SignUpValues, { message: messages[0] });
          }
        }
        return;
      }

      setFormError('Não foi possível criar a conta. Tente novamente.');
    }
  });

  return (
    <AuthLayout>
      <h1 className="text-2xl font-bold text-gray-800">Criar conta</h1>
      <p className="mt-1 text-sm text-gray-500">
        Comece a controlar suas finanças ainda hoje
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
          label="Nome completo"
          icon={User}
          error={form.formState.errors.name?.message}
          {...form.register('name')}
        />

        <Input
          label="E-mail"
          type="email"
          icon={Mail}
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />

        <PasswordInput
          label="Senha"
          helperText="A senha deve ter no mínimo 8 caracteres"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />

        <Button type="submit" disabled={signUpMutation.isPending}>
          Criar conta
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />
        ou
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <TextLink
        to="/"
        className="flex h-11 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-200 hover:no-underline"
      >
        Fazer login
      </TextLink>
    </AuthLayout>
  );
}
