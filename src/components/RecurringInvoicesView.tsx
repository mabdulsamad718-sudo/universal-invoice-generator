import { useEffect, useState, type FormEvent } from 'react';
import {
  Repeat,
  Plus,
  Play,
  Pause,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  Eye,
  CheckCircle2,
  Send,
  AlertTriangle,
  History,
} from 'lucide-react';
import type {
  ClientProfile,
  ConnectedPaymentAccount,
  CurrencyCode,
  DateFormatOption,
  Invoice,
  InvoiceItem,
  RecurringDeliveryLog,
  RecurringDeliveryStatus,
  RecurringFrequency,
  RecurringInvoiceSchedule,
  RecurringStatus,
  TemplateId,
} from '../types/invoice';
import { OwnerAuthError, ownerFetch } from '../utils/apiClient';
import {
  calculateInvoiceTotals,
  formatCurrency,
  formatDisplayDate,
} from '../utils/calculations';

interface RecurringInvoicesViewProps {
  schedules: RecurringInvoiceSchedule[];
  clients: ClientProfile[];
  paymentAccounts: ConnectedPaymentAccount[];
  dateFormat: DateFormatOption;
  defaultCurrency: CurrencyCode;
  onSaveSchedule: (schedule: RecurringInvoiceSchedule) => void;
  onUpdateStatus: (id: string, status: RecurringStatus) => void;
  onDeleteSchedule: (id: string) => void;
  onGenerateNow: (schedule: RecurringInvoiceSchedule) => Invoice;
  onRunDueSchedules: () => Invoice[];
  onPreviewScheduleInvoice: (schedule: RecurringInvoiceSchedule) => void;
  onUpdateInvoiceDelivery?: (
    invoiceId: string,
    deliveryStatus: RecurringDeliveryStatus,
    deliveryError?: string,
    scheduleId?: string
  ) => void;
  onRequireOwnerAuth?: (reason: string) => void;
}

const FREQUENCIES: { id: RecurringFrequency; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' },
];

const CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'PKR', 'AED', 'CAD', 'AUD', 'SAR', 'INR', 'JPY'];

function DeliveryBadge({ status }: { status?: RecurringDeliveryStatus }) {
  if (!status) return null;
  const map: Record<RecurringDeliveryStatus, { label: string; cls: string }> = {
    accepted_by_smtp: {
      label: 'Accepted by SMTP Relay',
      cls: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
    },
    sent: {
      label: 'Email Sent',
      cls: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
    },
    sending: {
      label: 'Sending...',
      cls: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
    },
    queued: {
      label: 'Queued for Email',
      cls: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
    },
    generated: {
      label: 'Generated (Draft)',
      cls: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
    },
    setup_required: {
      label: 'SMTP Setup Required',
      cls: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    },
    delivery_confirmation_unavailable: {
      label: 'Confirmation Unavailable',
      cls: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    },
    failed: {
      label: 'Delivery Failed',
      cls: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
    },
    cancelled: {
      label: 'Cancelled',
      cls: 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
    },
  };
  const cfg = map[status];
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export function RecurringInvoicesView({
  schedules,
  clients,
  paymentAccounts,
  dateFormat,
  defaultCurrency,
  onSaveSchedule,
  onUpdateStatus,
  onDeleteSchedule,
  onGenerateNow,
  onRunDueSchedules,
  onPreviewScheduleInvoice,
  onUpdateInvoiceDelivery,
  onRequireOwnerAuth,
}: RecurringInvoicesViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const [smtpConfigured, setSmtpConfigured] = useState<boolean>(false);
  const [deliveryLogs, setDeliveryLogs] = useState<RecurringDeliveryLog[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [autoSend, setAutoSend] = useState(true);
  const [dueDays, setDueDays] = useState(14);
  const [template, setTemplate] = useState<TemplateId>('modern');
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency);
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: 'r-1', description: 'Monthly Service Retainer', quantity: 1, unitPrice: 1000 },
  ]);
  const [enabledPaymentIds, setEnabledPaymentIds] = useState<string[]>(
    paymentAccounts.filter((a) => a.connected && a.enabledByDefault).map((a) => a.id)
  );
  const [formError, setFormError] = useState<string | null>(null);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4800);
  };

  const fetchDeliveryLogs = async (promptIfUnauth = false) => {
    try {
      const healthRes = await fetch('/api/health').catch(() => null);
      if (healthRes?.ok) {
        const h = (await healthRes.json().catch(() => ({}))) as { smtpConfigured?: boolean };
        if (typeof h.smtpConfigured === 'boolean') {
          setSmtpConfigured(h.smtpConfigured);
        }
      }

      const res = await ownerFetch('/api/recurring/logs');
      if (!res.ok) return;
      const body = (await res.json()) as {
        smtpConfigured?: boolean;
        logs?: RecurringDeliveryLog[];
      };
      setSmtpConfigured(Boolean(body.smtpConfigured));
      if (Array.isArray(body.logs)) {
        setDeliveryLogs(body.logs);
      }
    } catch (err) {
      if (err instanceof OwnerAuthError && promptIfUnauth) {
        onRequireOwnerAuth?.('Sign in as the workspace owner to view server recurring delivery logs.');
      }
    }
  };

  useEffect(() => {
    void fetchDeliveryLogs(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dispatchInvoiceToBackend = async (inv: Invoice, scheduleId: string) => {
    setDispatchingId(scheduleId);
    try {
      const res = await ownerFetch('/api/recurring/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice: inv,
          scheduleId,
          scheduledDate: inv.issueDate,
        }),
      });
      const body = (await res.json()) as {
        deliveryStatus?: RecurringDeliveryStatus;
        detail?: string;
        smtpConfigured?: boolean;
        log?: RecurringDeliveryLog;
      };
      if (typeof body.smtpConfigured === 'boolean') {
        setSmtpConfigured(body.smtpConfigured);
      }
      if (body.log) {
        setDeliveryLogs((prev) => [body.log!, ...prev].slice(0, 50));
      }
      if (onUpdateInvoiceDelivery && body.deliveryStatus) {
        onUpdateInvoiceDelivery(inv.id, body.deliveryStatus, body.detail, scheduleId);
      }
      flash(body.detail || `Generated ${inv.invoiceNumber}.`);
    } catch (err) {
      if (err instanceof OwnerAuthError) {
        onRequireOwnerAuth?.('Sign in as the workspace owner to dispatch recurring emails.');
        flash(`Generated ${inv.invoiceNumber} locally. Sign in as owner to dispatch email via server.`);
        return;
      }
      if (onUpdateInvoiceDelivery) {
        onUpdateInvoiceDelivery(
          inv.id,
          'failed',
          'Email dispatch API unreachable.',
          scheduleId
        );
      }
      flash(`Generated ${inv.invoiceNumber} locally (email transport server unreachable).`);
    } finally {
      setDispatchingId(null);
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setName('');
    setSelectedClientId(clients[0]?.id ?? '');
    setFrequency('monthly');
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate('');
    setAutoSend(true);
    setDueDays(14);
    setTemplate('modern');
    setCurrency(defaultCurrency);
    setItems([
      {
        id: `r-item-${Date.now()}`,
        description: 'Monthly Service Retainer',
        quantity: 1,
        unitPrice: 1200,
        taxRate: 0,
      },
    ]);
    setEnabledPaymentIds(
      paymentAccounts.filter((a) => a.connected && a.enabledByDefault).map((a) => a.id)
    );
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (sch: RecurringInvoiceSchedule) => {
    setEditingId(sch.id);
    setName(sch.name);
    setSelectedClientId(sch.templateSnapshot.clientId ?? '');
    setFrequency(sch.frequency);
    setStartDate(sch.startDate);
    setEndDate(sch.endDate);
    setAutoSend(sch.autoSend);
    setDueDays(sch.dueDaysAfterIssue);
    setTemplate(sch.templateSnapshot.design.template);
    setCurrency(sch.templateSnapshot.currency);
    setItems(sch.templateSnapshot.items.map((i) => ({ ...i })));
    setEnabledPaymentIds([...sch.templateSnapshot.enabledPaymentIds]);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Please enter a schedule name.');
      return;
    }
    const client = clients.find((c) => c.id === selectedClientId);
    if (!client) {
      setFormError('Please select a client from your directory.');
      return;
    }
    if (endDate && endDate < startDate) {
      setFormError('End date cannot be earlier than start date.');
      return;
    }

    const existing = editingId ? schedules.find((s) => s.id === editingId) : undefined;
    const schedule: RecurringInvoiceSchedule = {
      id: existing?.id ?? `rec-${Date.now()}`,
      name: name.trim(),
      frequency,
      startDate,
      endDate,
      nextRunDate: existing ? existing.nextRunDate : startDate,
      lastGeneratedDate: existing?.lastGeneratedDate,
      lastDeliveryStatus: existing?.lastDeliveryStatus,
      lastDeliveryDetail: existing?.lastDeliveryDetail,
      status: existing?.status === 'cancelled' ? 'active' : existing?.status ?? 'active',
      autoSend,
      dueDaysAfterIssue: dueDays,
      generatedCount: existing?.generatedCount ?? 0,
      templateSnapshot: {
        title: 'INVOICE',
        currency,
        clientId: client.id,
        customer: {
          name: client.name,
          company: client.company,
          address: client.address,
          email: client.email,
          phone: client.phone,
        },
        items,
        discountType: 'percent',
        discountValue: 0,
        additional: existing?.templateSnapshot.additional ?? {
          paymentInstructions: 'Pay online via share link or bank transfer.',
          bankDetails: '',
          notes: `Recurring ${frequency} billing invoice.`,
          terms: `Net ${dueDays} days from issue date.`,
          footerMessage: '',
        },
        design: {
          template,
          accentColor: '#1D4ED8',
          fontStyle: template === 'classic' ? 'serif' : 'sans',
          logoPlacement: template === 'classic' ? 'center' : 'left',
          headerStyle: template === 'classic' ? 'bordered' : 'clean',
          footerStyle: template === 'minimal' ? 'minimal' : 'detailed',
        },
        enabledPaymentIds,
      },
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    onSaveSchedule(schedule);
    setModalOpen(false);
    flash(
      editingId
        ? `Recurring schedule "${schedule.name}" updated.`
        : `Recurring schedule "${schedule.name}" created.`
    );
  };

  const connectedAccounts = paymentAccounts.filter((a) => a.connected);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Recurring Invoices
          </h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Schedule daily, weekly, monthly, quarterly, or yearly billing with honest delivery
            tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const next = !logsOpen;
              setLogsOpen(next);
              if (next) void fetchDeliveryLogs(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap"
          >
            <History className="h-3.5 w-3.5" />
            <span>Delivery Logs ({deliveryLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              const generated = onRunDueSchedules();
              if (generated.length === 0) {
                flash('All active schedules are up to date — no occurrences due today.');
                return;
              }
              for (const inv of generated) {
                if (inv.deliveryStatus === 'queued') {
                  await dispatchInvoiceToBackend(inv, inv.recurringScheduleId || 'due');
                }
              }
              flash(
                `Generated ${generated.length} due recurring invoice${generated.length === 1 ? '' : 's'}.`
              );
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Run Due Schedules</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>New Recurring Schedule</span>
          </button>
        </div>
      </div>

      {/* Honest Email Transport Status Banner */}
      <div
        className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs ${
          smtpConfigured
            ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
            : 'border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
        }`}
      >
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          {smtpConfigured ? (
            <span>
              <strong>SMTP Transport Connected:</strong> Auto-dispatch schedules hand customer emails
              to your configured SMTP relay (<em>Accepted by SMTP Relay</em>) and log attempts.
              Final recipient inbox delivery depends on external mail servers.
            </span>
          ) : (
            <span>
              <strong>Email Transport Setup Required:</strong> <code className="font-mono">SMTP_HOST</code>{' '}
              is not configured on the server. Generated invoices are recorded honestly as{' '}
              <em>Queued / Setup Required</em> instead of falsely claiming email delivery.
            </span>
          )}
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200"
        >
          {notice}
        </div>
      )}

      {/* Delivery Logs Drawer */}
      {logsOpen && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Recent Recurring Email Dispatch History
            </h3>
            <button
              type="button"
              onClick={() => fetchDeliveryLogs(true)}
              className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
            >
              Refresh
            </button>
          </div>
          {deliveryLogs.length === 0 ? (
            <p className="text-xs text-slate-500">No email dispatch attempts recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {deliveryLogs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {log.invoiceNumber}
                    </span>{' '}
                    <span className="text-slate-500">
                      ({log.recipientEmail || 'No recipient email'})
                    </span>
                    <div className="text-[11px] text-slate-500 mt-0.5">{log.detail}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <DeliveryBadge status={log.status} />
                    <span className="text-[10px] text-slate-400">
                      {new Date(log.dispatchedAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Schedules List */}
      {schedules.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900">
          <Repeat className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
            No recurring invoice schedules yet
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Configure a template, frequency, and start date to automatically issue client invoices.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Recurring Schedule</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((sch) => {
            const totals = calculateInvoiceTotals(
              sch.templateSnapshot.items,
              sch.templateSnapshot.discountType,
              sch.templateSnapshot.discountValue,
              {
                currency: sch.templateSnapshot.currency,
                taxTreatment: sch.templateSnapshot.taxTreatment ?? 'after_discount',
                invoiceTaxRate: sch.templateSnapshot.invoiceTaxRate ?? 0,
              }
            );
            const confirmingCancel = confirmCancelId === sch.id;

            return (
              <article
                key={sch.id}
                className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {sch.name}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium capitalize ${
                          sch.status === 'active'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : sch.status === 'paused'
                              ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                              : sch.status === 'completed'
                                ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                                : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {sch.status}
                      </span>
                      <DeliveryBadge status={sch.lastDeliveryStatus} />
                      <span className="text-xs text-slate-400">&middot;</span>
                      <span className="text-xs font-medium capitalize text-slate-600 dark:text-slate-300">
                        {sch.frequency}
                      </span>
                      <span className="text-xs text-slate-400">&middot;</span>
                      <span className="text-xs text-slate-500 capitalize">
                        {sch.templateSnapshot.design.template} template
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Client:{' '}
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {sch.templateSnapshot.customer.company || sch.templateSnapshot.customer.name}
                      </span>{' '}
                      &middot;{' '}
                      <span>
                        {sch.autoSend
                          ? 'Auto-generates Unpaid & attempts SMTP delivery'
                          : 'Auto-generates locally as Draft'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>
                        Start:{' '}
                        <strong className="text-slate-700 dark:text-slate-200">
                          {formatDisplayDate(sch.startDate, dateFormat)}
                        </strong>
                      </span>
                      <span>
                        Next Run:{' '}
                        <strong className="text-blue-700 dark:text-blue-400">
                          {sch.status === 'cancelled' || sch.status === 'completed'
                            ? '—'
                            : formatDisplayDate(sch.nextRunDate, dateFormat)}
                        </strong>
                      </span>
                      <span>
                        End:{' '}
                        <strong className="text-slate-700 dark:text-slate-200">
                          {sch.endDate ? formatDisplayDate(sch.endDate, dateFormat) : 'Ongoing'}
                        </strong>
                      </span>
                      <span>Generated: {sch.generatedCount}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3 shrink-0">
                    <div className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatCurrency(totals.grandTotal, sch.templateSnapshot.currency)}
                    </div>

                    {confirmingCancel ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateStatus(sch.id, 'cancelled');
                            setConfirmCancelId(null);
                            flash(`Cancelled upcoming invoices for "${sch.name}".`);
                          }}
                          className="rounded bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                        >
                          Confirm Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteSchedule(sch.id);
                            setConfirmCancelId(null);
                            flash(`Deleted schedule "${sch.name}".`);
                          }}
                          className="rounded border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmCancelId(null)}
                          className="rounded border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        >
                          Keep
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onPreviewScheduleInvoice(sch)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Preview</span>
                        </button>

                        {sch.status !== 'cancelled' && sch.status !== 'completed' && (
                          <button
                            type="button"
                            disabled={dispatchingId === sch.id}
                            onClick={async () => {
                              const generated = onGenerateNow(sch);
                              if (sch.autoSend) {
                                await dispatchInvoiceToBackend(generated, sch.id);
                              } else {
                                flash(`Generated Draft invoice ${generated.invoiceNumber}.`);
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300 disabled:opacity-50"
                          >
                            {sch.autoSend ? (
                              <Send className="h-3.5 w-3.5" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            <span>
                              {dispatchingId === sch.id ? 'Dispatching...' : 'Generate Now'}
                            </span>
                          </button>
                        )}

                        {sch.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(sch.id, 'paused')}
                            aria-label={`Pause schedule ${sch.name}`}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                          >
                            <Pause className="h-3.5 w-3.5" />
                            <span>Pause</span>
                          </button>
                        )}

                        {sch.status === 'paused' && (
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(sch.id, 'active')}
                            aria-label={`Resume schedule ${sch.name}`}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          >
                            <Play className="h-3.5 w-3.5" />
                            <span>Resume</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openEditModal(sch)}
                          aria-label={`Edit schedule ${sch.name}`}
                          className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setConfirmCancelId(sch.id)}
                          aria-label={`Cancel or remove schedule ${sch.name}`}
                          className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:hover:bg-rose-950/60"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create / Edit Recurring Schedule Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? 'Edit Recurring Schedule' : 'Create Recurring Schedule'}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {editingId ? 'Edit Recurring Invoice Schedule' : 'New Recurring Invoice Schedule'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close recurring schedule dialog"
                className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="rec-name"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Schedule Name *
                  </label>
                  <input
                    id="rec-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Monthly SaaS Support Retainer"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="rec-client"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Client *
                  </label>
                  <select
                    id="rec-client"
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="">Select client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company ? `${c.company} (${c.name})` : c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="rec-freq"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Frequency
                  </label>
                  <select
                    id="rec-freq"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="rec-start"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Start Date
                  </label>
                  <input
                    id="rec-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="rec-end"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    End Date (optional)
                  </label>
                  <input
                    id="rec-end"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="rec-tpl"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Invoice Template
                  </label>
                  <select
                    id="rec-tpl"
                    value={template}
                    onChange={(e) => setTemplate(e.target.value as TemplateId)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="modern">Modern</option>
                    <option value="classic">Classic</option>
                    <option value="minimal">Minimal</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="rec-currency"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Currency
                    </label>
                    <select
                      id="rec-currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="rec-due-days"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Due (Days)
                    </label>
                    <input
                      id="rec-due-days"
                      type="number"
                      min="0"
                      max="90"
                      value={dueDays}
                      onChange={(e) => setDueDays(Number(e.target.value) || 0)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Recurring Line Items
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setItems([
                        ...items,
                        {
                          id: `r-item-${Date.now()}`,
                          description: '',
                          quantity: 1,
                          unitPrice: 0,
                          taxRate: 0,
                        },
                      ])
                    }
                    className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
                  >
                    + Add Item
                  </button>
                </div>

                {items.map((item, idx) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      aria-label={`Recurring item ${idx + 1} description`}
                      value={item.description}
                      onChange={(e) =>
                        setItems(
                          items.map((it) =>
                            it.id === item.id ? { ...it, description: e.target.value } : it
                          )
                        )
                      }
                      placeholder="Service description"
                      className="col-span-6 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                    <input
                      type="number"
                      aria-label={`Recurring item ${idx + 1} quantity`}
                      value={item.quantity}
                      onChange={(e) =>
                        setItems(
                          items.map((it) =>
                            it.id === item.id ? { ...it, quantity: Number(e.target.value) || 0 } : it
                          )
                        )
                      }
                      className="col-span-2 rounded-md border border-slate-200 px-2 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                    <input
                      type="number"
                      aria-label={`Recurring item ${idx + 1} unit price`}
                      value={item.unitPrice}
                      onChange={(e) =>
                        setItems(
                          items.map((it) =>
                            it.id === item.id
                              ? { ...it, unitPrice: Number(e.target.value) || 0 }
                              : it
                          )
                        )
                      }
                      className="col-span-3 rounded-md border border-slate-200 px-2 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                    <button
                      type="button"
                      disabled={items.length <= 1}
                      onClick={() => setItems(items.filter((it) => it.id !== item.id))}
                      aria-label={`Remove recurring item ${idx + 1}`}
                      className="col-span-1 flex justify-center text-slate-400 hover:text-rose-600 disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Payment Options & Honest Auto-Dispatch */}
              <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={autoSend}
                    onChange={(e) => setAutoSend(e.target.checked)}
                    className="rounded border-slate-300 accent-blue-700"
                  />
                  <span>
                    Queue invoice for SMTP email delivery on generation (uncheck to keep as Draft)
                  </span>
                </label>

                {connectedAccounts.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Accepted Payment Methods on Generated Invoices
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {connectedAccounts.map((acc) => {
                        const checked = enabledPaymentIds.includes(acc.id);
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() =>
                              setEnabledPaymentIds(
                                checked
                                  ? enabledPaymentIds.filter((id) => id !== acc.id)
                                  : [...enabledPaymentIds, acc.id]
                              )
                            }
                            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                              checked
                                ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
                                : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400'
                            }`}
                          >
                            {acc.providerName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
                >
                  {editingId ? 'Save Schedule' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
