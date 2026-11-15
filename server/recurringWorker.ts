import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import type {
  Invoice,
  RecurringDeliveryLog,
  RecurringDeliveryStatus,
  SavedBusinessProfile,
} from '../src/types/invoice.ts';
import { calculateInvoiceTotals, formatCurrency } from '../src/utils/calculations.ts';
import { processDueRecurringSchedules } from '../src/utils/recurring.ts';
import { appendDeliveryLog, createOrUpdateShare, readStore, withStoreLock, writeStore } from './store.ts';
import { isValidEmail, sanitizeHeaderText } from './validation.ts';

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
}

function sanitizeTransportError(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'SMTP transport error during dispatch.';
  return msg.replace(/(pass(word)?|secret|token|auth)\s*[:=]\s*\S+/gi, '$1=[REDACTED]').slice(0, 240);
}

export async function dispatchInvoiceEmail(
  invoice: Invoice,
  recipientEmail: string,
  origin: string,
  maxAttempts = 2
): Promise<{ status: RecurringDeliveryStatus; detail: string; attempts: number }> {
  const cleanEmail = sanitizeHeaderText(recipientEmail, 254);
  if (!isValidEmail(cleanEmail)) {
    return {
      status: 'failed',
      detail: 'Recipient email address is missing or invalid.',
      attempts: 0,
    };
  }

  if (!isSmtpConfigured()) {
    return {
      status: 'setup_required',
      detail:
        'SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) are not configured. Invoice remains queued locally.',
      attempts: 0,
    };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

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

  const safeInvoiceNumber = sanitizeHeaderText(invoice.invoiceNumber, 80);
  const safeBusinessName = sanitizeHeaderText(invoice.business.name, 120) || 'Billing Team';
  const safeCustomerName = sanitizeHeaderText(invoice.customer.name, 120) || 'Customer';
  const shareUrl = invoice.paymentLink || `${origin.replace(/\/+$/, '')}/?pay=${encodeURIComponent(safeInvoiceNumber)}`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const info = await transporter.sendMail({
        from: sanitizeHeaderText(process.env.SMTP_FROM || process.env.SMTP_USER, 254),
        to: cleanEmail,
        subject: `Invoice ${safeInvoiceNumber} from ${safeBusinessName}`,
        text: [
          `Hello ${safeCustomerName},`,
          '',
          `Please find invoice ${safeInvoiceNumber} for ${formatCurrency(
            totals.grandTotal,
            invoice.currency
          )} due on ${invoice.dueDate}.`,
          `View & settle online: ${shareUrl}`,
          '',
          'Regards,',
          safeBusinessName,
        ].join('\n'),
      });

      const acceptedList = Array.isArray(info.accepted) ? info.accepted : [];
      if (acceptedList.length > 0) {
        return {
          status: 'accepted_by_smtp',
          detail: `Accepted by SMTP relay (${process.env.SMTP_HOST}) for ${cleanEmail} (Message-ID: ${info.messageId || 'n/a'}). Inbox delivery is not independently verified without bounce/webhook telemetry.`,
          attempts: attempt,
        };
      }

      return {
        status: 'delivery_confirmation_unavailable',
        detail: `SMTP relay responded without explicit accepted recipient confirmation for ${cleanEmail}.`,
        attempts: attempt,
      };
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  }

  return {
    status: 'failed',
    detail: sanitizeTransportError(lastError),
    attempts: maxAttempts,
  };
}

export async function runDueRecurringPass(
  origin: string,
  customDataDir?: string
): Promise<{
  processedCount: number;
  dispatchedCount: number;
  generatedInvoices: Invoice[];
  logs: RecurringDeliveryLog[];
}> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const snapshot = readStore(customDataDir);
  if (!snapshot.recurringSchedules.length || !snapshot.businessProfile) {
    return { processedCount: 0, dispatchedCount: 0, generatedInvoices: [], logs: [] };
  }

  const businessProfile: SavedBusinessProfile = snapshot.businessProfile;
  const existingPseudoInvoices: Invoice[] = Object.values(snapshot.shares).map((s) => s.invoice);

  const { updatedSchedules, generatedInvoices } = processDueRecurringSchedules(
    snapshot.recurringSchedules,
    existingPseudoInvoices,
    businessProfile,
    todayIso,
    6,
    origin
  );

  if (generatedInvoices.length === 0) {
    return { processedCount: 0, dispatchedCount: 0, generatedInvoices: [], logs: [] };
  }

  await withStoreLock(() => {
    const store = readStore(customDataDir);
    store.recurringSchedules = updatedSchedules;
    writeStore(store, customDataDir);
  });

  const logs: RecurringDeliveryLog[] = [];
  let dispatchedCount = 0;

  for (const inv of generatedInvoices) {
    // Persist share snapshot so recipient link works cross-device immediately
    const createdShare = await createOrUpdateShare(inv, [], origin, undefined, undefined, customDataDir);
    inv.paymentLink = createdShare.shareUrl;

    const schedule = updatedSchedules.find((s) => s.id === inv.recurringScheduleId);
    if (schedule?.autoSend) {
      const result = await dispatchInvoiceEmail(inv, inv.customer.email, origin);
      if (result.status === 'accepted_by_smtp') {
        dispatchedCount += 1;
      }
      const log: RecurringDeliveryLog = {
        id: `dlog-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        scheduleId: inv.recurringScheduleId || 'worker',
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        scheduledDate: inv.issueDate,
        dispatchedAt: new Date().toISOString(),
        status: result.status,
        detail: result.detail,
        recipientEmail: inv.customer.email || undefined,
        attempts: result.attempts,
      };
      await appendDeliveryLog(log, customDataDir);
      logs.push(log);
    }
  }

  return {
    processedCount: generatedInvoices.length,
    dispatchedCount,
    generatedInvoices,
    logs,
  };
}
