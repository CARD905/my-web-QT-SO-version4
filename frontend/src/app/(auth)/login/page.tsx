'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Eye, EyeOff, Loader2, FileText, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { ShootingStars } from '@/components/ui/shooting-stars';

/* ─── tiny deterministic "random" so SSR & client match ─── */
function seededVal(i: number, offset = 0) {
  return ((Math.sin(i * 9301 + offset * 49297) * 49297) % 1 + 1) / 2;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [mounted, setMounted]           = useState(false);
  const [focused, setFocused]           = useState<'email'|'password'|null>(null);

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

  return (
    <>
      <style>{`
        @keyframes blob-drift {
          0%,100% { transform: translate(0,0)   scale(1);    }
          33%      { transform: translate(40px,-50px) scale(1.08); }
          66%      { transform: translate(-30px,30px) scale(0.94); }
        }
        @keyframes blob-drift2 {
          0%,100% { transform: translate(0,0)   scale(1);    }
          33%      { transform: translate(-50px,40px) scale(1.1);  }
          66%      { transform: translate(35px,-25px) scale(0.9);  }
        }
        @keyframes float-logo {
          0%,100% { transform: translateY(0);  }
          50%      { transform: translateY(-7px); }
        }
        @keyframes ring-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes ring-spin-rev {
          to { transform: rotate(-360deg); }
        }
        @keyframes card-in {
          from { opacity:0; transform: translateY(32px) scale(.97); }
          to   { opacity:1; transform: translateY(0)    scale(1);   }
        }
        @keyframes field-in {
          from { opacity:0; transform: translateX(-12px); }
          to   { opacity:1; transform: translateX(0);     }
        }
        @keyframes shimmer-btn {
          0%   { background-position: -300% center; }
          100% { background-position:  300% center; }
        }
        @keyframes dot-float {
          0%,100% { transform: translateY(0);    opacity:.5; }
          50%      { transform: translateY(-12px); opacity:1;  }
        }
        @keyframes sparkle-pop {
          0%,100% { opacity:.2; transform: scale(.8) rotate(0deg);   }
          50%      { opacity:.8; transform: scale(1.3) rotate(20deg); }
        }
        @keyframes glow-ring {
          0%,100% { box-shadow: 0 0 0 0 rgba(139,92,246,.0),  0 0 30px rgba(99,102,241,.3); }
          50%      { box-shadow: 0 0 0 8px rgba(139,92,246,.15), 0 0 60px rgba(99,102,241,.5); }
        }
        @keyframes border-glow {
          0%,100% { border-color: rgba(139,92,246,.4); box-shadow: 0 0 12px rgba(139,92,246,.2); }
          50%      { border-color: rgba(167,139,250,.7); box-shadow: 0 0 24px rgba(139,92,246,.4); }
        }

        .blob1 { animation: blob-drift  16s ease-in-out infinite; }
        .blob2 { animation: blob-drift2 20s ease-in-out infinite; }
        .blob3 { animation: blob-drift  24s ease-in-out infinite reverse; }
        .logo-float { animation: float-logo 3.5s ease-in-out infinite; }
        .ring1      { animation: ring-spin     12s linear infinite; }
        .ring2      { animation: ring-spin-rev  8s linear infinite; }
        .card-enter { animation: card-in .75s cubic-bezier(.22,1,.36,1) both; }
        .field-enter{ animation: field-in .5s  cubic-bezier(.22,1,.36,1) both; }
        .btn-shimmer{
          background: linear-gradient(90deg,#6366f1 0%,#8b5cf6 20%,#c4b5fd 50%,#8b5cf6 80%,#6366f1 100%);
          background-size: 300% auto;
          animation: shimmer-btn 3s linear infinite;
        }
        .btn-shimmer:hover { animation-duration: 1.4s; }
        .logo-glow  { animation: glow-ring 2.8s ease-in-out infinite; }
        .focus-glow { animation: border-glow 2s ease-in-out infinite; }
      `}</style>

      <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 bg-[#05050f]">

        {/* ── Shooting Stars ── */}
        <ShootingStars />

        {/* ── Background blobs ── */}
        <div className="absolute inset-0 pointer-events-none -z-10">
          <div className="blob1 absolute top-[15%]  left-[10%]  w-[520px] h-[520px] rounded-full bg-blue-600/20   blur-[120px]" />
          <div className="blob2 absolute bottom-[10%] right-[8%] w-[480px] h-[480px] rounded-full bg-violet-600/25 blur-[110px]" />
          <div className="blob3 absolute top-[55%]  left-[45%]  w-[380px] h-[380px] rounded-full bg-pink-500/15   blur-[100px]" />
          {/* Subtle grid */}
          <div className="absolute inset-0 opacity-[.035]"
            style={{
              backgroundImage:'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)',
              backgroundSize:'72px 72px',
            }} />
        </div>

        {/* ── Floating sparkle dots ── */}
        <div className="absolute inset-0 pointer-events-none -z-10">
          {Array.from({length:12}).map((_,i)=>(
            <Sparkles key={i}
              className="absolute text-violet-400/30"
              style={{
                width: `${10+seededVal(i)*10}px`,
                height:`${10+seededVal(i)*10}px`,
                top:   `${seededVal(i,1)*90+3}%`,
                left:  `${seededVal(i,2)*90+3}%`,
                animation:`sparkle-pop ${2.5+seededVal(i,3)*3}s ${seededVal(i,4)*2}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>

        {/* ── Floating dots ── */}
        <div className="absolute inset-0 pointer-events-none -z-10">
          {Array.from({length:18}).map((_,i)=>{
            const size  = 2+seededVal(i,5)*4;
            const color = i%3===0 ? 'rgba(139,92,246,' : i%3===1 ? 'rgba(99,102,241,' : 'rgba(236,72,153,';
            return (
              <div key={i}
                className="absolute rounded-full"
                style={{
                  width:size, height:size,
                  background:`${color}${0.3+seededVal(i,6)*0.5})`,
                  top:  `${seededVal(i,7)*92+2}%`,
                  left: `${seededVal(i,8)*92+2}%`,
                  animation:`dot-float ${3+seededVal(i,9)*4}s ${seededVal(i,10)*3}s ease-in-out infinite`,
                }}
              />
            );
          })}
        </div>

        {/* ── Card wrapper ── */}
        <div className={`relative w-full max-w-[400px] ${mounted?'card-enter':'opacity-0'}`}>

          {/* Outer glow halo */}
          <div className="absolute -inset-3 rounded-[2.5rem] bg-gradient-to-br from-indigo-500/20 via-violet-500/20 to-pink-500/20 blur-2xl -z-10" />

          {/* Glass card */}
          <div className="relative rounded-3xl border border-white/10 bg-white/[0.05] backdrop-blur-2xl shadow-2xl overflow-hidden px-8 py-9">

            {/* Top shimmer line */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
            {/* Bottom shimmer line */}
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-pink-400/30 to-transparent" />

            {/* ── Logo section ── */}
            <div className="flex flex-col items-center mb-8">
              {/* Ring decorations around logo */}
              <div className="relative w-24 h-24 flex items-center justify-center mb-5">
                {/* Outer dashed ring */}
                <div className="ring1 absolute inset-0 rounded-full border-2 border-dashed border-violet-500/25" />
                {/* Inner dotted ring */}
                <div className="ring2 absolute inset-[8px] rounded-full border border-dotted border-indigo-400/30" />
                {/* Glow spots on rings */}
                <div className="absolute top-0   left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-violet-400/60 blur-[2px]" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-pink-400/50   blur-[2px]" />
                <div className="absolute left-0   top-1/2  -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-400/50 blur-[2px]" />

                {/* Logo icon */}
                <div className="logo-float logo-glow relative z-10 h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-violet-500/40">
                  <FileText className="h-7 w-7 text-white drop-shadow" />
                </div>
              </div>

              <h1 className="text-[1.75rem] font-black tracking-tight bg-gradient-to-r from-blue-400 via-violet-400 to-pink-400 bg-clip-text text-transparent leading-none mb-2">
                Quotation System
              </h1>
              <p className="text-sm text-slate-400">เข้าสู่ระบบเพื่อดำเนินการต่อ</p>
            </div>

            {/* ── Form ── */}
            <form onSubmit={onSubmit} className="space-y-4">

              {/* Email */}
              <div className="field-enter" style={{animationDelay:'.12s'}}>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                  Email Address
                </label>
                <div className={`relative rounded-xl transition-all duration-300 ${focused==='email' ? 'focus-glow' : ''}`}>
                  <input
                    type="email"
                    value={email}
                    onChange={e=>setEmail(e.target.value)}
                    onFocus={()=>setFocused('email')}
                    onBlur={()=>setFocused(null)}
                    placeholder="you@company.com"
                    disabled={loading}
                    autoFocus
                    className="w-full rounded-xl border border-white/10 bg-white/[0.06] text-white placeholder-slate-600 px-4 py-3 text-sm outline-none transition-all duration-200 focus:bg-white/[0.10] focus:border-violet-500/60"
                  />
                  {focused==='email' && (
                    <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500/5 via-transparent to-indigo-500/5" />
                  )}
                </div>
              </div>

              {/* Password */}
              <div className="field-enter" style={{animationDelay:'.2s'}}>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                  Password
                </label>
                <div className={`relative rounded-xl transition-all duration-300 ${focused==='password' ? 'focus-glow' : ''}`}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e=>setPassword(e.target.value)}
                    onFocus={()=>setFocused('password')}
                    onBlur={()=>setFocused(null)}
                    placeholder="••••••••"
                    disabled={loading}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.06] text-white placeholder-slate-600 px-4 py-3 pr-11 text-sm outline-none transition-all duration-200 focus:bg-white/[0.10] focus:border-violet-500/60"
                  />
                  <button type="button" tabIndex={-1}
                    onClick={()=>setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  {focused==='password' && (
                    <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500/5 via-transparent to-indigo-500/5" />
                  )}
                </div>
              </div>

              {/* Submit */}
              <div className="field-enter pt-1" style={{animationDelay:'.28s'}}>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-shimmer relative w-full h-12 rounded-xl text-white font-semibold text-sm shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98] transition-transform duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 overflow-hidden"
                >
                  {/* White sweep on hover */}
                  <span className="absolute inset-0 translate-x-[-110%] hover:translate-x-[110%] bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-12 transition-transform duration-700 pointer-events-none" />
                  <span className="relative flex items-center justify-center gap-2">
                    {loading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />กำลังเข้าสู่ระบบ...</>
                    ) : (
                      <><Sparkles className="h-4 w-4" />Sign In</>
                    )}
                  </span>
                </button>
              </div>
            </form>

            {/* Footer */}
            <div className="mt-7 pt-5 border-t border-white/[0.07] flex items-center justify-center gap-2">
              <span className="inline-flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping  opacity-75 [animation-duration:1.4s]" />
                <span className="w-1 h-1 rounded-full bg-emerald-400 -ml-1" />
              </span>
              <p className="text-[10px] text-slate-600">v1.0.0 · QT/SO Management System</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
