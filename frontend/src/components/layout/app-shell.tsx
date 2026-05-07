'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { AuroraBackground } from '@/components/effects/aurora-background';
import { MouseSpotlight } from '@/components/effects/mouse-spotlight';
import { ParticleField } from '@/components/effects/particle-field';

type AuroraVariant = 'default' | 'admin' | 'manager' | 'approver';

function pickVariant(roleCode?: string): AuroraVariant {
  if (roleCode === 'ADMIN' || roleCode === 'CEO') return 'admin';
  if (roleCode === 'MANAGER') return 'manager';
  if (roleCode === 'APPROVER') return 'approver';
  return 'default';
}

function pickParticleColor(roleCode?: string): string {
  if (roleCode === 'CEO') return '251, 191, 36';
  if (roleCode === 'ADMIN') return '244, 63, 94';
  if (roleCode === 'MANAGER') return '245, 158, 11';
  if (roleCode === 'APPROVER') return '168, 85, 247';
  return '99, 102, 241';
}

interface AppShellProps {
  children: ReactNode;
  /**
   * Header เป็น slot — server component ส่งเข้ามา
   * (Header ใช้ auth() ที่ต้องอยู่ใน server boundary)
   */
  header: ReactNode;
  role?: string;
}

export function AppShell({ children, header, role }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // ─── ฟัง event จาก MobileMenuTrigger (ที่อยู่ใน server Header) ──────────
  useEffect(() => {
    const handler = () => setMobileOpen(true);
    window.addEventListener('mobile-sidebar:open', handler);
    return () => window.removeEventListener('mobile-sidebar:open', handler);
  }, []);

  // ─── ปิด drawer อัตโนมัติเมื่อ resize เป็น desktop ───────────────────────
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 1024 && mobileOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen relative">
      {/* Background layers */}
      <AuroraBackground variant={pickVariant(role)} />
      <ParticleField count={35} color={pickParticleColor(role)} />
      <MouseSpotlight />

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        role={role}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header — ส่งจาก server layout แล้ว pass มาเป็น slot */}
        {header}

        <main className="flex-1 p-4 md:p-6 lg:p-8 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}