'use client';



import { useCallback, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { createContext, useContext } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'warning' | 'danger';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

// ─── Context ──────────────────────────────────────────────────────────────────

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen]       = useState(false);
  const [opts, setOpts]       = useState<ConfirmOptions>({ title: '' });
  const [leaving, setLeaving] = useState(false);
  const resolveRef = useRef<(v: boolean) => void>(() => {});

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOpts(options);
      setLeaving(false);
      setOpen(true);
      resolveRef.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    setLeaving(true);
    setTimeout(() => {
      setOpen(false);
      setLeaving(false);
      resolveRef.current(result);
    }, 150);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {open && <ConfirmModal opts={opts} leaving={leaving} onClose={close} />}
    </ConfirmContext.Provider>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

const variantConfig = {
  default: {
    icon: <CheckCircle2 className="h-6 w-6 text-primary" />,
    iconBg: 'bg-primary/10',
    confirmClass:
      'bg-primary hover:bg-primary/90 text-primary-foreground',
  },
  warning: {
    icon: <AlertTriangle className="h-6 w-6 text-amber-500" />,
    iconBg: 'bg-amber-500/10',
    confirmClass:
      'bg-amber-500 hover:bg-amber-600 text-white',
  },
  danger: {
    icon: <Trash2 className="h-6 w-6 text-destructive" />,
    iconBg: 'bg-destructive/10',
    confirmClass:
      'bg-destructive hover:bg-destructive/90 text-destructive-foreground',
  },
};

function ConfirmModal({
  opts,
  leaving,
  onClose,
}: {
  opts: ConfirmOptions;
  leaving: boolean;
  onClose: (result: boolean) => void;
}) {
  const variant = opts.variant ?? 'default';
  const { icon, iconBg, confirmClass } = variantConfig[variant];

  return (
    <div
      className={cn(
        'fixed inset-0 z-[200] flex items-center justify-center p-4',
        'bg-black/50 backdrop-blur-sm',
        leaving ? 'animate-fade-out' : 'animate-fade-in',
      )}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(false); }}
    >
      <div
        className={cn(
          'relative w-full max-w-sm bg-background rounded-2xl shadow-2xl',
          'border border-border/60 p-6 flex flex-col gap-4',
          leaving ? 'animate-slide-down' : 'animate-slide-up',
        )}
      >
        {/* Close button */}
        <button
          onClick={() => onClose(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon + Title */}
        <div className="flex items-start gap-4 pr-6">
          <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center shrink-0', iconBg)}>
            {icon}
          </div>
          <div className="space-y-1 pt-0.5">
            <h3 className="font-semibold text-base leading-snug">{opts.title}</h3>
            {opts.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{opts.description}</p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border/60" />

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-5"
            onClick={() => onClose(false)}
          >
            {opts.cancelText ?? 'ยกเลิก'}
          </Button>
          <Button
            size="sm"
            className={cn('h-9 px-5 border-0 shadow-sm transition-all', confirmClass)}
            onClick={() => onClose(true)}
          >
            {opts.confirmText ?? 'ยืนยัน'}
          </Button>
        </div>
      </div>
    </div>
  );
}