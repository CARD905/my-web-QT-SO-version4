'use client';

import { useState } from 'react';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/lib/i18n';
import { PermissionsProvider } from '@/contexts/permissions-context';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <SessionProvider>
      <PermissionsProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <I18nProvider>
              {children}
              {/* ✅ ย้ายมามุมล่างซ้าย — ไม่บังปุ่ม account มุมบนขวา */}
              <Toaster
                position="bottom-left"
                richColors
                toastOptions={{
                  classNames: {
                    toast: 'rounded-xl shadow-lg border',
                  },
                }}
              />
            </I18nProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </PermissionsProvider>
    </SessionProvider>
  );
}