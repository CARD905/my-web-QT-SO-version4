'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { fetchMyPermissions, MyPermissionsData } from '@/lib/permissions';

interface PermissionsContextValue {
  data: MyPermissionsData | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [data, setData] = useState<MyPermissionsData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session?.user) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await fetchMyPermissions();
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    if (status === 'loading') return;
    refresh();
  }, [status, refresh]);

  return (
    <PermissionsContext.Provider value={{ data, loading, refresh }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissionsContext() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) {
    throw new Error('usePermissionsContext must be used within PermissionsProvider');
  }
  return ctx;
}