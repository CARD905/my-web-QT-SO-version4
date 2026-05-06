'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { AuroraBackground } from '@/components/effects/aurora-background';
import { MouseSpotlight } from '@/components/effects/mouse-spotlight';
import { ParticleField } from '@/components/effects/particle-field';
import { MobileMenuButton } from '@/components/layout/mobile-menu-button';

type AuroraVariant = 'default' | 'admin' | 'manager' | 'approver';

function pickVariant(roleCode?: string): AuroraVariant {
  if (roleCode === 'ADMIN' || roleCode === 'CEO') return 'admin';
  if (roleCode === 'MANAGER') return 'manager';
  if (roleCode === 'APPROVER') return 'approver';
  return 'default';
}

// ─── Particle color ตาม role ────────────────────────────────────────────
function pickParticleColor(roleCode?: string): string {
  if (roleCode === 'CEO') return '251, 191, 36';        // gold
  if (roleCode === 'ADMIN') return '244, 63, 94';        // rose
  if (roleCode === 'MANAGER') return '245, 158, 11';     // amber
  if (roleCode === 'APPROVER') return '168, 85, 247';    // purple
  return '99, 102, 241';                                  // indigo
}

interface AppShellProps {
  children: React.ReactNode;
  role?: string;
}

export function AppShell({ children, role }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen relative">
      {/* ── Background layers (back → front) ── */}
      <AuroraBackground variant={pickVariant(role)} />
      <ParticleField count={35} color={pickParticleColor(role)} />
      <MouseSpotlight />

      {/* Mobile overlay backdrop */}
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
        <div className="relative">
          <Header />
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