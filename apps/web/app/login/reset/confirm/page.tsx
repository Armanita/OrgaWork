import { PasswordResetConfirmForm } from '@/components/password-reset-confirm-form';

export default async function PasswordResetConfirmPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    readonly token?: string | readonly string[];
  }>;
}>): Promise<React.ReactElement> {
  const parameters = await searchParams;
  const tokenValue = parameters.token;
  const initialToken = typeof tokenValue === 'string' ? tokenValue : (tokenValue?.[0] ?? '');

  return <PasswordResetConfirmForm initialToken={initialToken} />;
}
