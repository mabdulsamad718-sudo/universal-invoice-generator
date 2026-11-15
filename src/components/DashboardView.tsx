import { Eye, FileEdit, FilePlus2, Printer, ArrowUpRight } from 'lucide-react';
import type { DateFormatOption, Invoice, InvoiceStatus } from '../types/invoice';
import {
  calculateInvoiceTotals,
  computeDashboardMetrics,
  computeMonthlyActivity,
  formatCurrency,
  formatDisplayDate,
} from '../utils/calculations';
import { StatusLabel } from './StatusLabel';

interface DashboardViewProps {
  invoices: Invoice[];
  dateFormat: DateFormatOption;
  onCreateNew: () => void;
  onViewInvoice: (invoice: Invoice) => void;
  onEditInvoice: (invoice: Invoice) => void;
  onNavigateAll: (statusFilter?: InvoiceStatus | 'all') => void;
}

export function DashboardView({
  invoices,
  dateFormat,
  onCreateNew,
  onViewInvoice,
  onEditInvoice,
  onNavigateAll,
}: DashboardViewProps) {
  const metrics = computeDashboardMetrics(invoices);
  const activity = computeMonthlyActivity(invoices);
  const maxActivityCount = Math.max(1, ...activity.map((a) => a.count));

  const recentInvoices = [...invoices]
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate))
    .slice(0, 5);

  const summaryCards: {
    label: string;
    value: number;
    detail: string;
    filter: InvoiceStatus | 'all';
    accentClass: string;
  }[] = [
    {
      label: 'Total Invoices',
      value: metrics.totalCount,
      detail: 'All created documents',
      filter: 'all',
      accentClass: 'text-slate-900 dark:text-slate-100',
    },
    {
      label: 'Paid Invoices',
      value: metrics.paidCount,
      detail: 'Completed settlements',
      filter: 'paid',
      accentClass: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      label: 'Unpaid Invoices',
      value: metrics.unpaidCount,
      detail:
        metrics.overdueCount > 0
          ? `${metrics.overdueCount} overdue awaiting payment`
          : 'Awaiting client payment',
      filter: 'unpaid',
      accentClass: 'text-amber-700 dark:text-amber-400',
    },
    {
      label: 'Draft Invoices',
      value: metrics.draftCount,
      detail: 'Saved works in progress',
      filter: 'draft',
      accentClass: 'text-blue-700 dark:text-blue-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Invoice Workspace
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Create, customize, and manage client invoices from a single focused workspace.
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateNew}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
        >
          <FilePlus2 className="h-4 w-4" />
          <span>Create New Invoice</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <section aria-label="Invoice Summary" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => onNavigateAll(card.filter)}
            className="group rounded-xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {card.label}
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <div className={`mt-2 font-mono text-3xl font-bold tabular-nums ${card.accentClass}`}>
              {card.value}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{card.detail}</div>
          </button>
        ))}
      </section>

      {/* Recent Invoices + Activity Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Recent Invoices Table */}
        <section className="xl:col-span-8 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Recent Invoices
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Latest documents across drafts, sent, and paid records
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateAll('all')}
              className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400 whitespace-nowrap"
            >
              View all invoices
            </button>
          </div>

          {recentInvoices.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                No invoices created yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Start by creating your first customized invoice with logo and signature.
              </p>
              <button
                type="button"
                onClick={onCreateNew}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
              >
                <FilePlus2 className="h-3.5 w-3.5" />
                <span>Create First Invoice</span>
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                      <th className="py-3 px-5 font-medium">Invoice #</th>
                      <th className="py-3 px-4 font-medium">Customer</th>
                      <th className="py-3 px-4 font-medium">Invoice Date</th>
                      <th className="py-3 px-4 text-right font-medium">Total</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-5 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {recentInvoices.map((inv) => {
                      const totals = calculateInvoiceTotals(
                        inv.items,
                        inv.discountType,
                        inv.discountValue,
                        {
                          currency: inv.currency,
                          taxTreatment: inv.taxTreatment ?? 'after_discount',
                          invoiceTaxRate: inv.invoiceTaxRate ?? 0,
                        }
                      );
                      return (
                        <tr
                          key={inv.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-5 font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {inv.invoiceNumber}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {inv.customer.company || inv.customer.name || 'Unnamed Client'}
                            </div>
                            {inv.customer.company && inv.customer.name && (
                              <div className="text-[11px] text-slate-500">{inv.customer.name}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                            {formatDisplayDate(inv.issueDate, dateFormat)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                            {formatCurrency(totals.grandTotal, inv.currency)}
                          </td>
                          <td className="py-3.5 px-4">
                            <StatusLabel status={inv.status} />
                          </td>
                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onViewInvoice(inv)}
                                aria-label={`Preview invoice ${inv.invoiceNumber}`}
                                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditInvoice(inv)}
                                aria-label={`Edit invoice ${inv.invoiceNumber}`}
                                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                              >
                                <FileEdit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onViewInvoice(inv)}
                                aria-label={`Download or print invoice ${inv.invoiceNumber}`}
                                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="divide-y divide-slate-200 md:hidden dark:divide-slate-800">
                {recentInvoices.map((inv) => {
                  const totals = calculateInvoiceTotals(
                    inv.items,
                    inv.discountType,
                    inv.discountValue,
                    {
                      currency: inv.currency,
                      taxTreatment: inv.taxTreatment ?? 'after_discount',
                      invoiceTaxRate: inv.invoiceTaxRate ?? 0,
                    }
                  );
                  return (
                    <div key={inv.id} className="p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {inv.invoiceNumber}
                        </span>
                        <StatusLabel status={inv.status} />
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {inv.customer.company || inv.customer.name || 'Unnamed Client'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatDisplayDate(inv.issueDate, dateFormat)}
                          </div>
                        </div>
                        <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                          {formatCurrency(totals.grandTotal, inv.currency)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => onViewInvoice(inv)}
                          className="flex-1 rounded-md border border-slate-200 bg-white py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          View & Export
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditInvoice(inv)}
                          className="flex-1 rounded-md border border-slate-200 bg-white py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* Compact Invoice Activity Visualization */}
        <section className="xl:col-span-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Invoice Activity
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Monthly documents issued vs. settled
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-xs bg-slate-300 dark:bg-slate-600" />
                Issued
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-xs bg-blue-700" />
                Paid
              </span>
            </div>
          </div>

          {activity.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Activity will appear once invoices are added.
            </div>
          ) : (
            <div className="mt-6 flex items-end justify-between gap-3 h-40 pt-4 border-b border-slate-200 dark:border-slate-800">
              {activity.map((point) => {
                const totalHeightPct = Math.max(14, Math.round((point.count / maxActivityCount) * 100));
                const paidHeightPct =
                  point.count > 0 ? Math.round((point.paidCount / point.count) * 100) : 0;
                return (
                  <div
                    key={point.monthKey}
                    className="flex flex-1 flex-col items-center justify-end h-full gap-2"
                  >
                    <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                      {point.count}
                    </div>
                    <div className="relative flex w-full max-w-[32px] flex-1 items-end">
                      <div
                        style={{ height: `${totalHeightPct}%` }}
                        className="relative w-full overflow-hidden rounded-t bg-slate-200 dark:bg-slate-700"
                        title={`${point.label}: ${point.count} issued, ${point.paidCount} paid`}
                      >
                        <div
                          style={{ height: `${paidHeightPct}%` }}
                          className="absolute bottom-0 left-0 right-0 bg-blue-700 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activity.length > 0 && (
            <div className="mt-2 flex items-center justify-between gap-3">
              {activity.map((point) => (
                <div
                  key={point.monthKey}
                  className="flex-1 text-center text-[11px] font-medium text-slate-500 truncate"
                >
                  {point.label}
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
              Quick Tip
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Save your business logo, default currency, signature, and company seal in{' '}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Business Profile
              </span>{' '}
              to auto-fill every new invoice.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
