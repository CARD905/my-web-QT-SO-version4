'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Eye, EyeOff, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';

/* ── deterministic pseudo-random (no SSR hydration mismatch) ── */
function pr(i: number, salt = 0) {
  return Math.abs(Math.sin(i * 127.1 + salt * 311.7)) % 1;
}

/* ── Star data generated once ── */
const STARS = Array.from({ length: 160 }, (_, i) => ({
  x: pr(i, 0) * 100,
  y: pr(i, 1) * 100,
  r: 0.4 + pr(i, 2) * 1.8,
  dur: 2 + pr(i, 3) * 4,
  delay: pr(i, 4) * 5,
  bright: pr(i, 5) > 0.75,
}));

/* ── Orbital dot positions ── */
const ORBIT_DOTS = [0, 60, 120, 180, 240, 300];

export default function LoginPage() {
  const router   = useRouter();
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPass, setShowPass]         = useState(false);
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
        /* ── Galaxy BG ── */
        .galaxy-bg {
          background: radial-gradient(ellipse 80% 60% at 50% 0%,   #1a0a3c 0%, transparent 70%),
                      radial-gradient(ellipse 60% 50% at 80% 80%,   #0d1a4a 0%, transparent 70%),
                      radial-gradient(ellipse 50% 40% at 10% 70%,   #12082e 0%, transparent 70%),
                      #03020d;
        }
        .dark .galaxy-bg {
          background: radial-gradient(ellipse 80% 60% at 50% 0%,   #1a0a3c 0%, transparent 70%),
                      radial-gradient(ellipse 60% 50% at 80% 80%,   #0d1a4a 0%, transparent 70%),
                      radial-gradient(ellipse 50% 40% at 10% 70%,   #12082e 0%, transparent 70%),
                      #03020d;
        }
        /* light-mode override */
        @media (prefers-color-scheme: light) {
          .galaxy-bg {
            background: radial-gradient(ellipse 80% 60% at 50% 0%,   #c8b4f8 0%, transparent 70%),
                        radial-gradient(ellipse 60% 50% at 80% 80%,   #b8d4fa 0%, transparent 70%),
                        radial-gradient(ellipse 50% 40% at 10% 70%,   #e0c8ff 0%, transparent 70%),
                        #e8eaf8;
          }
        }
        html.light .galaxy-bg {
          background: radial-gradient(ellipse 80% 60% at 50% 0%,   #c8b4f8 0%, transparent 70%),
                      radial-gradient(ellipse 60% 50% at 80% 80%,   #b8d4fa 0%, transparent 70%),
                      radial-gradient(ellipse 50% 40% at 10% 70%,   #e0c8ff 0%, transparent 70%),
                      #e8eaf8;
        }

        /* ── Nebula blobs ── */
        @keyframes nebula-drift {
          0%,100% { transform: translate(0,0)    scale(1);    opacity:.18; }
          40%      { transform: translate(40px,-50px) scale(1.1);  opacity:.26; }
          70%      { transform: translate(-30px,35px) scale(.92);  opacity:.14; }
        }
        @keyframes nebula-drift2 {
          0%,100% { transform: translate(0,0)    scale(1);    opacity:.22; }
          35%      { transform: translate(-55px,40px) scale(1.12); opacity:.30; }
          70%      { transform: translate(40px,-30px) scale(.90);  opacity:.16; }
        }
        .n1 { animation: nebula-drift  18s ease-in-out infinite; }
        .n2 { animation: nebula-drift2 22s ease-in-out infinite; }
        .n3 { animation: nebula-drift  26s ease-in-out infinite reverse; }

        /* ── Stars ── */
        @keyframes twinkle {
          0%,100% { opacity:.15; transform: scale(.8); }
          50%      { opacity:1;   transform: scale(1.3); }
        }
        @keyframes twinkle-bright {
          0%,100% { opacity:.4;  transform: scale(.9); }
          50%      { opacity:1;  transform: scale(1.5); box-shadow: 0 0 4px 1px rgba(200,180,255,.8); }
        }
        .star       { animation: twinkle        var(--d) var(--delay) ease-in-out infinite; }
        .star-bright{ animation: twinkle-bright var(--d) var(--delay) ease-in-out infinite; }

        /* ── Shooting star ── */
        @keyframes shoot {
          0%   { transform: translateX(0)    translateY(0)    scaleX(0); opacity:0; }
          5%   { opacity:1; }
          60%  { transform: translateX(320px) translateY(140px) scaleX(1); opacity:.8; }
          100% { transform: translateX(500px) translateY(220px) scaleX(.3); opacity:0; }
        }
        .shoot1 { animation: shoot 4s 1.5s  ease-in infinite; }
        .shoot2 { animation: shoot 4s 6s    ease-in infinite; }
        .shoot3 { animation: shoot 4s 11.5s ease-in infinite; }

        /* ── Logo ── */
        @keyframes logo-pulse {
          0%,100% { box-shadow: 0 0 0 0   rgba(139,92,246,.0), 0 0 40px 8px  rgba(99,102,241,.30), inset 0 0 20px rgba(167,139,250,.20); }
          50%      { box-shadow: 0 0 0 12px rgba(139,92,246,.12), 0 0 70px 20px rgba(99,102,241,.45), inset 0 0 35px rgba(167,139,250,.35); }
        }
        @keyframes orbit-spin    { to { transform: rotate( 360deg); } }
        @keyframes orbit-spin-rev{ to { transform: rotate(-360deg); } }
        @keyframes dot-orbit {
          0%   { box-shadow: 0 0 5px 2px rgba(167,139,250,.9); }
          50%  { box-shadow: 0 0 10px 4px rgba(216,180,254,.9); }
          100% { box-shadow: 0 0 5px 2px rgba(167,139,250,.9); }
        }
        @keyframes icon-float {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-5px); }
        }
        @keyframes aurora {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .logo-orb {
          animation: logo-pulse 3.5s ease-in-out infinite;
          background: linear-gradient(135deg,#4f46e5,#7c3aed,#9333ea,#c026d3);
          background-size: 300% 300%;
        }
        .logo-aurora { animation: aurora 6s ease infinite; }
        .orbit-outer { animation: orbit-spin     14s linear infinite; }
        .orbit-inner { animation: orbit-spin-rev  9s linear infinite; }
        .icon-float  { animation: icon-float 3.8s ease-in-out infinite; }
        .dot-glow    { animation: dot-orbit 2s ease-in-out infinite; }

        /* ── Card entrance ── */
        @keyframes card-rise {
          from { opacity:0; transform: translateY(36px) scale(.96); }
          to   { opacity:1; transform: translateY(0)    scale(1);   }
        }
        @keyframes field-slide {
          from { opacity:0; transform: translateY(12px); }
          to   { opacity:1; transform: translateY(0); }
        }
        .card-rise  { animation: card-rise  .8s cubic-bezier(.22,1,.36,1) both; }
        .field-slide{ animation: field-slide .5s cubic-bezier(.22,1,.36,1) both; }

        /* ── Button ── */
        @keyframes btn-flow {
          0%   { background-position: 0%   50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0%   50%; }
        }
        .btn-galaxy {
          background: linear-gradient(90deg,#4f46e5,#7c3aed,#9333ea,#c026d3,#7c3aed,#4f46e5);
          background-size: 400% 400%;
          animation: btn-flow 5s ease infinite;
        }
        .btn-galaxy:hover { animation-duration: 2.5s; }

        /* ── Input focus glow ── */
        @keyframes inp-glow {
          0%,100% { box-shadow: 0 0 0 2px rgba(124,58,237,.45), 0 4px 20px rgba(124,58,237,.20); }
          50%      { box-shadow: 0 0 0 3px rgba(167,139,250,.60), 0 4px 28px rgba(139,92,246,.35); }
        }
        .inp-focused { animation: inp-glow 2s ease-in-out infinite; border-color: rgba(139,92,246,.7) !important; }

        /* ── Light mode card ── */
        html.light .glass-card,
        @media (prefers-color-scheme:light) { .glass-card } {
          background: rgba(255,255,255,.72);
          border-color: rgba(139,92,246,.20);
        }
        html.light .star-dark { fill: rgba(80,40,120,.6); }
        html.light .title-text {
          background: linear-gradient(135deg,#4f46e5,#7c3aed,#c026d3);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>

      <div className="galaxy-bg min-h-screen relative overflow-hidden flex items-center justify-center p-4">

        {/* ── Nebula blobs ── */}
        <div className="absolute inset-0 pointer-events-none -z-10">
          <div className="n1 absolute top-[-5%]   left-[-5%]  w-[600px] h-[600px] rounded-full bg-violet-700/25  blur-[130px]" />
          <div className="n2 absolute bottom-[-5%] right-[-5%] w-[550px] h-[550px] rounded-full bg-indigo-700/30  blur-[120px]" />
          <div className="n3 absolute top-[40%]   left-[35%]  w-[400px] h-[400px] rounded-full bg-fuchsia-800/20 blur-[100px]" />
          <div className="n1 absolute top-[20%]   right-[20%] w-[300px] h-[300px] rounded-full bg-cyan-800/15   blur-[90px]"  style={{animationDelay:'4s'}} />
        </div>

        {/* ── Star field ── */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none -z-10" xmlns="http://www.w3.org/2000/svg">
          {STARS.map((s, i) => (
            <circle
              key={i}
              cx={`${s.x}%`}
              cy={`${s.y}%`}
              r={s.r}
              className={s.bright ? 'star-bright' : 'star'}
              fill={s.bright ? '#e2d9ff' : '#a89fc8'}
              style={{
                '--d': `${s.dur}s`,
                '--delay': `${s.delay}s`,
              } as React.CSSProperties}
            />
          ))}
        </svg>

        {/* ── Shooting stars ── */}
        <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
          {[
            { top:'15%', left:'5%',  rot:-20 },
            { top:'45%', left:'60%', rot:-15 },
            { top:'70%', left:'2%',  rot:-25 },
          ].map((s, i) => (
            <div key={i}
              className={['shoot1','shoot2','shoot3'][i]}
              style={{
                position:'absolute', top:s.top, left:s.left,
                width:'120px', height:'1.5px',
                transform:`rotate(${s.rot}deg)`,
                background:'linear-gradient(90deg,transparent,rgba(200,180,255,.9),rgba(255,255,255,.95),transparent)',
                borderRadius:'99px',
                transformOrigin:'left center',
              }} />
          ))}
        </div>

        {/* ── Card ── */}
        <div className={`relative w-full max-w-[400px] ${mounted?'card-rise':'opacity-0'}`}>

          {/* Outer halo */}
          <div className="absolute -inset-4 rounded-[2.8rem] bg-gradient-to-br from-violet-600/15 via-indigo-600/15 to-fuchsia-600/15 blur-3xl -z-10" />

          <div className="glass-card relative rounded-3xl border border-white/10 bg-white/[0.05] backdrop-blur-2xl shadow-2xl overflow-hidden px-8 py-9 dark:bg-white/[0.05] dark:border-white/10">

            {/* Top shimmer bar */}
            <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-violet-400/70 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-px       bg-gradient-to-r from-transparent via-fuchsia-400/30 to-transparent" />
            {/* Corner glow dots */}
            <div className="absolute top-4  left-4  w-1.5 h-1.5 rounded-full bg-violet-400/40 blur-[1px]" />
            <div className="absolute top-4  right-4 w-1 h-1   rounded-full bg-indigo-400/40 blur-[1px]" />
            <div className="absolute bottom-4 right-4 w-1.5 h-1.5 rounded-full bg-fuchsia-400/30 blur-[1px]" />

            {/* ════ LOGO SECTION ════ */}
            <div className="flex flex-col items-center mb-8">
              <div className="relative w-32 h-32 flex items-center justify-center mb-5">

                {/* Outermost faint ring */}
                <div className="absolute inset-0 rounded-full border border-violet-500/15" />

                {/* Orbit track 1 */}
                <div className="orbit-outer absolute inset-[6px] rounded-full border border-dashed border-violet-400/25">
                  {/* Orbital dots */}
                  {ORBIT_DOTS.map((deg) => (
                    <div key={deg}
                      className="absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2"
                      style={{
                        top:  `${50 - 50*Math.cos(deg*Math.PI/180)}%`,
                        left: `${50 + 50*Math.sin(deg*Math.PI/180)}%`,
                      }}>
                      <div className={`dot-glow w-full h-full rounded-full ${deg===0?'bg-violet-300 w-2 h-2':deg===180?'bg-indigo-300 w-1.5 h-1.5 opacity-80':'bg-fuchsia-300/60 w-1 h-1 opacity-50'}`} />
                    </div>
                  ))}
                </div>

                {/* Orbit track 2 (inner reverse) */}
                <div className="orbit-inner absolute inset-[20px] rounded-full border border-dotted border-indigo-400/20">
                  {[90, 270].map((deg) => (
                    <div key={deg}
                      className="absolute w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2"
                      style={{
                        top:  `${50 - 50*Math.cos(deg*Math.PI/180)}%`,
                        left: `${50 + 50*Math.sin(deg*Math.PI/180)}%`,
                      }}>
                      <div className="w-full h-full rounded-full bg-cyan-300/70 blur-[0.5px]" style={{boxShadow:'0 0 4px 2px rgba(103,232,249,.6)'}} />
                    </div>
                  ))}
                </div>

                {/* Core orb */}
                <div className="logo-orb logo-aurora icon-float relative z-10 h-[54px] w-[54px] rounded-2xl flex items-center justify-center"
                  style={{
                    background:'linear-gradient(135deg,#4f46e5 0%,#7c3aed 35%,#9333ea 65%,#c026d3 100%)',
                    backgroundSize:'300% 300%',
                  }}>
                  {/* Inner shine overlay */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/25 via-transparent to-black/10" />
                  <FileText className="relative h-7 w-7 text-white drop-shadow-lg" />
                </div>
              </div>

              {/* Title */}
              <h1 className="text-[1.65rem] font-black tracking-tight leading-none mb-2">
                <span className="title-text bg-gradient-to-r from-violet-300 via-fuchsia-300 to-indigo-300 bg-clip-text text-transparent dark:from-violet-300 dark:via-fuchsia-300 dark:to-indigo-300">
                  Quotation System
                </span>
              </h1>
              <p className="text-sm text-slate-400 dark:text-slate-400">เข้าสู่ระบบเพื่อดำเนินการต่อ</p>
            </div>

            {/* ════ FORM ════ */}
            <form onSubmit={onSubmit} className="space-y-4">

              {/* Email */}
              <div className="field-slide" style={{animationDelay:'.12s'}}>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-400 mb-2">
                  Email Address
                </label>
                <input
                  type="email" value={email} disabled={loading} autoFocus
                  onChange={e=>setEmail(e.target.value)}
                  onFocus={()=>setFocused('email')}
                  onBlur={()=>setFocused(null)}
                  placeholder="you@company.com"
                  className={`w-full rounded-xl border bg-white/[0.06] dark:bg-white/[0.06] text-white dark:text-white placeholder-slate-600 dark:placeholder-slate-600 px-4 py-3 text-sm outline-none transition-all duration-300 ${focused==='email'?'inp-focused border-violet-500/60':'border-white/10'}`}
                />
              </div>

              {/* Password */}
              <div className="field-slide" style={{animationDelay:'.2s'}}>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-400 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPass?'text':'password'} value={password} disabled={loading}
                    onChange={e=>setPassword(e.target.value)}
                    onFocus={()=>setFocused('password')}
                    onBlur={()=>setFocused(null)}
                    placeholder="••••••••"
                    className={`w-full rounded-xl border bg-white/[0.06] dark:bg-white/[0.06] text-white dark:text-white placeholder-slate-600 dark:placeholder-slate-600 px-4 py-3 pr-11 text-sm outline-none transition-all duration-300 ${focused==='password'?'inp-focused border-violet-500/60':'border-white/10'}`}
                  />
                  <button type="button" tabIndex={-1}
                    onClick={()=>setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPass?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}
                  </button>
                </div>
              </div>

              {/* Button */}
              <div className="field-slide pt-1" style={{animationDelay:'.28s'}}>
                <button type="submit" disabled={loading}
                  className="btn-galaxy relative w-full h-12 rounded-xl text-white font-semibold text-sm shadow-lg shadow-violet-700/40 hover:shadow-xl hover:shadow-violet-600/60 hover:scale-[1.02] active:scale-[0.98] transition-transform duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 overflow-hidden">
                  {/* Shimmer sweep */}
                  <span className="absolute inset-0 -translate-x-full hover:translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-12 transition-transform duration-700 pointer-events-none" />
                  <span className="relative flex items-center justify-center gap-2">
                    {loading
                      ? <><Loader2 className="h-4 w-4 animate-spin"/>กำลังเข้าสู่ระบบ...</>
                      : <>                                                
                          Sign In
                        </>
                    }
                  </span>
                </button>
              </div>
            </form>

            {/* Footer */}
            <div className="mt-7 pt-5 border-t border-white/[0.07] flex items-center justify-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" style={{animationDuration:'1.6s'}} />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <p className="text-[10px] text-slate-600 dark:text-slate-600">v1.0.0 · QT/SO Management System</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
