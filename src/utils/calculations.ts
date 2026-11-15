import type {
  CurrencyCode,
  DateFormatOption,
  Invoice,
  InvoiceItem,
  InvoiceNumberConfig,
  TaxTreatment,
} from '../types/invoice';

export interface LineItemTotals {
  lineBaseSubtotal: number;
  itemDiscountAmount: number;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
}

export interface TaxBreakdownEntry {
  rate: number;
  taxableAmount: number;
  taxAmount: number;
}

export interface InvoiceTotals {
  subtotal: number;
  itemDiscountTotal: number;
  discountAmount: number;
  totalDiscountAmount: number;
  netTaxableAmount: number;
  taxTotal: number;
  taxBreakdown: TaxBreakdownEntry[];
  grandTotal: number;
  taxTreatment: TaxTreatment;
}

export interface CalculationOptions {
  currency?: CurrencyCode;
  taxTreatment?: TaxTreatment;
  invoiceTaxRate?: number;
}

export interface DashboardMetrics {
  totalCount: number;
  paidCount: number;
  unpaidCount: number;
  draftCount: number;
  overdueCount: number;
  sentCount: number;
}

export interface MonthlyActivityPoint {
  monthKey: string;
  label: string;
  count: number;
  paidCount: number;
}

const CURRENCY_META: Record<
  CurrencyCode,
  { locale: string; symbol: string; pdfPrefix: string; decimals: number }
> = {
  USD: { locale: 'en-US', symbol: '$', pdfPrefix: '$', decimals: 2 },
  EUR: { locale: 'en-IE', symbol: '€', pdfPrefix: 'EUR ', decimals: 2 },
  GBP: { locale: 'en-GB', symbol: '£', pdfPrefix: 'GBP ', decimals: 2 },
  PKR: { locale: 'en-PK', symbol: 'Rs ', pdfPrefix: 'PKR ', decimals: 0 },
  AED: { locale: 'en-AE', symbol: 'AED ', pdfPrefix: 'AED ', decimals: 2 },
  CAD: { locale: 'en-CA', symbol: 'CA$', pdfPrefix: 'CAD ', decimals: 2 },
  AUD: { locale: 'en-AU', symbol: 'A$', pdfPrefix: 'AUD ', decimals: 2 },
  SAR: { locale: 'en-SA', symbol: 'SAR ', pdfPrefix: 'SAR ', decimals: 2 },
  INR: { locale: 'en-IN', symbol: '₹', pdfPrefix: 'INR ', decimals: 2 },
  JPY: { locale: 'ja-JP', symbol: '¥', pdfPrefix: 'JPY ', decimals: 0 },
};

export function getCurrencyDecimals(currency: CurrencyCode = 'USD'): number {
  return CURRENCY_META[currency]?.decimals ?? 2;
}

export function getCurrencyFactor(currency: CurrencyCode = 'USD'): number {
  return Math.pow(10, getCurrencyDecimals(currency));
}

export function toMinorUnits(amount: number, currency: CurrencyCode = 'USD'): number {
  if (!Number.isFinite(amount)) return 0;
  const factor = getCurrencyFactor(currency);
  const sign = amount < 0 ? -1 : 1;
  const scaled = Number((Math.abs(amount) * factor).toPrecision(15));
  return sign * Math.round(scaled);
}

export function fromMinorUnits(minorUnits: number, currency: CurrencyCode = 'USD'): number {
  if (!Number.isFinite(minorUnits)) return 0;
  const decimals = getCurrencyDecimals(currency);
  const factor = getCurrencyFactor(currency);
  const val = minorUnits / factor;
  return Number(val.toFixed(decimals));
}

export function roundCurrency(value: number, currency: CurrencyCode = 'USD'): number {
  if (!Number.isFinite(value)) return 0;
  return fromMinorUnits(toMinorUnits(value, currency), currency);
}

export function sanitizePositiveNumber(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

/**
 * Resolves the effective tax rate for a line item:
 * - If itemTaxRate is undefined or null, inherit invoiceTaxRate.
 * - If itemTaxRate is explicitly provided (including 0 for zero-rated/exempt items), preserve it.
 */
export function resolveEffectiveTaxRate(
  itemTaxRate: number | undefined | null,
  invoiceTaxRate = 0
): number {
  if (itemTaxRate === undefined || itemTaxRate === null) {
    return Math.min(100, sanitizePositiveNumber(invoiceTaxRate));
  }
  return Math.min(100, sanitizePositiveNumber(itemTaxRate));
}

export function validateInvoiceMathInput(
  items: Pick<
    InvoiceItem,
    'description' | 'quantity' | 'unitPrice' | 'taxRate' | 'discountType' | 'discountValue'
  >[],
  discountType: 'percent' | 'fixed',
  discountValue: number,
  invoiceTaxRate = 0
): string[] {
  const warnings: string[] = [];
  if (!Number.isFinite(discountValue) || discountValue < 0) {
    warnings.push('Invoice discount cannot be negative.');
  }
  if (discountType === 'percent' && discountValue > 100) {
    warnings.push('Percentage discount cannot exceed 100% and has been clamped.');
  }
  if (!Number.isFinite(invoiceTaxRate) || invoiceTaxRate < 0 || invoiceTaxRate > 100) {
    warnings.push('Invoice tax rate must be between 0% and 100%.');
  }

  items.forEach((item, index) => {
    const label = item.description.trim() || `Item #${index + 1}`;
    if (!Number.isFinite(item.quantity) || item.quantity < 0) {
      warnings.push(`${label}: quantity cannot be negative.`);
    }
    if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
      warnings.push(`${label}: unit price cannot be negative.`);
    }
    if (
      item.taxRate !== undefined &&
      item.taxRate !== null &&
      (!Number.isFinite(item.taxRate) || item.taxRate < 0 || item.taxRate > 100)
    ) {
      warnings.push(`${label}: tax rate must be between 0% and 100%.`);
    }
    if (item.discountValue !== undefined) {
      if (!Number.isFinite(item.discountValue) || item.discountValue < 0) {
        warnings.push(`${label}: item discount cannot be negative.`);
      } else if ((item.discountType ?? 'percent') === 'percent' && item.discountValue > 100) {
        warnings.push(`${label}: item discount % cannot exceed 100%.`);
      }
    }
  });

  return warnings;
}

function computeLineItemMinor(
  item: Pick<InvoiceItem, 'quantity' | 'unitPrice' | 'taxRate' | 'discountType' | 'discountValue'>,
  currency: CurrencyCode,
  invoiceTaxRate = 0
) {
  const qty = sanitizePositiveNumber(item.quantity);
  const price = sanitizePositiveNumber(item.unitPrice);
  const factor = getCurrencyFactor(currency);

  const lineBaseMinor = Math.round(Number((qty * price * factor).toPrecision(15)));

  const rawItemDisc = sanitizePositiveNumber(item.discountValue ?? 0);
  const itemDiscType = item.discountType ?? 'percent';
  let itemDiscountMinor = 0;
  if (rawItemDisc > 0) {
    if (itemDiscType === 'percent') {
      const pct = Math.min(100, rawItemDisc);
      itemDiscountMinor = Math.round(Number(((lineBaseMinor * pct) / 100).toPrecision(15)));
    } else {
      const fixedMinor = toMinorUnits(rawItemDisc, currency);
      itemDiscountMinor = Math.min(lineBaseMinor, fixedMinor);
    }
  }

  const lineNetMinor = Math.max(0, lineBaseMinor - itemDiscountMinor);
  const effectiveTaxRate = resolveEffectiveTaxRate(item.taxRate, invoiceTaxRate);
  const lineTaxMinor = Math.round(
    Number(((lineNetMinor * effectiveTaxRate) / 100).toPrecision(15))
  );

  return {
    lineBaseMinor,
    itemDiscountMinor,
    lineNetMinor,
    effectiveTaxRate,
    lineTaxMinor,
  };
}

export function calculateLineItem(
  item: Pick<InvoiceItem, 'quantity' | 'unitPrice' | 'taxRate' | 'discountType' | 'discountValue'>,
  currency: CurrencyCode = 'USD',
  invoiceTaxRate = 0,
  taxTreatment: TaxTreatment = 'after_discount'
): LineItemTotals {
  const m = computeLineItemMinor(item, currency, invoiceTaxRate);
  let taxMinor = m.lineTaxMinor;
  let totalMinor = m.lineNetMinor + m.lineTaxMinor;

  if (taxTreatment === 'tax_inclusive' && m.effectiveTaxRate > 0) {
    const netMinor = Math.round(
      Number((m.lineNetMinor / (1 + m.effectiveTaxRate / 100)).toPrecision(15))
    );
    taxMinor = Math.max(0, m.lineNetMinor - netMinor);
    totalMinor = m.lineNetMinor;
  }

  return {
    lineBaseSubtotal: fromMinorUnits(m.lineBaseMinor, currency),
    itemDiscountAmount: fromMinorUnits(m.itemDiscountMinor, currency),
    lineSubtotal: fromMinorUnits(m.lineNetMinor, currency),
    lineTax: fromMinorUnits(taxMinor, currency),
    lineTotal: fromMinorUnits(totalMinor, currency),
  };
}

export function calculateInvoiceTotals(
  items: Pick<InvoiceItem, 'quantity' | 'unitPrice' | 'taxRate' | 'discountType' | 'discountValue'>[],
  discountType: 'percent' | 'fixed',
  discountValue: number,
  options: CalculationOptions = {}
): InvoiceTotals {
  const currency = options.currency ?? 'USD';
  const taxTreatment: TaxTreatment = options.taxTreatment ?? 'after_discount';
  const invoiceTaxRate = Math.min(100, sanitizePositiveNumber(options.invoiceTaxRate ?? 0));

  const computedLines = items.map((item) => computeLineItemMinor(item, currency, invoiceTaxRate));

  let subtotalMinor = 0;
  let itemDiscountTotalMinor = 0;
  for (const line of computedLines) {
    subtotalMinor += line.lineNetMinor;
    itemDiscountTotalMinor += line.itemDiscountMinor;
  }

  const safeDiscount = sanitizePositiveNumber(discountValue);
  let invoiceDiscountMinor = 0;
  if (subtotalMinor > 0 && safeDiscount > 0) {
    if (discountType === 'percent') {
      const pct = Math.min(100, safeDiscount);
      invoiceDiscountMinor = Math.round(Number(((subtotalMinor * pct) / 100).toPrecision(15)));
    } else {
      invoiceDiscountMinor = Math.min(subtotalMinor, toMinorUnits(safeDiscount, currency));
    }
  }

  const discountedSubtotalMinor = Math.max(0, subtotalMinor - invoiceDiscountMinor);

  const lineAfterInvoiceDiscountMinor: number[] = new Array(computedLines.length).fill(0);
  if (subtotalMinor > 0 && computedLines.length > 0) {
    let allocatedDiscountSum = 0;
    const remainders: { index: number; rem: number; net: number }[] = [];

    for (let i = 0; i < computedLines.length; i++) {
      const lineNet = computedLines[i].lineNetMinor;
      const exactShare = (lineNet * invoiceDiscountMinor) / subtotalMinor;
      const floorShare = Math.floor(exactShare);
      lineAfterInvoiceDiscountMinor[i] = floorShare;
      allocatedDiscountSum += floorShare;
      remainders.push({ index: i, rem: exactShare - floorShare, net: lineNet });
    }

    let remainingDiscount = invoiceDiscountMinor - allocatedDiscountSum;
    remainders.sort((a, b) => b.rem - a.rem || b.net - a.net);
    for (let j = 0; j < remainders.length && remainingDiscount > 0; j++) {
      const idx = remainders[j].index;
      if (lineAfterInvoiceDiscountMinor[idx] < computedLines[idx].lineNetMinor) {
        lineAfterInvoiceDiscountMinor[idx] += 1;
        remainingDiscount -= 1;
      }
    }

    for (let i = 0; i < computedLines.length; i++) {
      lineAfterInvoiceDiscountMinor[i] = Math.max(
        0,
        computedLines[i].lineNetMinor - lineAfterInvoiceDiscountMinor[i]
      );
    }
  }

  const breakdownMap = new Map<number, { taxableMinor: number; taxMinor: number }>();
  let taxTotalMinor = 0;
  let netTaxableMinor = 0;

  for (let i = 0; i < computedLines.length; i++) {
    const line = computedLines[i];
    const rate = line.effectiveTaxRate;

    if (taxTreatment === 'before_discount') {
      const baseMinor = line.lineNetMinor;
      const taxMinor = Math.round(Number(((baseMinor * rate) / 100).toPrecision(15)));
      taxTotalMinor += taxMinor;
      netTaxableMinor += baseMinor;
      if (rate > 0) {
        const entry = breakdownMap.get(rate) ?? { taxableMinor: 0, taxMinor: 0 };
        entry.taxableMinor += baseMinor;
        entry.taxMinor += taxMinor;
        breakdownMap.set(rate, entry);
      }
    } else if (taxTreatment === 'tax_inclusive') {
      const grossMinor = lineAfterInvoiceDiscountMinor[i];
      const netMinor =
        rate > 0
          ? Math.round(Number((grossMinor / (1 + rate / 100)).toPrecision(15)))
          : grossMinor;
      const taxMinor = Math.max(0, grossMinor - netMinor);
      taxTotalMinor += taxMinor;
      netTaxableMinor += netMinor;
      if (rate > 0) {
        const entry = breakdownMap.get(rate) ?? { taxableMinor: 0, taxMinor: 0 };
        entry.taxableMinor += netMinor;
        entry.taxMinor += taxMinor;
        breakdownMap.set(rate, entry);
      }
    } else {
      const baseMinor = lineAfterInvoiceDiscountMinor[i];
      const taxMinor = Math.round(Number(((baseMinor * rate) / 100).toPrecision(15)));
      taxTotalMinor += taxMinor;
      netTaxableMinor += baseMinor;
      if (rate > 0) {
        const entry = breakdownMap.get(rate) ?? { taxableMinor: 0, taxMinor: 0 };
        entry.taxableMinor += baseMinor;
        entry.taxMinor += taxMinor;
        breakdownMap.set(rate, entry);
      }
    }
  }

  const grandTotalMinor =
    taxTreatment === 'tax_inclusive'
      ? discountedSubtotalMinor
      : Math.max(0, discountedSubtotalMinor + taxTotalMinor);

  const taxBreakdown: TaxBreakdownEntry[] = Array.from(breakdownMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rate, val]) => ({
      rate,
      taxableAmount: fromMinorUnits(val.taxableMinor, currency),
      taxAmount: fromMinorUnits(val.taxMinor, currency),
    }));

  return {
    subtotal: fromMinorUnits(subtotalMinor, currency),
    itemDiscountTotal: fromMinorUnits(itemDiscountTotalMinor, currency),
    discountAmount: fromMinorUnits(invoiceDiscountMinor, currency),
    totalDiscountAmount: fromMinorUnits(itemDiscountTotalMinor + invoiceDiscountMinor, currency),
    netTaxableAmount: fromMinorUnits(netTaxableMinor, currency),
    taxTotal: fromMinorUnits(taxTotalMinor, currency),
    taxBreakdown,
    grandTotal: fromMinorUnits(grandTotalMinor, currency),
    taxTreatment,
  };
}

export function formatCurrency(amount: number, currency: CurrencyCode = 'USD'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const meta = CURRENCY_META[currency] ?? CURRENCY_META.USD;
  try {
    return new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: meta.decimals,
      maximumFractionDigits: meta.decimals,
    }).format(safe);
  } catch {
    return `${meta.symbol}${safe.toFixed(meta.decimals)}`;
  }
}

/**
 * Formats currency with WinAnsi-safe ASCII prefixes for standard jsPDF built-in fonts
 * (prevents garbled glyphs for ₹ / ¥ / € in Helvetica/Times/Courier).
 */
export function formatCurrencyForPdf(amount: number, currency: CurrencyCode = 'USD'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const meta = CURRENCY_META[currency] ?? CURRENCY_META.USD;
  const formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  }).format(Math.abs(safe));
  const prefix = meta.pdfPrefix;
  return safe < 0 ? `-${prefix}${formattedNumber}` : `${prefix}${formattedNumber}`;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDisplayDate(isoDate: string, format: DateFormatOption = 'DD MMM YYYY'): string {
  if (!isoDate) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return isoDate;
  const [, year, month, day] = match;
  const mIdx = Number(month) - 1;
  if (mIdx < 0 || mIdx > 11) return isoDate;

  if (format === 'YYYY-MM-DD') {
    return `${year}-${month}-${day}`;
  }
  if (format === 'MM/DD/YYYY') {
    return `${month}/${day}/${year}`;
  }
  return `${Number(day)} ${MONTHS_SHORT[mIdx]} ${year}`;
}

export const DEFAULT_NUMBERING_CONFIG: InvoiceNumberConfig = {
  prefix: 'INV-',
  resetYearly: true,
  padLength: 3,
};

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function suggestNextInvoiceNumber(
  existingInvoices: Pick<Invoice, 'invoiceNumber'>[],
  year = new Date().getFullYear(),
  config: Partial<InvoiceNumberConfig> = {}
): string {
  const prefix = (config.prefix ?? DEFAULT_NUMBERING_CONFIG.prefix).trim() || 'INV-';
  const normalizedPrefix = prefix.endsWith('-') ? prefix : `${prefix}-`;
  const resetYearly = config.resetYearly ?? DEFAULT_NUMBERING_CONFIG.resetYearly;
  const padLength = Math.max(2, Math.min(8, config.padLength ?? DEFAULT_NUMBERING_CONFIG.padLength));

  const targetStem = resetYearly ? `${normalizedPrefix}${year}-` : normalizedPrefix;
  const matcher = new RegExp(`^${escapeRegExp(targetStem)}(\\d+)$`, 'i');
  const existingSet = new Set(existingInvoices.map((i) => i.invoiceNumber.trim().toUpperCase()));

  let maxSeq = 0;
  for (const inv of existingInvoices) {
    const clean = inv.invoiceNumber.trim();
    const match = matcher.exec(clean);
    if (match) {
      const num = Number.parseInt(match[1], 10);
      if (Number.isFinite(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  let candidateSeq = maxSeq + 1;
  let candidate = `${targetStem}${String(candidateSeq).padStart(padLength, '0')}`;
  while (existingSet.has(candidate.toUpperCase())) {
    candidateSeq += 1;
    candidate = `${targetStem}${String(candidateSeq).padStart(padLength, '0')}`;
  }

  return candidate;
}

export function computeDashboardMetrics(invoices: Pick<Invoice, 'status'>[]): DashboardMetrics {
  let paidCount = 0;
  let unpaidCount = 0;
  let draftCount = 0;
  let overdueCount = 0;
  let sentCount = 0;

  for (const inv of invoices) {
    if (inv.status === 'paid') paidCount += 1;
    else if (inv.status === 'draft') draftCount += 1;
    else if (inv.status === 'overdue') {
      overdueCount += 1;
      unpaidCount += 1;
    } else if (inv.status === 'sent') {
      sentCount += 1;
      unpaidCount += 1;
    } else if (inv.status === 'unpaid') {
      unpaidCount += 1;
    }
  }

  return {
    totalCount: invoices.length,
    paidCount,
    unpaidCount,
    draftCount,
    overdueCount,
    sentCount,
  };
}

export function computeMonthlyActivity(
  invoices: Pick<Invoice, 'issueDate' | 'status'>[]
): MonthlyActivityPoint[] {
  const map = new Map<string, MonthlyActivityPoint>();

  for (const inv of invoices) {
    const match = /^(\d{4})-(\d{2})/.exec(inv.issueDate);
    if (!match) continue;
    const [, year, month] = match;
    const key = `${year}-${month}`;
    const mIdx = Number(month) - 1;
    const label = `${MONTHS_SHORT[mIdx] ?? month} '${year.slice(2)}`;
    const current = map.get(key) ?? { monthKey: key, label, count: 0, paidCount: 0 };
    current.count += 1;
    if (inv.status === 'paid') {
      current.paidCount += 1;
    }
    map.set(key, current);
  }

  return Array.from(map.values())
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .slice(-6);
}
