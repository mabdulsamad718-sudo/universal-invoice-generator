import type {
  ConnectedPaymentAccount,
  CurrencyCode,
  Invoice,
  InvoiceItem,
  PaymentClaim,
  TaxTreatment,
} from '../src/types/invoice.ts';

const VALID_CURRENCIES = new Set<CurrencyCode>([
  'USD',
  'EUR',
  'GBP',
  'PKR',
  'AED',
  'CAD',
  'AUD',
  'SAR',
  'INR',
  'JPY',
]);

const VALID_TAX_TREATMENTS = new Set<TaxTreatment>([
  'after_discount',
  'before_discount',
  'tax_inclusive',
]);

const MAX_TEXT_LENGTH = 5000;
const MAX_ITEMS = 250;
const MAX_DATA_URL_BYTES = 1_500_000; // ~1.5 MB base64 string cap per embedded asset

export function sanitizeHeaderText(value: unknown, maxLen = 200): string {
  return String(value ?? '')
    .replace(/[\r\n\0]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function isValidEmail(email: string): boolean {
  const clean = (email || '').trim();
  if (!clean || clean.length > 254 || /[\r\n\0]/.test(clean)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
}

export function isValidIsoDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const maxD = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return d <= maxD;
}

export function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const ts = Date.parse(value);
  return Number.isFinite(ts);
}

export function isSafeImageDataUrl(value: unknown): boolean {
  if (!value) return true;
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.length > MAX_DATA_URL_BYTES) return false;
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return true;
  }
  // Allow clean local asset paths only
  if (/^\/assets\/[A-Za-z0-9_./-]+$/.test(trimmed)) {
    return true;
  }
  return false;
}

export function validateInvoicePayload(raw: unknown): { ok: true; invoice: Invoice } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Invoice payload must be an object.' };
  }
  const inv = raw as Partial<Invoice>;

  if (typeof inv.id !== 'string' || !inv.id.trim() || inv.id.length > 120) {
    return { ok: false, error: 'Invoice id is required and must be <= 120 chars.' };
  }
  if (
    typeof inv.invoiceNumber !== 'string' ||
    !inv.invoiceNumber.trim() ||
    inv.invoiceNumber.length > 80
  ) {
    return { ok: false, error: 'Invoice number is required and must be <= 80 chars.' };
  }
  if (!isValidIsoDateString(inv.issueDate) || !isValidIsoDateString(inv.dueDate)) {
    return { ok: false, error: 'Invoice issueDate and dueDate must be valid YYYY-MM-DD dates.' };
  }
  if (!inv.currency || !VALID_CURRENCIES.has(inv.currency)) {
    return { ok: false, error: 'Unsupported or missing currency code.' };
  }
  if (inv.taxTreatment && !VALID_TAX_TREATMENTS.has(inv.taxTreatment)) {
    return { ok: false, error: 'Invalid taxTreatment value.' };
  }
  if (
    inv.invoiceTaxRate !== undefined &&
    (!Number.isFinite(inv.invoiceTaxRate) || inv.invoiceTaxRate < 0 || inv.invoiceTaxRate > 100)
  ) {
    return { ok: false, error: 'invoiceTaxRate must be between 0 and 100.' };
  }
  if (!Array.isArray(inv.items) || inv.items.length === 0 || inv.items.length > MAX_ITEMS) {
    return { ok: false, error: `Invoice must contain between 1 and ${MAX_ITEMS} line items.` };
  }

  for (let i = 0; i < inv.items.length; i++) {
    const item = inv.items[i] as Partial<InvoiceItem>;
    if (!item || typeof item.description !== 'string' || item.description.length > MAX_TEXT_LENGTH) {
      return { ok: false, error: `Item #${i + 1} has invalid description.` };
    }
    if (!Number.isFinite(item.quantity) || (item.quantity as number) < 0) {
      return { ok: false, error: `Item #${i + 1} quantity must be >= 0.` };
    }
    if (!Number.isFinite(item.unitPrice) || (item.unitPrice as number) < 0) {
      return { ok: false, error: `Item #${i + 1} unitPrice must be >= 0.` };
    }
    if (
      item.taxRate !== undefined &&
      item.taxRate !== null &&
      (!Number.isFinite(item.taxRate) || item.taxRate < 0 || item.taxRate > 100)
    ) {
      return { ok: false, error: `Item #${i + 1} taxRate must be between 0 and 100.` };
    }
  }

  if (!inv.business || typeof inv.business.name !== 'string') {
    return { ok: false, error: 'Business profile details are required.' };
  }
  if (!inv.customer || typeof inv.customer.name !== 'string') {
    return { ok: false, error: 'Customer details are required.' };
  }

  if (!isSafeImageDataUrl(inv.business.logoDataUrl)) {
    return { ok: false, error: 'Business logo must be a PNG/JPEG/WEBP image under 1.5MB.' };
  }
  if (inv.signature?.dataUrl && !isSafeImageDataUrl(inv.signature.dataUrl)) {
    return { ok: false, error: 'Signature image must be a valid PNG/JPEG/WEBP asset under 1.5MB.' };
  }
  if (inv.stamp?.dataUrl && !isSafeImageDataUrl(inv.stamp.dataUrl)) {
    return { ok: false, error: 'Stamp image must be a valid PNG/JPEG/WEBP asset under 1.5MB.' };
  }

  if (inv.discountType !== 'percent' && inv.discountType !== 'fixed') {
    return { ok: false, error: 'Invalid discountType.' };
  }
  if (!Number.isFinite(inv.discountValue) || (inv.discountValue as number) < 0) {
    return { ok: false, error: 'discountValue must be >= 0.' };
  }

  return { ok: true, invoice: inv as Invoice };
}

export function validatePaymentAccountsPayload(raw: unknown): ConnectedPaymentAccount[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is ConnectedPaymentAccount => Boolean(item && typeof item === 'object' && typeof (item as ConnectedPaymentAccount).providerId === 'string'))
    .slice(0, 50)
    .map((acc) => ({
      ...acc,
      providerId: sanitizeHeaderText(acc.providerId, 60),
      providerName: sanitizeHeaderText(acc.providerName, 120),
      accountTitle: sanitizeHeaderText(acc.accountTitle, 160),
      accountIdentifier: sanitizeHeaderText(acc.accountIdentifier, 160),
      secondaryDetail: acc.secondaryDetail ? sanitizeHeaderText(acc.secondaryDetail, 160) : undefined,
    }));
}

export function validatePaymentClaimInput(raw: unknown): {
  ok: true;
  claim: Omit<PaymentClaim, 'id' | 'submittedAt' | 'status'>;
} | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Claim payload must be an object.' };
  }
  const body = raw as Record<string, unknown>;
  const payerName = sanitizeHeaderText(body.payerName, 120);
  const methodName = sanitizeHeaderText(body.methodName, 120);
  const reference = sanitizeHeaderText(body.reference, 160);
  const payerEmail = body.payerEmail ? sanitizeHeaderText(body.payerEmail, 254) : undefined;

  if (!payerName) {
    return { ok: false, error: 'Payer name is required to submit a remittance claim.' };
  }
  if (!methodName) {
    return { ok: false, error: 'Payment method name is required.' };
  }
  if (!reference || reference.length < 3) {
    return { ok: false, error: 'Transaction or transfer reference (min 3 characters) is required.' };
  }
  if (payerEmail && !isValidEmail(payerEmail)) {
    return { ok: false, error: 'Provided payer email is not valid.' };
  }

  return {
    ok: true,
    claim: {
      payerName,
      payerEmail,
      methodName,
      reference,
    },
  };
}
