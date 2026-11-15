import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ConnectedPaymentAccount,
  Invoice,
  PaymentAuditEntry,
  PaymentClaim,
  RecurringDeliveryLog,
  RecurringInvoiceSchedule,
  SavedBusinessProfile,
} from '../src/types/invoice.ts';
import { calculateInvoiceTotals } from '../src/utils/calculations.ts';

export interface SharedInvoiceRecord {
  /** SHA-256 hex digest of the share token — raw token is never persisted in store.json */
  tokenHash: string;
  invoiceId: string;
  invoiceNumber: string;
  invoice: Invoice; // sanitized public snapshot
  paymentAccounts: ConnectedPaymentAccount[];
  revoked: boolean;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  paymentTransactionId?: string;
  paymentVerificationMode?: 'manual' | 'gateway_webhook';
  paymentHistory: PaymentAuditEntry[];
  pendingClaims: PaymentClaim[];
}

export interface ServerStoreState {
  shares: Record<string, SharedInvoiceRecord>;
  tokenHashByInvoiceId: Record<string, string>;
  processedWebhookEvents: string[];
  deliveryLogs: RecurringDeliveryLog[];
  recurringSchedules: RecurringInvoiceSchedule[];
  businessProfile?: SavedBusinessProfile;
}

const EMPTY_STATE: ServerStoreState = {
  shares: {},
  tokenHashByInvoiceId: {},
  processedWebhookEvents: [],
  deliveryLogs: [],
  recurringSchedules: [],
};

let writeQueue: Promise<unknown> = Promise.resolve();

export function getStorePaths(customDataDir?: string) {
  const dataDir = path.resolve(process.cwd(), customDataDir || process.env.DATA_DIR || '.data');
  return {
    dataDir,
    storePath: path.join(dataDir, 'store.json'),
  };
}

function ensureDir(dataDir: string) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export function hashShareToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function withStoreLock<T>(fn: () => Promise<T> | T): Promise<T> {
  const next = writeQueue.then(() => fn(), () => fn());
  writeQueue = next.catch(() => undefined);
  return next;
}

export function readStore(customDataDir?: string): ServerStoreState {
  const { dataDir, storePath } = getStorePaths(customDataDir);
  ensureDir(dataDir);
  if (!fs.existsSync(storePath)) {
    return structuredClone(EMPTY_STATE);
  }
  try {
    const raw = fs.readFileSync(storePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ServerStoreState> & {
      tokenByInvoiceId?: Record<string, string>;
    };

    const migratedShares: Record<string, SharedInvoiceRecord> = {};
    const migratedIndex: Record<string, string> = {
      ...(parsed.tokenHashByInvoiceId ?? {}),
    };

    for (const [key, val] of Object.entries(parsed.shares ?? {})) {
      if (!val || typeof val !== 'object') continue;
      // Migrate legacy plaintext-keyed records transparently if any exist
      const rec = val as SharedInvoiceRecord & { token?: string };
      const tokenHash = rec.tokenHash || (key.length === 64 && /^[a-f0-9]+$/.test(key) ? key : hashShareToken(key));
      migratedShares[tokenHash] = {
        ...rec,
        tokenHash,
        paymentHistory: Array.isArray(rec.paymentHistory) ? rec.paymentHistory : [],
        pendingClaims: Array.isArray(rec.pendingClaims) ? rec.pendingClaims : [],
      };
      delete (migratedShares[tokenHash] as unknown as Record<string, unknown>).token;
      if (rec.invoiceId) {
        migratedIndex[rec.invoiceId] = tokenHash;
      }
    }

    return {
      shares: migratedShares,
      tokenHashByInvoiceId: migratedIndex,
      processedWebhookEvents: Array.isArray(parsed.processedWebhookEvents)
        ? parsed.processedWebhookEvents
        : [],
      deliveryLogs: Array.isArray(parsed.deliveryLogs) ? parsed.deliveryLogs : [],
      recurringSchedules: Array.isArray(parsed.recurringSchedules)
        ? parsed.recurringSchedules
        : [],
      businessProfile: parsed.businessProfile,
    };
  } catch (err) {
    // Quarantine corrupt JSON instead of silently losing evidence
    const backupPath = `${storePath}.corrupt-${Date.now()}.bak`;
    try {
      fs.copyFileSync(storePath, backupPath);
      console.error(
        `[STORE ERROR] Corrupt store.json backed up to ${backupPath}:`,
        err instanceof Error ? err.message : err
      );
    } catch {
      console.error('[STORE ERROR] Failed to read or backup corrupt store.json');
    }
    return structuredClone(EMPTY_STATE);
  }
}

export function writeStore(state: ServerStoreState, customDataDir?: string) {
  const { dataDir, storePath } = getStorePaths(customDataDir);
  ensureDir(dataDir);
  const tmpPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmpPath, storePath);
}

/**
 * Strips private creator fields (internalNotes, clientId, recurringScheduleId, deliveryError,
 * shareToken, and raw paymentLink) before persisting or serving an unauthenticated public share.
 */
export function sanitizeInvoiceForPublicShare(invoice: Invoice): Invoice {
  const clone = structuredClone(invoice);
  if (clone.additional && 'internalNotes' in clone.additional) {
    delete clone.additional.internalNotes;
  }
  delete clone.clientId;
  delete clone.recurringScheduleId;
  delete clone.deliveryError;
  delete clone.shareToken;
  delete clone.paymentLink;
  // Payment claims and audit history are owner-only data and must never be exposed publicly.
  delete clone.pendingClaims;
  delete clone.paymentHistory;
  return clone;
}

export function generateShareToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export async function createOrUpdateShare(
  invoice: Invoice,
  paymentAccounts: ConnectedPaymentAccount[],
  origin: string,
  expiresAt?: string,
  providedExistingToken?: string,
  customDataDir?: string
): Promise<{ token: string; shareUrl: string; record: SharedInvoiceRecord }> {
  return withStoreLock(() => {
    const store = readStore(customDataDir);
    const candidateRawToken = providedExistingToken || invoice.shareToken;
    const candidateHash = candidateRawToken ? hashShareToken(candidateRawToken) : undefined;
    const existingHashForInvoice = store.tokenHashByInvoiceId[invoice.id];

    let token: string;
    let tokenHash: string;
    if (
      candidateRawToken &&
      candidateHash &&
      store.shares[candidateHash] &&
      store.shares[candidateHash].invoiceId === invoice.id
    ) {
      token = candidateRawToken;
      tokenHash = candidateHash;
    } else {
      token = generateShareToken();
      tokenHash = hashShareToken(token);
      if (existingHashForInvoice && store.shares[existingHashForInvoice]) {
        // Retire old token hash if rotating
        delete store.shares[existingHashForInvoice];
      }
    }

    const cleanOrigin = origin.replace(/\/+$/, '');
    const shareUrl = `${cleanOrigin}/?share=${encodeURIComponent(token)}`;
    const sanitized = sanitizeInvoiceForPublicShare(invoice);
    sanitized.shareEnabled = true;
    sanitized.shareExpiresAt = expiresAt;

    const now = new Date().toISOString();
    const prev = store.shares[tokenHash];

    const record: SharedInvoiceRecord = {
      tokenHash,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoice: sanitized,
      paymentAccounts: paymentAccounts.filter((a) => a.connected),
      revoked: false,
      expiresAt: expiresAt || prev?.expiresAt,
      createdAt: prev?.createdAt || now,
      updatedAt: now,
      paidAt: prev?.paidAt || invoice.paidAt,
      paymentTransactionId: prev?.paymentTransactionId || invoice.paymentTransactionId,
      paymentVerificationMode: prev?.paymentVerificationMode || invoice.paymentVerificationMode,
      paymentHistory: prev?.paymentHistory || invoice.paymentHistory || [],
      pendingClaims: prev?.pendingClaims || invoice.pendingClaims || [],
    };

    if (prev?.paidAt) {
      record.invoice.status = 'paid';
      record.invoice.paidAt = prev.paidAt;
      record.invoice.paymentTransactionId = prev.paymentTransactionId;
      record.invoice.paymentVerificationMode = prev.paymentVerificationMode;
    }

    store.shares[tokenHash] = record;
    store.tokenHashByInvoiceId[invoice.id] = tokenHash;
    writeStore(store, customDataDir);

    return { token, shareUrl, record };
  });
}

export function getPublicShareByToken(
  token: string,
  customDataDir?: string
): {
  record?: SharedInvoiceRecord;
  errorStatus?: 404 | 410;
  errorMessage?: string;
} {
  if (!token || token.length < 8) {
    return { errorStatus: 404, errorMessage: 'Shared invoice link not found.' };
  }
  const store = readStore(customDataDir);
  const tokenHash = hashShareToken(token);
  const record = store.shares[tokenHash];
  if (!record) {
    return { errorStatus: 404, errorMessage: 'Shared invoice link not found.' };
  }
  if (record.revoked) {
    return {
      errorStatus: 410,
      errorMessage: 'This invoice share link has been revoked by the sender.',
    };
  }
  if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
    return {
      errorStatus: 410,
      errorMessage: 'This invoice share link has expired.',
    };
  }
  return {
    record: {
      ...record,
      invoice: sanitizeInvoiceForPublicShare(record.invoice),
      // Keep payer submissions and payment audit details private to the owner.
      paymentHistory: [],
      pendingClaims: [],
    },
  };
}

export async function updateShareSettings(
  tokenOrInvoiceId: string,
  patch: { revoked?: boolean; expiresAt?: string | null },
  customDataDir?: string
): Promise<SharedInvoiceRecord | null> {
  return withStoreLock(() => {
    const store = readStore(customDataDir);
    const byTokenHash = store.shares[hashShareToken(tokenOrInvoiceId)];
    const byInvoiceHash = store.tokenHashByInvoiceId[tokenOrInvoiceId]
      ? store.shares[store.tokenHashByInvoiceId[tokenOrInvoiceId]]
      : undefined;
    const existing = byTokenHash || byInvoiceHash;
    if (!existing) return null;

    if (typeof patch.revoked === 'boolean') {
      existing.revoked = patch.revoked;
      existing.invoice.shareEnabled = !patch.revoked;
    }
    if (patch.expiresAt !== undefined) {
      existing.expiresAt = patch.expiresAt || undefined;
      existing.invoice.shareExpiresAt = existing.expiresAt;
    }
    existing.updatedAt = new Date().toISOString();
    store.shares[existing.tokenHash] = existing;
    writeStore(store, customDataDir);
    return existing;
  });
}

function findTargetHash(store: ServerStoreState, invoiceIdOrNumberOrToken: string): string | undefined {
  const tokenHash = hashShareToken(invoiceIdOrNumberOrToken);
  if (store.shares[tokenHash]) return tokenHash;
  if (store.tokenHashByInvoiceId[invoiceIdOrNumberOrToken]) {
    const mapped = store.tokenHashByInvoiceId[invoiceIdOrNumberOrToken];
    if (store.shares[mapped]) return mapped;
  }
  const lower = invoiceIdOrNumberOrToken.trim().toLowerCase();
  const match = Object.values(store.shares).find(
    (s) => s.invoiceNumber.toLowerCase() === lower || s.invoiceId.toLowerCase() === lower
  );
  return match?.tokenHash;
}

export async function submitPaymentClaim(
  token: string,
  claimInput: Omit<PaymentClaim, 'id' | 'submittedAt' | 'status'>,
  customDataDir?: string
): Promise<{
  ok: boolean;
  errorStatus?: 404 | 409 | 410;
  errorMessage?: string;
  claim?: PaymentClaim;
  record?: SharedInvoiceRecord;
}> {
  return withStoreLock(() => {
    const store = readStore(customDataDir);
    const tokenHash = hashShareToken(token);
    const record = store.shares[tokenHash];
    if (!record) {
      return { ok: false, errorStatus: 404, errorMessage: 'Shared invoice link not found.' };
    }
    if (record.revoked) {
      return { ok: false, errorStatus: 410, errorMessage: 'This invoice share link has been revoked.' };
    }
    if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
      return { ok: false, errorStatus: 410, errorMessage: 'This invoice share link has expired.' };
    }
    if (record.invoice.status === 'paid') {
      return { ok: false, errorStatus: 409, errorMessage: 'This invoice is already marked as paid.' };
    }
    if (record.invoice.status === 'cancelled') {
      return { ok: false, errorStatus: 409, errorMessage: 'Cancelled invoices cannot accept payment claims.' };
    }

    const now = new Date().toISOString();
    const claim: PaymentClaim = {
      id: `claim-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      ...claimInput,
      submittedAt: now,
      status: 'pending_verification',
    };

    const auditEntry: PaymentAuditEntry = {
      id: `audit-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      action: 'claim_submitted',
      actor: claimInput.payerName,
      verificationMode: 'client_claim',
      reference: claimInput.reference,
      timestamp: now,
      note: `Payer submitted ${claimInput.methodName} remittance claim (pending owner verification).`,
    };

    record.pendingClaims = [claim, ...(record.pendingClaims || [])].slice(0, 20);
    record.paymentHistory = [auditEntry, ...(record.paymentHistory || [])].slice(0, 50);
    record.invoice.pendingClaims = record.pendingClaims;
    record.invoice.paymentHistory = record.paymentHistory;
    record.updatedAt = now;

    store.shares[tokenHash] = record;
    writeStore(store, customDataDir);
    return { ok: true, claim, record };
  });
}

export async function markInvoicePaidFromWebhook(
  invoiceIdOrNumberOrToken: string,
  eventId: string,
  transactionId: string,
  verification?: {
    providerId?: string;
    expectedCurrency?: string;
    amountPaidMinor?: number;
    expectedAmountMinorFn?: (invoice: Invoice) => number;
  },
  customDataDir?: string
): Promise<{
  ok: boolean;
  duplicate?: boolean;
  statusCode?: number;
  record?: SharedInvoiceRecord;
  reason?: string;
}> {
  return withStoreLock(() => {
    const store = readStore(customDataDir);
    if (store.processedWebhookEvents.includes(eventId)) {
      return { ok: true, duplicate: true };
    }

    const targetHash = findTargetHash(store, invoiceIdOrNumberOrToken);
    if (!targetHash || !store.shares[targetHash]) {
      return { ok: false, statusCode: 404, reason: 'Matching shared invoice record not found.' };
    }

    const record = store.shares[targetHash];
    if (record.invoice.status === 'cancelled') {
      return {
        ok: false,
        statusCode: 409,
        reason: 'Cannot settle a cancelled invoice via webhook.',
      };
    }

    if (verification?.expectedCurrency) {
      if (record.invoice.currency.toUpperCase() !== verification.expectedCurrency.toUpperCase()) {
        return {
          ok: false,
          statusCode: 422,
          reason: `Webhook currency mismatch (${verification.expectedCurrency} vs ${record.invoice.currency}).`,
        };
      }
    }

    if (typeof verification?.amountPaidMinor === 'number' && verification.expectedAmountMinorFn) {
      const expectedMinor = verification.expectedAmountMinorFn(record.invoice);
      if (verification.amountPaidMinor < expectedMinor) {
        return {
          ok: false,
          statusCode: 422,
          reason: `Webhook paid amount (${verification.amountPaidMinor}) is less than invoice total (${expectedMinor}).`,
        };
      }
    }

    const totals = calculateInvoiceTotals(
      record.invoice.items,
      record.invoice.discountType,
      record.invoice.discountValue,
      {
        currency: record.invoice.currency,
        taxTreatment: record.invoice.taxTreatment ?? 'after_discount',
        invoiceTaxRate: record.invoice.invoiceTaxRate ?? 0,
      }
    );

    const now = new Date().toISOString();
    record.invoice.status = 'paid';
    record.invoice.paidAt = now;
    record.invoice.paymentTransactionId = transactionId;
    record.invoice.paymentVerificationMode = 'gateway_webhook';
    record.paidAt = now;
    record.paymentTransactionId = transactionId;
    record.paymentVerificationMode = 'gateway_webhook';
    record.updatedAt = now;

    const auditEntry: PaymentAuditEntry = {
      id: `audit-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      action: 'gateway_webhook_paid',
      actor: verification?.providerId ? `${verification.providerId}_webhook` : 'gateway_webhook',
      verificationMode: 'gateway_webhook',
      reference: transactionId,
      timestamp: now,
      amount: totals.grandTotal,
      currency: record.invoice.currency,
      note: `Verified webhook event ${eventId}`,
    };
    record.paymentHistory = [auditEntry, ...(record.paymentHistory || [])].slice(0, 50);
    record.invoice.paymentHistory = record.paymentHistory;

    store.processedWebhookEvents.push(eventId);
    if (store.processedWebhookEvents.length > 500) {
      store.processedWebhookEvents = store.processedWebhookEvents.slice(-500);
    }
    store.shares[targetHash] = record;
    writeStore(store, customDataDir);

    return { ok: true, record };
  });
}

export async function markInvoiceManualPayment(
  invoiceIdOrToken: string,
  reference?: string,
  actor = 'workspace_owner',
  customDataDir?: string
): Promise<{
  ok: boolean;
  errorStatus?: 404 | 409;
  errorMessage?: string;
  record?: SharedInvoiceRecord;
}> {
  return withStoreLock(() => {
    const store = readStore(customDataDir);
    const targetHash = findTargetHash(store, invoiceIdOrToken);
    if (!targetHash || !store.shares[targetHash]) {
      return {
        ok: false,
        errorStatus: 404,
        errorMessage: 'Invoice share record not found on server.',
      };
    }

    const record = store.shares[targetHash];
    if (record.invoice.status === 'cancelled') {
      return {
        ok: false,
        errorStatus: 409,
        errorMessage: 'Cancelled invoices cannot be marked paid.',
      };
    }
    if (record.invoice.status === 'paid') {
      return {
        ok: false,
        errorStatus: 409,
        errorMessage: 'Invoice is already marked paid.',
      };
    }

    const now = new Date().toISOString();
    const cleanRef = (reference || '').trim() || `MANUAL-${Date.now()}`;
    const totals = calculateInvoiceTotals(
      record.invoice.items,
      record.invoice.discountType,
      record.invoice.discountValue,
      {
        currency: record.invoice.currency,
        taxTreatment: record.invoice.taxTreatment ?? 'after_discount',
        invoiceTaxRate: record.invoice.invoiceTaxRate ?? 0,
      }
    );

    record.invoice.status = 'paid';
    record.invoice.paidAt = now;
    record.invoice.paymentTransactionId = cleanRef;
    record.invoice.paymentVerificationMode = 'manual';
    record.paidAt = now;
    record.paymentTransactionId = cleanRef;
    record.paymentVerificationMode = 'manual';
    record.updatedAt = now;

    if (Array.isArray(record.pendingClaims)) {
      record.pendingClaims = record.pendingClaims.map((c) =>
        c.status === 'pending_verification' ? { ...c, status: 'confirmed' as const } : c
      );
      record.invoice.pendingClaims = record.pendingClaims;
    }

    const auditEntry: PaymentAuditEntry = {
      id: `audit-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      action: 'manual_confirmed',
      actor,
      verificationMode: 'manual',
      reference: cleanRef,
      timestamp: now,
      amount: totals.grandTotal,
      currency: record.invoice.currency,
      note: 'Manually reconciled and confirmed by workspace owner.',
    };
    record.paymentHistory = [auditEntry, ...(record.paymentHistory || [])].slice(0, 50);
    record.invoice.paymentHistory = record.paymentHistory;

    store.shares[targetHash] = record;
    writeStore(store, customDataDir);
    return { ok: true, record };
  });
}

export async function appendDeliveryLog(log: RecurringDeliveryLog, customDataDir?: string) {
  return withStoreLock(() => {
    const store = readStore(customDataDir);
    store.deliveryLogs.unshift(log);
    store.deliveryLogs = store.deliveryLogs.slice(0, 200);
    writeStore(store, customDataDir);
  });
}
