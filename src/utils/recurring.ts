import type {
  ConnectedPaymentAccount,
  Invoice,
  InvoiceNumberConfig,
  RecurringDeliveryStatus,
  RecurringFrequency,
  RecurringInvoiceSchedule,
  RecurringStatus,
  SavedBusinessProfile,
} from '../types/invoice';
import { suggestNextInvoiceNumber } from './calculations';

export function parseIsoDate(iso: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || '').trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const maxD = daysInMonth(year, month);
  if (day > maxD) return null;
  return { year, month, day };
}

function toIsoDate(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addDaysIso(isoDate: string, days: number): string {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return isoDate;
  const dt = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return dt.toISOString().slice(0, 10);
}

function addMonthsIso(
  year: number,
  month: number,
  targetDay: number,
  monthsToAdd: number
): string {
  const totalMonths = year * 12 + (month - 1) + monthsToAdd;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  const maxDay = daysInMonth(nextYear, nextMonth);
  return toIsoDate(nextYear, nextMonth, Math.min(targetDay, maxDay));
}

/**
 * Advances a recurring run date while optionally preserving the original `anchorDay`
 * from schedule.startDate so month-end dates (e.g., 31st) recover after short months (Feb 28 -> Mar 31).
 */
export function advanceRecurringDate(
  isoDate: string,
  frequency: RecurringFrequency,
  anchorDay?: number
): string {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return isoDate;

  const preferredDay =
    anchorDay && anchorDay >= 1 && anchorDay <= 31 ? anchorDay : parsed.day;

  if (frequency === 'daily') {
    return addDaysIso(isoDate, 1);
  }
  if (frequency === 'weekly') {
    return addDaysIso(isoDate, 7);
  }
  if (frequency === 'monthly') {
    return addMonthsIso(parsed.year, parsed.month, preferredDay, 1);
  }
  if (frequency === 'quarterly') {
    return addMonthsIso(parsed.year, parsed.month, preferredDay, 3);
  }

  const nextYear = parsed.year + 1;
  const maxDay = daysInMonth(nextYear, parsed.month);
  return toIsoDate(nextYear, parsed.month, Math.min(preferredDay, maxDay));
}

export function buildDirectPaymentUrl(
  invoiceIdOrNumber: string,
  origin?: string,
  shareToken?: string
): string {
  const cleanOrigin = (origin || '').replace(/\/+$/, '');
  if (shareToken) {
    return cleanOrigin
      ? `${cleanOrigin}/?share=${encodeURIComponent(shareToken)}`
      : `/?share=${encodeURIComponent(shareToken)}`;
  }
  return cleanOrigin
    ? `${cleanOrigin}/?pay=${encodeURIComponent(invoiceIdOrNumber)}`
    : `/?pay=${encodeURIComponent(invoiceIdOrNumber)}`;
}

export function createInvoiceFromSchedule(
  schedule: RecurringInvoiceSchedule,
  issueDate: string,
  businessProfile: SavedBusinessProfile,
  existingInvoices: Pick<Invoice, 'invoiceNumber'>[],
  origin?: string,
  numberingConfig?: Partial<InvoiceNumberConfig>
): Invoice {
  const issueYear = Number(issueDate.slice(0, 4)) || new Date().getFullYear();
  const invoiceNumber = suggestNextInvoiceNumber(existingInvoices, issueYear, numberingConfig);
  const dueDate = addDaysIso(issueDate, Math.max(0, schedule.dueDaysAfterIssue ?? 14));
  const id = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // Honesty rule: generated recurring invoices are NEVER marked 'sent' until an email transport actually accepts them.
  const deliveryStatus: RecurringDeliveryStatus = schedule.autoSend ? 'queued' : 'generated';

  return {
    id,
    invoiceNumber,
    title: schedule.templateSnapshot.title || 'INVOICE',
    issueDate,
    dueDate,
    currency: schedule.templateSnapshot.currency,
    status: schedule.autoSend ? 'unpaid' : 'draft',
    deliveryStatus,
    deliveryError: schedule.autoSend
      ? 'Queued for SMTP email dispatch. Configure SMTP credentials or trigger backend queue.'
      : undefined,
    clientId: schedule.templateSnapshot.clientId,
    business: {
      name: businessProfile.name,
      logoDataUrl: businessProfile.logoDataUrl,
      address: businessProfile.address,
      phone: businessProfile.phone,
      email: businessProfile.email,
      website: businessProfile.website,
      taxNumber: businessProfile.taxNumber,
    },
    customer: { ...schedule.templateSnapshot.customer },
    items: schedule.templateSnapshot.items.map((item) => ({
      ...item,
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    })),
    discountType: schedule.templateSnapshot.discountType,
    discountValue: schedule.templateSnapshot.discountValue,
    taxTreatment: schedule.templateSnapshot.taxTreatment ?? 'after_discount',
    invoiceTaxRate: schedule.templateSnapshot.invoiceTaxRate ?? 0,
    additional: { ...schedule.templateSnapshot.additional },
    design: { ...schedule.templateSnapshot.design },
    signature: {
      enabled: Boolean(businessProfile.savedSignatureDataUrl),
      dataUrl: businessProfile.savedSignatureDataUrl || '',
      label: businessProfile.savedSignatureLabel || 'Authorized Signature',
      x: 8,
      y: 79,
      width: 152,
      rotation: 0,
    },
    stamp: {
      enabled: Boolean(businessProfile.savedStampDataUrl),
      dataUrl: businessProfile.savedStampDataUrl || '',
      label: businessProfile.savedStampLabel || 'Company Stamp',
      x: 72,
      y: 77,
      size: 94,
      opacity: 0.85,
      rotation: 0,
    },
    enabledPaymentIds: [...schedule.templateSnapshot.enabledPaymentIds],
    paymentLink: buildDirectPaymentUrl(invoiceNumber, origin),
    recurringScheduleId: schedule.id,
    updatedAt: new Date().toISOString(),
  };
}

export function processDueRecurringSchedules(
  schedules: RecurringInvoiceSchedule[],
  existingInvoices: Invoice[],
  businessProfile: SavedBusinessProfile,
  todayIso: string,
  maxPerSchedule = 6,
  origin?: string,
  numberingConfig?: Partial<InvoiceNumberConfig>
): {
  updatedSchedules: RecurringInvoiceSchedule[];
  generatedInvoices: Invoice[];
} {
  const generatedInvoices: Invoice[] = [];
  const runningInvoices = [...existingInvoices];

  const updatedSchedules = schedules.map((schedule) => {
    if (schedule.status !== 'active') return schedule;

    const anchorDay = parseIsoDate(schedule.startDate)?.day;
    let currentRun = schedule.nextRunDate;
    let countAdded = 0;
    let lastGen = schedule.lastGeneratedDate;
    let nextStatus: RecurringStatus = schedule.status;
    let lastDeliveryStatus = schedule.lastDeliveryStatus;

    while (
      currentRun &&
      currentRun <= todayIso &&
      countAdded < maxPerSchedule &&
      (!schedule.endDate || currentRun <= schedule.endDate)
    ) {
      const alreadyExists = runningInvoices.some(
        (inv) => inv.recurringScheduleId === schedule.id && inv.issueDate === currentRun
      );

      if (!alreadyExists) {
        const created = createInvoiceFromSchedule(
          schedule,
          currentRun,
          businessProfile,
          runningInvoices,
          origin,
          numberingConfig
        );
        generatedInvoices.push(created);
        runningInvoices.unshift(created);
        lastGen = currentRun;
        lastDeliveryStatus = created.deliveryStatus;
        countAdded += 1;
      }

      const upcoming = advanceRecurringDate(currentRun, schedule.frequency, anchorDay);
      if (schedule.endDate && upcoming > schedule.endDate) {
        currentRun = upcoming;
        nextStatus = 'completed';
        break;
      }
      currentRun = upcoming;
    }

    if (schedule.endDate && currentRun > schedule.endDate && nextStatus === 'active') {
      nextStatus = 'completed';
    }

    if (
      countAdded === 0 &&
      nextStatus === schedule.status &&
      currentRun === schedule.nextRunDate
    ) {
      return schedule;
    }

    return {
      ...schedule,
      nextRunDate: currentRun,
      lastGeneratedDate: lastGen,
      lastDeliveryStatus,
      generatedCount: schedule.generatedCount + countAdded,
      status: nextStatus,
    };
  });

  return {
    updatedSchedules,
    generatedInvoices,
  };
}

export function resolveInvoicePaymentAccounts(
  invoice: Pick<Invoice, 'enabledPaymentIds'>,
  allAccounts: ConnectedPaymentAccount[]
): ConnectedPaymentAccount[] {
  const connected = allAccounts.filter((acc) => acc.connected);
  if (!invoice.enabledPaymentIds) {
    return connected.filter((acc) => acc.enabledByDefault);
  }
  const allowed = new Set(invoice.enabledPaymentIds);
  return connected.filter((acc) => allowed.has(acc.id));
}
