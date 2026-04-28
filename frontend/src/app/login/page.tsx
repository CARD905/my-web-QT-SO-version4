'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LangSwitcher } from '@/components/layout/lang-switcher';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useT } from '@/lib/i18n';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type LoginForm = z.infer<typeof loginSchema>;

function LoginPageInner() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const onSubmit = async (data: LoginForm) => {
    setSubmitting(true);
    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error(t('login.invalidCredentials'));
        return;
      }

      toast.success(t('login.welcomeBack'));
      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      toast.error(t('common.error'));
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col">
      {/* Top-right toggles */}
      <div className="absolute top-4 right-4 flex gap-1 z-10">
        <LangSwitcher />
        <ThemeToggle />
      </div>

      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-background to-secondary/20" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent" />

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-fade-in">
          <Card className="shadow-2xl border-border/40 backdrop-blur">
            <CardHeader className="space-y-3 text-center pt-8">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-2xl font-bold shadow-lg">
                Q
              </div>
              <div>
                <CardTitle className="text-2xl">{t('login.title')}</CardTitle>
                <CardDescription className="mt-1.5">{t('login.subtitle')}</CardDescription>
              </div>
            </CardHeader>

            <CardContent className="px-8 pb-8">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t('login.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    placeholder={t('login.emailPlaceholder')}
                    disabled={submitting}
                    {...form.register('email')}
                  />
                  {form.formState.errors.email && (
                    <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">{t('login.password')}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder={t('login.passwordPlaceholder')}
                      disabled={submitting}
                      {...form.register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full mt-6" size="lg" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('login.submitting')}
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" />
                      {t('login.submit')}
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-border/60">
                <p className="text-xs text-center text-muted-foreground mb-2">Test accounts:</p>
                <div className="text-xs text-muted-foreground space-y-0.5 font-mono">
                  <p>👨‍💼 sales@example.com / Password@123</p>
                  <p>👔 approver@example.com / Password@123</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginPageInner />
    </Suspense>
  );
}
