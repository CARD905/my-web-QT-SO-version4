'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Eye, EyeOff, Loader2, FileText, ArrowRight, Shield, Zap, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('กรุณากรอก Email และ Password'); return; }
    setLoading(true);
    try {
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) { toast.error('Email หรือ Password ไม่ถูกต้อง'); setLoading(false); return; }
      const { fireSparkle } = await import('@/lib/confetti');
      fireSparkle();
      setTimeout(() => router.push('/'), 400);
    } catch {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
      setLoading(false);
    }
  };

  const features = [
    { icon: FileText,  label: 'จัดการใบเสนอราคา',   desc: 'สร้าง ติดตาม และอนุมัติ QT' },
    { icon: BarChart3, label: 'รายงานและวิเคราะห์',   desc: 'Dashboard แบบ Real-time' },
    { icon: Shield,    label: 'ระบบอนุมัติหลายชั้น', desc: 'Workflow อัตโนมัติ' },
    { icon: Zap,       label: 'Sale Order',           desc: 'ติดตาม SO ครบวงจร' },
  ];

  return (
    <>
      <style>{`
        @keyframes orb-float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(30px, -40px) scale(1.05); }
          66%       { transform: translate(-20px, 20px) scale(0.95); }
        }
        @keyframes orb-float-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(-40px, 30px) scale(1.08); }
          66%       { transform: translate(25px, -20px) scale(0.92); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes ring-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes float-logo {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(139,92,246,0.4), 0 0 40px rgba(99,102,241,0.2); }
          50%       { box-shadow: 0 0 40px rgba(139,92,246,0.7), 0 0 80px rgba(99,102,241,0.4); }
        }
        @keyframes grid-fade {
          from { opacity: 0; }
          to   { opacity: 0.04; }
        }
        @keyframes stagger-in {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .animate-orb-1  { animation: orb-float   14s ease-in-out infinite; }
        .animate-orb-2  { animation: orb-float-2 18s ease-in-out infinite; }
        .animate-orb-3  { animation: orb-float   22s ease-in-out infinite reverse; }
        .animate-slide-up { animation: slide-up 0.7s cubic-bezier(0.22,1,0.36,1) both; }
        .animate-fade-in  { animation: fade-in  0.5s ease both; }
        .animate-ring     { animation: ring-spin 8s linear infinite; }
        .animate-logo     { animation: float-logo 4s ease-in-out infinite; }
        .animate-glow     { animation: glow-pulse 3s ease-in-out infinite; }
        .animate-grid     { animation: grid-fade 1s ease both; }
        .btn-shimmer {
          background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 25%, #a78bfa 50%, #8b5cf6 75%, #6366f1 100%);
          background-size: 200% auto;
          animation: shimmer 3s linear infinite;
        }
        .btn-shimmer:hover { animation: shimmer 1.5s linear infinite; }
        .input-glow:focus-within { box-shadow: 0 0 0 2px rgba(139,92,246,0.5), 0 4px 20px rgba(139,92,246,0.15); }
      `}</style>

      <div className="min-h-screen flex overflow-hidden bg-[#070711]">

        {/* ── LEFT PANEL (desktop) ── */}
        <div className="hidden lg:flex lg:w-[52%] relative flex-col items-center justify-center px-16 overflow-hidden">

          {/* Animated background orbs */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="animate-orb-1 absolute top-[10%] left-[10%]  w-[500px] h-[500px] rounded-full bg-indigo-600/20  blur-[100px]" />
            <div className="animate-orb-2 absolute bottom-[5%]  right-[5%]  w-[400px] h-[400px] rounded-full bg-violet-600/25  blur-[100px]" />
            <div className="animate-orb-3 absolute top-[50%]  left-[40%]  w-[300px] h-[300px] rounded-full bg-purple-500/15  blur-[80px]" />
            {/* Grid overlay */}
            <div className="animate-grid absolute inset-0"
              style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
                backgroundSize: '60px 60px',
              }} />
          </div>

          {/* Content */}
          <div className={`relative z-10 max-w-md transition-all ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            {/* Logo */}
            <div className="animate-logo animate-glow w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 flex items-center justify-center mb-8 shadow-2xl">
              <FileText className="h-10 w-10 text-white" />
            </div>

            <h1 className="text-5xl font-black text-white leading-tight mb-3">
              Quotation
              <span className="block bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                Management
              </span>
            </h1>
            <p className="text-slate-400 text-lg mb-12 leading-relaxed">
              ระบบจัดการใบเสนอราคาและ Sale Order<br />สำหรับองค์กรครบวงจร
            </p>

            {/* Feature cards */}
            <div className="space-y-3">
              {features.map(({ icon: Icon, label, desc }, i) => (
                <div
                  key={label}
                  className={`flex items-center gap-4 p-4 rounded-2xl border border-white/8 bg-white/[0.04] backdrop-blur-sm transition-all hover:bg-white/[0.07] hover:border-violet-500/30 ${mounted ? 'animate-stagger' : 'opacity-0'}`}
                  style={{ animationDelay: `${0.2 + i * 0.1}s`, animation: mounted ? `stagger-in 0.5s ${0.3 + i * 0.1}s cubic-bezier(0.22,1,0.36,1) both` : 'none' }}
                >
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-violet-500/20 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-violet-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{label}</div>
                    <div className="text-xs text-slate-500">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL (form) ── */}
        <div className="flex-1 flex items-center justify-center p-6 relative">

          {/* Mobile background orbs */}
          <div className="lg:hidden absolute inset-0 pointer-events-none">
            <div className="animate-orb-1 absolute top-[-10%] right-[-10%] w-72 h-72 rounded-full bg-violet-600/20 blur-[80px]" />
            <div className="animate-orb-2 absolute bottom-[-5%] left-[-5%]  w-60 h-60 rounded-full bg-indigo-600/20 blur-[70px]" />
          </div>

          {/* Vertical divider (desktop) */}
          <div className="hidden lg:block absolute left-0 top-[10%] bottom-[10%] w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          {/* Glass card */}
          <div className={`relative w-full max-w-sm ${mounted ? 'animate-slide-up' : 'opacity-0'}`}>

            {/* Glow ring behind card */}
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-indigo-500/20 via-violet-500/20 to-purple-500/20 blur-xl" />

            <div className="relative rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-2xl shadow-2xl overflow-hidden p-8">

              {/* Subtle top shimmer line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent" />

              {/* Logo (mobile + form top) */}
              <div className="flex flex-col items-center mb-8">
                <div className="animate-logo animate-glow w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 flex items-center justify-center mb-4 shadow-xl">
                  <FileText className="h-7 w-7 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">ยินดีต้อนรับ</h2>
                <p className="text-sm text-slate-400 mt-1">เข้าสู่ระบบเพื่อดำเนินการต่อ</p>
              </div>

              {/* Form */}
              <form onSubmit={onSubmit} className="space-y-5">

                {/* Email field */}
                <div className={`transition-all duration-300 ${mounted ? 'animate-slide-up' : ''}`} style={{ animationDelay: '0.15s' }}>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
                    Email Address
                  </label>
                  <div className={`input-glow rounded-xl transition-all duration-300 ${focusedField === 'email' ? 'ring-2 ring-violet-500/50' : ''}`}>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="you@company.com"
                      disabled={loading}
                      autoFocus
                      className="w-full rounded-xl border border-white/10 bg-white/[0.06] text-white placeholder-slate-500 px-4 py-3 text-sm outline-none transition-all focus:border-violet-500/50 focus:bg-white/[0.10]"
                    />
                  </div>
                </div>

                {/* Password field */}
                <div className={`transition-all duration-300 ${mounted ? 'animate-slide-up' : ''}`} style={{ animationDelay: '0.22s' }}>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
                    Password
                  </label>
                  <div className={`relative rounded-xl transition-all duration-300 ${focusedField === 'password' ? 'ring-2 ring-violet-500/50' : ''}`}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="••••••••"
                      disabled={loading}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.06] text-white placeholder-slate-500 px-4 py-3 pr-11 text-sm outline-none transition-all focus:border-violet-500/50 focus:bg-white/[0.10]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit button */}
                <div style={{ animationDelay: '0.3s' }}>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-shimmer relative w-full h-12 rounded-xl text-white font-semibold text-sm overflow-hidden shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 mt-2"
                  >
                    {/* Shimmer overlay */}
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />

                    <span className="relative flex items-center justify-center gap-2">
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>กำลังเข้าสู่ระบบ...</span>
                        </>
                      ) : (
                        <>
                          <span>เข้าสู่ระบบ</span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </form>

              {/* Footer */}
              <div className="mt-6 pt-5 border-t border-white/[0.06] flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[11px] text-slate-500">ระบบพร้อมใช้งาน · v1.0.0</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
