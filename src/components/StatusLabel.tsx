import { AlertCircle, Ban, CheckCircle2, Clock, FileEdit, Send } from 'lucide-react';
import type { InvoiceStatus } from '../types/invoice';

interface StatusLabelProps {
  status: InvoiceStatus;
}

const STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; classes: string; Icon: typeof CheckCircle2 }
> = {
  paid: {
    label: 'Paid',
    classes:
      'text-emerald-700 bg-emerald-50 border-emerald-200/80 dark:text-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-800/60',
    Icon: CheckCircle2,
  },
  unpaid: {
    label: 'Unpaid',
    classes:
      'text-amber-700 bg-amber-50 border-amber-200/80 dark:text-amber-300 dark:bg-amber-950/50 dark:border-amber-800/60',
    Icon: Clock,
  },
  overdue: {
    label: 'Overdue',
    classes:
      'text-rose-700 bg-rose-50 border-rose-200/80 dark:text-rose-300 dark:bg-rose-950/50 dark:border-rose-800/60',
    Icon: AlertCircle,
  },
  sent: {
    label: 'Sent',
    classes:
      'text-blue-700 bg-blue-50 border-blue-200/80 dark:text-blue-300 dark:bg-blue-950/50 dark:border-blue-800/60',
    Icon: Send,
  },
  draft: {
    label: 'Draft',
    classes:
      'text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:border-slate-700',
    Icon: FileEdit,
  },
  cancelled: {
    label: 'Cancelled',
    classes:
      'text-slate-500 bg-slate-100 border-slate-200 line-through dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700',
    Icon: Ban,
  },
};

export function StatusLabel({ status }: StatusLabelProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const Icon = cfg.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cfg.classes}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{cfg.label}</span>
    </span>
  );
}
