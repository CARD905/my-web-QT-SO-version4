import { LangSwitcher } from '@/components/layout/lang-switcher';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="fixed top-3 right-3 z-50">
        <LangSwitcher />
      </div>
      {children}
    </>
  );
}