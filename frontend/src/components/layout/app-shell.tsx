'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { AuroraBackground } from '@/components/effects/aurora-background';
import { MouseSpotlight } from '@/components/effects/mouse-spotlight';
import { MobileMenuButton } from '@/components/layout/mobile-menu-button';

type AuroraVariant = 'default' | 'admin' | 'manager' | 'approver';

function pickVariant(roleCode?: string): AuroraVariant {
  if (roleCode === 'ADMIN' || roleCode === 'CEO') return 'admin';
  if (roleCode === 'MANAGER') return 'manager';
  if (roleCode === 'APPROVER') return 'approver';
  return 'default';
}

interface AppShellProps {
  children: React.ReactNode;
  role?: string;
}

export function AppShell({ children, role }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen relative">
      <AuroraBackground variant={pickVariant(role)} />
      <MouseSpotlight />

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
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
        {/* Header เดิม — ไม่แตะ, ใส่ hamburger ลอยด้านซ้ายแทน */}
        <div className="relative">
          <Header />
          {/* Hamburger — absolute ซ้าย, แสดงเฉพาะ mobile (lg:hidden) */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2 lg:hidden">
            <MobileMenuButton onClick={() => setMobileOpen(true)} />
          </div>
        </div>

        <main className="flex-1 p-4 md:p-6 lg:p-8 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}