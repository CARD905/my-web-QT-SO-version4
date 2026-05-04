// 'use client';

// import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
// import { useSession } from 'next-auth/react';
// import { fetchMyPermissions, MyPermissionsData } from '@/lib/permissions';

// interface PermissionsContextValue {
//   data: MyPermissionsData | null;
//   loading: boolean;
//   refresh: () => Promise<void>;
// }

// const PermissionsContext = createContext<PermissionsContextValue | null>(null);

// export function PermissionsProvider({ children }: { children: ReactNode }) {
//   const { data: session, status } = useSession();
//   const [data, setData] = useState<MyPermissionsData | null>(null);
//   const [loading, setLoading] = useState(true);

//   const refresh = useCallback(async () => {
//     if (!session?.user) {
//       setData(null);
//       setLoading(false);
//       return;
//     }
//     setLoading(true);
//     try {
//       const result = await fetchMyPermissions();
//       setData(result);
//     } finally {
//       setLoading(false);
//     }
//   }, [session?.user]);

//   useEffect(() => {
//     if (status === 'loading') return;
//     refresh();
//   }, [status, refresh]);

//   return (
//     <PermissionsContext.Provider value={{ data, loading, refresh }}>
//       {children}
//     </PermissionsContext.Provider>
//   );
// }

// export function usePermissionsContext() {
//   const ctx = useContext(PermissionsContext);
//   if (!ctx) {
//     throw new Error('usePermissionsContext must be used within PermissionsProvider');
//   }
//   return ctx;
// }

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

  // 🔥 กันยิงซ้ำ (ตัวสำคัญสุด)
  const hasFetchedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!session?.user) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await fetchMyPermissions();
      setData(result);
    } catch (err) {
      console.error('Failed to fetch permissions:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]); // ✅ depend แค่ id (stable กว่า object)

  useEffect(() => {
    // ⛔ ยังโหลด session อยู่ → ไม่ทำอะไร
    if (status === 'loading') return;

    // ⛔ ยังไม่ login → reset state
    if (status === 'unauthenticated') {
      hasFetchedRef.current = false;
      setData(null);
      setLoading(false);
      return;
    }

    // ⛔ กันยิงซ้ำ
    if (hasFetchedRef.current) return;

    hasFetchedRef.current = true;
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