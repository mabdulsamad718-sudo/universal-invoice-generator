import { useState } from 'react';
import {
  Search,
  Eye,
  FileEdit,
  Copy,
  Download,
  Trash2,
  FilePlus2,
  CheckCircle2,
} from 'lucide-react';
import type { DateFormatOption, Invoice, InvoiceStatus } from '../types/invoice';
import {
  calculateInvoiceTotals,
  formatCurrency,
  formatDisplayDate,
} from '../utils/calculations';
import { StatusLabel } from './StatusLabel';

interface AllInvoicesViewProps {
  invoices: Invoice[];
  dateFormat: DateFormatOption;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: InvoiceStatus | 'all';
  onStatusFilterChange: (status: InvoiceStatus | 'all') => void;
  onCreateNew: () => void;
  onViewInvoice: (invoice: Invoice) => void;
  onEditInvoice: (invoice: Invoice) => void;
  onDuplicateInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (id: string) => void;
  onMarkPaid: (id: string) => void;
}

const STATUS_TABS: { id: InvoiceStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'paid', label: 'Paid' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'sent', label: 'Sent' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'draft', label: 'Draft' },
  { id: 'cancelled', label: 'Cancelled' },
];

export function AllInvoicesView({
  invoices,
  dateFormat,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onCreateNew,
  onViewInvoice,
  onEditInvoice,
  onDuplicateInvoice,
  onDeleteInvoice,
  onMarkPaid,
}: AllInvoicesViewProps) {
  const [dateFilter, setDateFilter] = useState<'all' | '30d' | '90d' | '2026'>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'number-asc'>(
    'date-desc'
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const nowMs = Date.now();

  const filtered = invoices
    .filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = [
          inv.invoiceNumber,
          inv.customer.name,
          inv.customer.company,
          inv.customer.email,
          inv.business.name,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (dateFilter === '30d' || dateFilter === '90d') {
        const days = dateFilter === '30d' ? 30 : 90;
        const t = Date.parse(inv.issueDate);
        if (!Number.isNaN(t)) {
          const diffDays = (nowMs - t) / (1000 * 60 * 60 * 24);
          if (diffDays > days) return false;
        }
      } else if (dateFilter === '2026') {
        if (!inv.issueDate.startsWith('2026')) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date-desc') return b.issueDate.localeCompare(a.issueDate);
      if (sortBy === 'date-asc') return a.issueDate.localeCompare(b.issueDate);
      if (sortBy === 'number-asc') return a.invoiceNumber.localeCompare(b.invoiceNumber);
      const totA = calculateInvoiceTotals(a.items, a.discountType, a.discountValue, {
        currency: a.currency,
        taxTreatment: a.taxTreatment ?? 'after_discount',
        invoiceTaxRate: a.invoiceTaxRate ?? 0,
      }).grandTotal;
      const totB = calculateInvoiceTotals(b.items, b.discountType, b.discountValue, {
        currency: b.currency,
        taxTreatment: b.taxTreatment ?? 'after_discount',
        invoiceTaxRate: b.invoiceTaxRate ?? 0,
      }).grandTotal;
      return totB - totA;
    });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            All Invoices
          </h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Search, filter, duplicate, export, or update the status of your invoices.
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateNew}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap"
        >
          <FilePlus2 className="h-4 w-4" />
          <span>New Invoice</span>
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Filter Segmented Controls */}
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {STATUS_TABS.map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onStatusFilterChange(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search # or client..."
                aria-label="Filter invoices by number or client"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/70 py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <select
              aria-label="Filter by date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Dates</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="2026">Year 2026</option>
            </select>

            <select
              aria-label="Sort invoices"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="amount-desc">Highest Amount</option>
              <option value="number-asc">Invoice Number</option>
            </select>
          </div>
        </div>
      </div>

      {/* Invoices Table / Empty State */}
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No matching invoices found
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Try adjusting your search query, status filter, or create a brand new invoice.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {(searchQuery || statusFilter !== 'all' || dateFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    onSearchChange('');
                    onStatusFilterChange('all');
                    setDateFilter('all');
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Clear Filters
                </button>
              )}
              <button
                type="button"
                onClick={onCreateNew}
                className="rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800"
              >
                Create Invoice
              </button>
            </div>
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
                    <th className="py-3 px-4 font-medium">Issued</th>
                    <th className="py-3 px-4 font-medium">Due</th>
                    <th className="py-3 px-4 font-medium">Template</th>
                    <th className="py-3 px-4 text-right font-medium">Total</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filtered.map((inv) => {
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
                    const confirming = confirmDeleteId === inv.id;

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
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                          {formatDisplayDate(inv.dueDate, dateFormat)}
                        </td>
                        <td className="py-3.5 px-4 capitalize text-slate-600 dark:text-slate-300">
                          {inv.design.template}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                          {formatCurrency(totals.grandTotal, inv.currency)}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusLabel status={inv.status} />
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          {confirming ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteInvoice(inv.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="rounded bg-rose-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-rose-700"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onViewInvoice(inv)}
                                aria-label={`View invoice ${inv.invoiceNumber}`}
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
                                onClick={() => onDuplicateInvoice(inv)}
                                aria-label={`Duplicate invoice ${inv.invoiceNumber}`}
                                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onViewInvoice(inv)}
                                aria-label={`Download PDF for ${inv.invoiceNumber}`}
                                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>
                              {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                                <button
                                  type="button"
                                  onClick={() => onMarkPaid(inv.id)}
                                  aria-label={`Mark ${inv.invoiceNumber} as paid`}
                                  className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/60"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(inv.id)}
                                aria-label={`Delete invoice ${inv.invoiceNumber}`}
                                className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="divide-y divide-slate-200 md:hidden dark:divide-slate-800">
              {filtered.map((inv) => {
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
                  <div key={inv.id} className="p-4 space-y-3">
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
                          Issued {formatDisplayDate(inv.issueDate, dateFormat)} · Due{' '}
                          {formatDisplayDate(inv.dueDate, dateFormat)}
                        </div>
                      </div>
                      <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        {formatCurrency(totals.grandTotal, inv.currency)}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onViewInvoice(inv)}
                        className="flex-1 rounded-md border border-slate-200 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                      >
                        View / PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditInvoice(inv)}
                        className="flex-1 rounded-md border border-slate-200 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDuplicateInvoice(inv)}
                        className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteInvoice(inv.id)}
                        aria-label={`Delete invoice ${inv.invoiceNumber}`}
                        className="rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:border-rose-900 dark:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
