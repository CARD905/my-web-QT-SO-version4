'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Eye, EyeOff, Loader2, FileText, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) {
        toast.error('Invalid email or password');
        setLoading(false);
        return;
      }
      const { fireSparkle } = await import('@/lib/confetti');
      fireSparkle();
      
      setTimeout(() => router.push('/'), 400);
    } catch (err) {
      console.error(err);
      toast.error('Login failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated background blobs */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-pink-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '2s' }}
        />
      </div>

      {/* Gradient mesh */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />

      {/* Floating sparkles */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <Sparkles
            key={i}
            className="absolute h-3 w-3 text-purple-500/40 animate-sparkle"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-md">
        {/* Glass card */}
        <div className="rounded-3xl border border-white/20 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 items-center justify-center text-white shadow-2xl shadow-purple-500/30 mb-4 animate-float">
              <FileText className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Quotation System
            </h1>
            <p className="text-sm text-muted-foreground mt-2">เข้าสู่ระบบเพื่อดำเนินการต่อ</p>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1.5 bg-white/50 dark:bg-slate-800/50 backdrop-blur"
                disabled={loading}
                autoFocus
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider">
                Password
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-white/50 dark:bg-slate-800/50 backdrop-blur pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 mt-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-semibold shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Sign In
                </>
              )}
            </Button>
          </form>

          {/* Test accounts hint */}
         
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          v1.0.0 · QT/SO Management System
        </p>
      </div>
    </div>
  );
}