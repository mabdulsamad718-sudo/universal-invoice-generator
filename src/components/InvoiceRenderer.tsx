import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Move, Maximize2, Link2 } from 'lucide-react';
import type {
  AuthPlacementElement,
  ConnectedPaymentAccount,
  DateFormatOption,
  Invoice,
} from '../types/invoice';
import {
  calculateInvoiceTotals,
  calculateLineItem,
  formatCurrency,
  formatDisplayDate,
  resolveEffectiveTaxRate,
} from '../utils/calculations';
import { getInvoiceAuthElements, syncAuthElementsToInvoice } from '../utils/authElements';
import { buildDirectPaymentUrl, resolveInvoicePaymentAccounts } from '../utils/recurring';

interface InvoiceRendererProps {
  invoice: Invoice;
  dateFormat?: DateFormatOption;
  paymentAccounts?: ConnectedPaymentAccount[];
  interactive?: boolean;
  selectedElementId?: string | null;
  onSelectElementId?: (id: string | null) => void;
  onAuthElementsChange?: (elements: AuthPlacementElement[]) => void;
  onSignatureChange?: (patch: Partial<Invoice['signature']>) => void;
  onStampChange?: (patch: Partial<Invoice['stamp']>) => void;
  printableId?: string;
  compact?: boolean;
}

export function InvoiceRenderer({
  invoice,
  dateFormat = 'DD MMM YYYY',
  paymentAccounts = [],
  interactive = false,
  selectedElementId,
  onSelectElementId,
  onAuthElementsChange,
  onSignatureChange,
  onStampChange,
  printableId,
  compact = false,
}: InvoiceRendererProps) {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const activeSelectedId =
    selectedElementId !== undefined ? selectedElementId : internalSelectedId;
  const setSelected = (id: string | null) => {
    setInternalSelectedId(id);
    if (onSelectElementId) onSelectElementId(id);
  };

  const authElements = getInvoiceAuthElements(invoice);

  const dragStateRef = useRef<{
    mode: 'drag' | 'resize';
    elementId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    origWidth: number;
  } | null>(null);

  const totals = calculateInvoiceTotals(
    invoice.items,
    invoice.discountType,
    invoice.discountValue,
    {
      currency: invoice.currency,
      taxTreatment: invoice.taxTreatment ?? 'after_discount',
      invoiceTaxRate: invoice.invoiceTaxRate ?? 0,
    }
  );

  const { design, business, customer, additional } = invoice;
  const accent = design.accentColor || '#1D4ED8';

  const fontClass =
    design.fontStyle === 'serif'
      ? 'font-invoice-serif'
      : design.fontStyle === 'mono'
        ? 'font-invoice-mono'
        : 'font-invoice-sans';

  const commitElements = (next: AuthPlacementElement[]) => {
    if (onAuthElementsChange) {
      onAuthElementsChange(next);
      return;
    }
    const synced = syncAuthElementsToInvoice(invoice, next);
    if (onSignatureChange) onSignatureChange(synced.signature);
    if (onStampChange) onStampChange(synced.stamp);
  };

  const startDrag = (
    e: ReactPointerEvent<HTMLDivElement>,
    el: AuthPlacementElement
  ) => {
    if (!interactive) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelected(el.id);
    setIsDragging(true);

    dragStateRef.current = {
      mode: 'drag',
      elementId: el.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: el.x,
      origY: el.y,
      origWidth: el.width,
    };
  };

  const startResize = (
    e: ReactPointerEvent<HTMLButtonElement>,
    el: AuthPlacementElement
  ) => {
    if (!interactive) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelected(el.id);
    setIsDragging(true);

    dragStateRef.current = {
      mode: 'resize',
      elementId: el.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: el.x,
      origY: el.y,
      origWidth: el.width,
    };
  };

  const handlePagePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    const page = pageRef.current;
    if (!state || !page || !interactive) return;

    const rect = page.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dx = e.clientX - state.startClientX;
    const dy = e.clientY - state.startClientY;

    if (state.mode === 'drag') {
      const pctDx = (dx / rect.width) * 100;
      const pctDy = (dy / rect.height) * 100;
      const target = authElements.find((el) => el.id === state.elementId);
      const widthPct = target ? Math.min(40, (target.width / Math.max(1, rect.width)) * 100) : 14;
      const maxX = Math.max(10, Math.round(98 - widthPct));
      let nextX = Math.max(2, Math.min(maxX, Math.round(state.origX + pctDx)));
      let nextY = Math.max(2, Math.min(90, Math.round(state.origY + pctDy)));

      // Soft snap guides near center (50%) and margins (6%, 72%)
      if (Math.abs(nextX - 6) <= 1) nextX = 6;
      if (Math.abs(nextX - 42) <= 1) nextX = 42;
      if (Math.abs(nextX - 72) <= 1) nextX = 72;

      const updated = authElements.map((el) =>
        el.id === state.elementId ? { ...el, x: nextX, y: nextY } : el
      );
      commitElements(updated);
    } else if (state.mode === 'resize') {
      const target = authElements.find((el) => el.id === state.elementId);
      const minW = target?.kind === 'stamp' ? 56 : 84;
      const maxW = target?.kind === 'stamp' ? 200 : 280;
      const nextWidth = Math.max(minW, Math.min(maxW, Math.round(state.origWidth + dx)));
      const updated = authElements.map((el) =>
        el.id === state.elementId ? { ...el, width: nextWidth } : el
      );
      commitElements(updated);
    }
  };

  const endPointerOp = () => {
    dragStateRef.current = null;
    setIsDragging(false);
  };

  const logoBlock = business.logoDataUrl ? (
    <img
      src={business.logoDataUrl}
      alt={`${business.name || 'Business'} logo`}
      referrerPolicy="no-referrer"
      className={`${compact ? 'h-9 w-9' : 'h-12 w-12'} rounded object-contain shrink-0`}
    />
  ) : (
    <div
      className={`${compact ? 'h-9 w-9 text-xs' : 'h-12 w-12 text-sm'} flex items-center justify-center rounded font-bold text-white shrink-0`}
      style={{ backgroundColor: accent }}
    >
      {(business.name || 'UI').slice(0, 2).toUpperCase()}
    </div>
  );

  const headerContainerClasses =
    design.headerStyle === 'tinted'
      ? 'rounded-lg p-5'
      : design.headerStyle === 'bordered'
        ? 'border-b-2 pb-5'
        : 'pb-5 border-b border-slate-200';

  const headerStyleInline =
    design.headerStyle === 'tinted'
      ? { backgroundColor: `${accent}10`, borderLeft: 'none' }
      : design.headerStyle === 'bordered'
        ? { borderColor: accent }
        : undefined;

  const isClassic = design.template === 'classic';
  const isMinimal = design.template === 'minimal';
  const hasAnyItemDiscount = invoice.items.some((it) => (it.discountValue ?? 0) > 0);
  const visibleAuthElements = authElements
    .filter((el) => el.enabled)
    .sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      ref={pageRef}
      id={printableId}
      data-testid="invoice-sheet-stage"
      onPointerMove={handlePagePointerMove}
      onPointerUp={endPointerOp}
      onPointerCancel={endPointerOp}
      className={`relative bg-white text-slate-900 shadow-sm border border-slate-200/90 ${fontClass} ${
        compact ? 'p-5 text-[11px]' : 'p-8 sm:p-10 text-[13px]'
      } leading-relaxed`}
      onClick={() => interactive && setSelected(null)}
    >
      {/* Snap Alignment Guides when dragging overlays across full sheet */}
      {interactive && isDragging && (
        <div className="no-print pointer-events-none absolute inset-0 z-20">
          <div className="absolute inset-y-4 left-[6%] border-l border-dashed border-blue-400/50" />
          <div className="absolute inset-y-4 left-1/2 border-l border-dashed border-blue-400/50" />
          <div className="absolute inset-y-4 right-[6%] border-r border-dashed border-blue-400/50" />
        </div>
      )}

      {/* Template Top Accent Rule for Modern */}
      {design.template === 'modern' && (
        <div
          className={`${compact ? '-mx-5 -mt-5 mb-5 h-1.5' : '-mx-8 sm:-mx-10 -mt-8 sm:-mt-10 mb-8 h-2'}`}
          style={{ backgroundColor: accent }}
        />
      )}

      {/* Header Section */}
      {isClassic ? (
        <header className={`${headerContainerClasses} mb-6`} style={headerStyleInline}>
          <div
            className={`flex flex-col gap-3 ${
              design.logoPlacement === 'center'
                ? 'items-center text-center'
                : design.logoPlacement === 'right'
                  ? 'items-end text-right'
                  : 'items-start text-left'
            }`}
          >
            {logoBlock}
            <div>
              <h1 className={`${compact ? 'text-base' : 'text-xl'} font-bold tracking-tight text-slate-900`}>
                {business.name || 'Your Business Name'}
              </h1>
              <p className="mt-1 whitespace-pre-line text-xs text-slate-600">
                {business.address || 'Business Street Address'}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {[business.email, business.phone, business.website].filter(Boolean).join(' · ')}
              </p>
              {business.taxNumber && (
                <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                  Tax ID: {business.taxNumber}
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4">
            <div>
              <span
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: accent }}
              >
                Official Document
              </span>
              <h2 className={`${compact ? 'text-lg' : 'text-2xl'} font-bold tracking-tight text-slate-900`}>
                {invoice.title || 'INVOICE'}
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-4 rounded border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-left">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Invoice No.
                </div>
                <div className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                  {invoice.invoiceNumber || 'INV-001'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Issued
                </div>
                <div className="text-xs font-medium text-slate-800 tabular-nums">
                  {formatDisplayDate(invoice.issueDate, dateFormat)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Due Date
                </div>
                <div className="text-xs font-medium text-slate-800 tabular-nums">
                  {formatDisplayDate(invoice.dueDate, dateFormat)}
                </div>
              </div>
            </div>
          </div>
        </header>
      ) : (
        <header
          className={`${headerContainerClasses} mb-6 flex flex-wrap items-start justify-between gap-6`}
          style={headerStyleInline}
        >
          <div
            className={`flex gap-3.5 ${
              design.logoPlacement === 'right'
                ? 'flex-row-reverse items-start'
                : design.logoPlacement === 'center'
                  ? 'flex-col items-start'
                  : 'items-start'
            }`}
          >
            {logoBlock}
            <div>
              <h1 className={`${compact ? 'text-base' : 'text-xl'} font-bold tracking-tight text-slate-900`}>
                {business.name || 'Your Business Name'}
              </h1>
              <p className="mt-1 whitespace-pre-line text-xs text-slate-600">
                {business.address || 'Business Street Address'}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                {business.email && <span>{business.email}</span>}
                {business.phone && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{business.phone}</span>
                  </>
                )}
                {business.website && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{business.website}</span>
                  </>
                )}
              </div>
              {business.taxNumber && (
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Tax Reg: {business.taxNumber}
                </p>
              )}
            </div>
          </div>

          <div className="text-right ml-auto">
            <div
              className={`${compact ? 'text-xl' : 'text-3xl'} font-bold tracking-tight`}
              style={{ color: isMinimal ? '#0F172A' : accent }}
            >
              {invoice.title || 'INVOICE'}
            </div>
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex items-center justify-end gap-2">
                <span className="text-slate-500">Invoice #</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {invoice.invoiceNumber || 'INV-001'}
                </span>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className="text-slate-500">Issue Date</span>
                <span className="font-medium text-slate-800 tabular-nums">
                  {formatDisplayDate(invoice.issueDate, dateFormat)}
                </span>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className="text-slate-500">Due Date</span>
                <span className="font-medium text-slate-800 tabular-nums">
                  {formatDisplayDate(invoice.dueDate, dateFormat)}
                </span>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Bill To & Summary Info */}
      <section className="mb-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <div
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: isMinimal ? '#64748B' : accent }}
          >
            Billed To
          </div>
          <div className="mt-1.5 text-sm font-semibold text-slate-900">
            {customer.name || 'Client Name'}
          </div>
          {customer.company && (
            <div className="text-xs font-medium text-slate-700">{customer.company}</div>
          )}
          <div className="mt-1 whitespace-pre-line text-xs text-slate-600">
            {customer.address || 'Client billing address'}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {[customer.email, customer.phone].filter(Boolean).join(' · ')}
          </div>
        </div>

        <div className="sm:text-right flex flex-col sm:items-end justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Amount Due ({invoice.currency})
            </div>
            <div
              className={`${compact ? 'text-xl' : 'text-2xl'} mt-1 font-mono font-bold tabular-nums`}
              style={{ color: isMinimal ? '#0F172A' : accent }}
            >
              {formatCurrency(totals.grandTotal, invoice.currency)}
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Status:{' '}
            <span className="font-semibold capitalize text-slate-800">{invoice.status}</span>
          </div>
        </div>
      </section>

      {/* Items Table */}
      <section className="mb-7 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr
              className={
                isClassic
                  ? 'border-y border-slate-300 bg-slate-100/80 text-slate-700'
                  : isMinimal
                    ? 'border-b border-slate-200 text-slate-500'
                    : 'text-white'
              }
              style={!isClassic && !isMinimal ? { backgroundColor: accent } : undefined}
            >
              <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider">
                Description
              </th>
              <th className="py-2.5 px-3 text-right text-[11px] font-semibold uppercase tracking-wider">
                Qty
              </th>
              <th className="py-2.5 px-3 text-right text-[11px] font-semibold uppercase tracking-wider">
                Unit Price
              </th>
              {hasAnyItemDiscount && (
                <th className="py-2.5 px-3 text-right text-[11px] font-semibold uppercase tracking-wider">
                  Disc
                </th>
              )}
              <th className="py-2.5 px-3 text-right text-[11px] font-semibold uppercase tracking-wider">
                Tax
              </th>
              <th className="py-2.5 px-3 text-right text-[11px] font-semibold uppercase tracking-wider">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {invoice.items.length === 0 ? (
              <tr>
                <td colSpan={hasAnyItemDiscount ? 6 : 5} className="py-6 text-center text-xs text-slate-400">
                  No line items added yet.
                </td>
              </tr>
            ) : (
              invoice.items.map((item, idx) => {
                const line = calculateLineItem(
                  item,
                  invoice.currency,
                  invoice.invoiceTaxRate ?? 0,
                  invoice.taxTreatment ?? 'after_discount'
                );
                const effTax = resolveEffectiveTaxRate(item.taxRate, invoice.invoiceTaxRate ?? 0);
                return (
                  <tr
                    key={item.id}
                    className={!isMinimal && idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}
                  >
                    <td className="py-3 px-3 font-medium text-slate-800">
                      {item.description || 'Untitled Service / Item'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700 tabular-nums">
                      {item.quantity}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700 tabular-nums">
                      {formatCurrency(item.unitPrice, invoice.currency)}
                    </td>
                    {hasAnyItemDiscount && (
                      <td className="py-3 px-3 text-right font-mono text-emerald-700 tabular-nums">
                        {line.itemDiscountAmount > 0
                          ? item.discountType === 'fixed'
                            ? `-${formatCurrency(line.itemDiscountAmount, invoice.currency)}`
                            : `-${item.discountValue ?? 0}%`
                          : '—'}
                      </td>
                    )}
                    <td className="py-3 px-3 text-right font-mono text-slate-500 tabular-nums">
                      {effTax > 0 ? `${effTax}%` : '0%'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(line.lineTotal, invoice.currency)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {/* Financial Summary */}
      <section className="mb-8 flex justify-end">
        <div className="w-full max-w-xs space-y-2 border-t border-slate-200 pt-4 text-xs">
          {totals.itemDiscountTotal > 0 && (
            <div className="flex items-center justify-between text-slate-600">
              <span>Item Discounts</span>
              <span className="font-mono font-medium text-emerald-700 tabular-nums">
                -{formatCurrency(totals.itemDiscountTotal, invoice.currency)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="font-mono font-medium text-slate-900 tabular-nums">
              {formatCurrency(totals.subtotal, invoice.currency)}
            </span>
          </div>

          {totals.discountAmount > 0 && (
            <div className="flex items-center justify-between text-slate-600">
              <span>
                Invoice Discount
                {invoice.discountType === 'percent' ? ` (${invoice.discountValue}%)` : ''}
              </span>
              <span className="font-mono font-medium text-emerald-700 tabular-nums">
                -{formatCurrency(totals.discountAmount, invoice.currency)}
              </span>
            </div>
          )}

          {totals.taxBreakdown.length > 0 ? (
            totals.taxBreakdown.map((tb) => (
              <div key={tb.rate} className="flex items-center justify-between text-slate-600">
                <span>
                  {totals.taxTreatment === 'tax_inclusive'
                    ? `Included Tax (${tb.rate}%)`
                    : `Tax (${tb.rate}%)`}
                </span>
                <span className="font-mono font-medium text-slate-900 tabular-nums">
                  {formatCurrency(tb.taxAmount, invoice.currency)}
                </span>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-between text-slate-600">
              <span>Tax</span>
              <span className="font-mono font-medium text-slate-900 tabular-nums">
                {formatCurrency(totals.taxTotal, invoice.currency)}
              </span>
            </div>
          )}

          <div
            className="flex items-center justify-between border-t pt-2.5 text-sm font-bold text-slate-900"
            style={{ borderColor: isMinimal ? '#CBD5E1' : accent }}
          >
            <span>Grand Total</span>
            <span
              className="font-mono text-base tabular-nums"
              style={{ color: isMinimal ? '#0F172A' : accent }}
            >
              {formatCurrency(totals.grandTotal, invoice.currency)}
            </span>
          </div>
        </div>
      </section>

      {/* Accepted Payment Options & Direct Payment Link */}
      {(() => {
        const acceptedAccounts = resolveInvoicePaymentAccounts(invoice, paymentAccounts);
        if (acceptedAccounts.length === 0) return null;
        const hasOnlineCheckout = acceptedAccounts.some((a) => a.supportsOnlineCheckout);
        const directUrl =
          invoice.paymentLink ||
          buildDirectPaymentUrl(invoice.invoiceNumber || 'INV-001', undefined, invoice.shareToken);

        return (
          <section className="mb-7 border-t border-slate-200 pt-5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Accepted Payment Methods
              </div>
              {hasOnlineCheckout && (
                <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-700">
                  <Link2 className="h-3 w-3 shrink-0" />
                  <span className="font-mono truncate max-w-[300px]">{directUrl}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {acceptedAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center gap-2.5 rounded border border-slate-200/90 bg-slate-50/70 px-3 py-2"
                >
                  <span
                    className="flex h-6 w-8 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white"
                    style={{ backgroundColor: acc.accentHex }}
                  >
                    {acc.shortCode}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-800 truncate">{acc.providerName}</div>
                    <div className="font-mono text-[10px] text-slate-500 truncate">
                      {acc.accountIdentifier}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {/* Payment & Notes */}
      {(additional.paymentInstructions ||
        additional.bankDetails ||
        additional.notes ||
        additional.terms) && (
        <section className="mb-7 grid grid-cols-1 sm:grid-cols-2 gap-5 border-t border-slate-200 pt-5 text-xs">
          {(additional.paymentInstructions || additional.bankDetails) && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Payment Information
              </div>
              {additional.paymentInstructions && (
                <p className="text-slate-600">{additional.paymentInstructions}</p>
              )}
              {additional.bankDetails && (
                <pre className="whitespace-pre-wrap font-mono text-[11px] text-slate-700 bg-slate-50 border border-slate-200/80 rounded p-2.5">
                  {additional.bankDetails}
                </pre>
              )}
            </div>
          )}

          {(additional.notes || additional.terms) && (
            <div className="space-y-2">
              {additional.notes && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Notes
                  </div>
                  <p className="mt-1 text-slate-600">{additional.notes}</p>
                </div>
              )}
              {additional.terms && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Terms &amp; Conditions
                  </div>
                  <p className="mt-1 text-slate-500">{additional.terms}</p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Reserved lower breathing room when signatures/stamps sit in bottom area */}
      {visibleAuthElements.length > 0 && (
        <div className={`${compact ? 'h-28' : 'h-36'} w-full flex flex-col justify-start pt-1`} aria-hidden="true">
          {interactive && (
            <div className="no-print flex items-center gap-1.5 text-[10px] text-slate-400">
              <Move className="h-3 w-3 text-blue-700" />
              <span>
                Drag any signature or seal anywhere across the entire invoice sheet · Drag corner
                handle to resize
              </span>
            </div>
          )}
        </div>
      )}

      {/* Full-Page Free-Positioned Signature & Stamp Overlays */}
      {visibleAuthElements.map((el) => {
        const isSelected = interactive && activeSelectedId === el.id;
        const scaledW = compact ? Math.round(el.width * 0.72) : el.width;

        return (
          <div
            key={el.id}
            data-testid={`auth-overlay-${el.id}`}
            onPointerDown={(e) => startDrag(e, el)}
            onClick={(e) => {
              if (!interactive) return;
              e.stopPropagation();
              setSelected(el.id);
            }}
            style={{
              left: `${el.x}%`,
              top: `${el.y}%`,
              width: scaledW,
              zIndex: 10 + el.zIndex,
              transform: `rotate(${el.rotation}deg)`,
            }}
            className={`group absolute select-none ${
              interactive
                ? `cursor-grab active:cursor-grabbing rounded p-1 transition-shadow ${
                    isSelected
                      ? 'ring-2 ring-blue-600 bg-blue-50/30'
                      : 'hover:ring-1 hover:ring-blue-400'
                  }`
                : 'pointer-events-none'
            }`}
          >
            {el.kind === 'signature' ? (
              <div className="flex flex-col items-start">
                {el.dataUrl ? (
                  <img
                    src={el.dataUrl}
                    alt={el.label || 'Authorized Signature'}
                    draggable={false}
                    style={{ opacity: el.opacity }}
                    className="h-14 w-full object-contain object-left pointer-events-none"
                  />
                ) : (
                  <div className="flex h-12 w-full items-center justify-center rounded border border-dashed border-slate-300 text-[10px] text-slate-400">
                    No signature image
                  </div>
                )}
                <div className="mt-1 w-full border-t border-slate-300 pt-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  {el.label || 'Authorized Signature'}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                {el.dataUrl ? (
                  <img
                    src={el.dataUrl}
                    alt={el.label || 'Company Stamp'}
                    draggable={false}
                    style={{
                      width: scaledW,
                      height: scaledW,
                      opacity: el.opacity,
                    }}
                    className="object-contain pointer-events-none"
                  />
                ) : (
                  <div
                    style={{ width: scaledW, height: scaledW }}
                    className="flex items-center justify-center rounded-full border border-dashed border-slate-300 text-[10px] text-slate-400 text-center px-2"
                  >
                    No seal uploaded
                  </div>
                )}
                {el.label && (
                  <span className="mt-1 text-[9px] font-medium uppercase tracking-wider text-slate-400">
                    {el.label}
                  </span>
                )}
              </div>
            )}

            {interactive && (
              <button
                type="button"
                aria-label={`Resize ${el.label || el.kind}`}
                onPointerDown={(e) => startResize(e, el)}
                className="no-print absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded bg-blue-700 text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 cursor-nwse-resize"
              >
                <Maximize2 className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        );
      })}

      {/* Footer */}
      {design.footerStyle !== 'hidden' && (
        <footer className="border-t border-slate-200 pt-4 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>
            {additional.footerMessage ||
              `${business.name || 'Universal Invoice Generator'} · Thank you for your business.`}
          </span>
          {design.footerStyle === 'detailed' && (
            <span className="font-mono text-[10px] text-slate-400">{invoice.invoiceNumber}</span>
          )}
        </footer>
      )}
    </div>
  );
}
