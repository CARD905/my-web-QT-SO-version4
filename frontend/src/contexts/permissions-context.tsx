'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from 'react';
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

  // 🔥 กันยิงซ้ำ
  const hasFetchedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchMyPermissions();
      setData(result);
    } catch (err) {
      console.error('Failed to fetch permissions:', err);
      setData(null);
    } finally {
      // ✅ FIX: ต้อง set false เสมอ ไม่ว่าจะสำเร็จหรือ error
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // ⛔ NextAuth ยังโหลด session — รอก่อน (loading ยังเป็น true)
    if (status === 'loading') {
      return;
    }

    // ⛔ ยังไม่ login → reset และ set loading=false
    if (status === 'unauthenticated') {
      hasFetchedRef.current = false;
      setData(null);
      setLoading(false); // ✅ FIX: บอกว่าโหลดเสร็จแล้ว (แต่ไม่มี data)
      return;
    }

    // ✅ authenticated — กันยิงซ้ำ
    if (hasFetchedRef.current) return;

    hasFetchedRef.current = true;
    refresh();
  }, [status, refresh]);

  // ✅ FIX: ถ้า session หาย (logout) → reset state
  useEffect(() => {
    if (status === 'unauthenticated' && hasFetchedRef.current) {
      hasFetchedRef.current = false;
      setData(null);
    }
  }, [status]);

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