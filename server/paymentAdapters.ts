import crypto from 'node:crypto';
import type {
  CurrencyCode,
  Invoice,
  PaymentConnectionStatus,
  PaymentProviderServerStatus,
} from '../src/types/invoice.ts';
import { calculateInvoiceTotals, toMinorUnits } from '../src/utils/calculations.ts';

export interface ProviderAdapterConfig {
  providerId: string;
  name: string;
  requiredEnvVars: string[];
  webhookSupported: boolean;
  checkoutSupported: boolean;
  setupSummary: string;
  evaluate: (hasLocalIdentifier: boolean) => {
    status: PaymentConnectionStatus;
    mode: PaymentProviderServerStatus['mode'];
    configuredEnvVars: string[];
    checkoutSupported: boolean;
    errorDetail?: string;
  };
}

interface VerificationCacheEntry {
  status: PaymentConnectionStatus;
  mode: PaymentProviderServerStatus['mode'];
  checkedAt: string;
  errorDetail?: string;
}

const verificationCache = new Map<string, VerificationCacheEntry>();

function presentVars(names: string[]): string[] {
  return names.filter((n) => Boolean(process.env[n] && String(process.env[n]).trim()));
}

function getPayPalApiBase(): string {
  return (process.env.PAYPAL_ENV || '').toLowerCase() === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

const ADAPTER_REGISTRY: Record<string, ProviderAdapterConfig> = {
  stripe: {
    providerId: 'stripe',
    name: 'Stripe',
    requiredEnvVars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    webhookSupported: true,
    checkoutSupported: true,
    setupSummary:
      'Set STRIPE_SECRET_KEY (sk_test_... or sk_live_...) and STRIPE_WEBHOOK_SECRET (whsec_...) in server environment variables. Point Stripe webhooks to /api/webhooks/payments/stripe.',
    evaluate: () => {
      const configured = presentVars(['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']);
      const sk = (process.env.STRIPE_SECRET_KEY || '').trim();
      const wh = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
      if (!sk || !wh) {
        return {
          status: 'not_configured',
          mode: 'unconfigured',
          configuredEnvVars: configured,
          checkoutSupported: false,
          errorDetail:
            'Both STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must be set on the server for live Checkout & webhook verification.',
        };
      }
      if (!/^sk_(test|live)_/.test(sk) || !/^whsec_/.test(wh)) {
        return {
          status: 'unavailable',
          mode: 'unconfigured',
          configuredEnvVars: configured,
          checkoutSupported: false,
          errorDetail:
            'Stripe credentials format invalid (expected sk_test_/sk_live_ and whsec_ prefixes).',
        };
      }
      const mode = sk.startsWith('sk_live_') ? 'live_api' : 'sandbox_api';
      const cached = verificationCache.get('stripe');
      if (cached) {
        return {
          status: cached.status,
          mode: cached.mode,
          configuredEnvVars: configured,
          checkoutSupported: cached.status === 'verified' || cached.status === 'credentials_configured',
          errorDetail: cached.errorDetail,
        };
      }
      return {
        status: 'credentials_configured',
        mode,
        configuredEnvVars: configured,
        checkoutSupported: true,
        errorDetail: 'Credentials formatted; click Verify Live Connection to test Stripe /v1/balance.',
      };
    },
  },
  paypal: {
    providerId: 'paypal',
    name: 'PayPal',
    requiredEnvVars: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'],
    webhookSupported: true,
    checkoutSupported: false,
    setupSummary:
      'Set PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, and PAYPAL_WEBHOOK_ID in server environment variables. Register /api/webhooks/payments/paypal in the PayPal Developer Dashboard.',
    evaluate: () => {
      const configured = presentVars([
        'PAYPAL_CLIENT_ID',
        'PAYPAL_CLIENT_SECRET',
        'PAYPAL_WEBHOOK_ID',
      ]);
      const cid = (process.env.PAYPAL_CLIENT_ID || '').trim();
      const sec = (process.env.PAYPAL_CLIENT_SECRET || '').trim();
      const whId = (process.env.PAYPAL_WEBHOOK_ID || '').trim();
      if (!cid || !sec) {
        return {
          status: 'not_configured',
          mode: 'unconfigured',
          configuredEnvVars: configured,
          checkoutSupported: false,
          errorDetail: 'Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET on server.',
        };
      }
      if (cid.length < 12 || sec.length < 12) {
        return {
          status: 'unavailable',
          mode: 'unconfigured',
          configuredEnvVars: configured,
          checkoutSupported: false,
          errorDetail: 'PayPal OAuth credentials appear malformed.',
        };
      }
      const mode = (process.env.PAYPAL_ENV || '').toLowerCase() === 'live' ? 'live_api' : 'sandbox_api';
      const cached = verificationCache.get('paypal');
      if (cached) {
        return {
          status: cached.status,
          mode: cached.mode,
          configuredEnvVars: configured,
          checkoutSupported: false,
          errorDetail: cached.errorDetail,
        };
      }
      return {
        status: whId ? 'credentials_configured' : 'verification_pending',
        mode,
        configuredEnvVars: configured,
        checkoutSupported: false,
        errorDetail: whId
          ? 'PayPal OAuth & Webhook ID present; run Verify Live Connection to test OAuth token exchange.'
          : 'PAYPAL_WEBHOOK_ID missing — webhook signature verification requires a registered Webhook ID.',
      };
    },
  },
};

export function getProviderServerStatus(
  providerId: string,
  hasLocalIdentifier = false,
  baseUrl = ''
): PaymentProviderServerStatus {
  const cleanOrigin = baseUrl.replace(/\/+$/, '');
  const webhookEndpoint = `${cleanOrigin}/api/webhooks/payments/${encodeURIComponent(providerId)}`;
  const now = new Date().toISOString();

  const adapter = ADAPTER_REGISTRY[providerId];
  if (adapter) {
    const result = adapter.evaluate(hasLocalIdentifier);
    return {
      providerId,
      status: result.status,
      mode: result.mode,
      webhookSupported: adapter.webhookSupported,
      checkoutSupported: result.checkoutSupported,
      requiredEnvVars: adapter.requiredEnvVars,
      configuredEnvVars: result.configuredEnvVars,
      setupSummary: adapter.setupSummary,
      webhookEndpoint,
      lastCheckedAt: verificationCache.get(providerId)?.checkedAt || now,
      errorDetail: result.errorDetail,
    };
  }

  return {
    providerId,
    status: 'not_configured',
    mode: hasLocalIdentifier ? 'manual_instructions' : 'unconfigured',
    webhookSupported: false,
    checkoutSupported: false,
    requiredEnvVars: [],
    configuredEnvVars: [],
    setupSummary:
      'Bank transfers & IBAN/Raast wallets display verified remittance instructions to recipients. Payers can submit a transaction reference claim for owner manual confirmation.',
    webhookEndpoint,
    lastCheckedAt: now,
    errorDetail: hasLocalIdentifier
      ? 'Manual settlement instructions active — automated bank feed/webhook not connected.'
      : undefined,
  };
}

export async function verifyProviderLiveConnection(
  providerId: string,
  hasLocalIdentifier = false,
  baseUrl = ''
): Promise<PaymentProviderServerStatus> {
  const now = new Date().toISOString();

  if (providerId === 'stripe') {
    const sk = (process.env.STRIPE_SECRET_KEY || '').trim();
    const wh = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
    if (!sk || !wh) {
      verificationCache.delete('stripe');
      return getProviderServerStatus(providerId, hasLocalIdentifier, baseUrl);
    }
    try {
      const resp = await fetch('https://api.stripe.com/v1/balance', {
        method: 'GET',
        headers: { Authorization: `Bearer ${sk}` },
        signal: AbortSignal.timeout(8000),
      });
      const mode = sk.startsWith('sk_live_') ? 'live_api' : 'sandbox_api';
      if (resp.ok) {
        verificationCache.set('stripe', {
          status: 'verified',
          mode,
          checkedAt: now,
        });
      } else {
        verificationCache.set('stripe', {
          status: 'unavailable',
          mode,
          checkedAt: now,
          errorDetail: `Stripe API responded HTTP ${resp.status} during live balance probe.`,
        });
      }
    } catch (err) {
      verificationCache.set('stripe', {
        status: 'unavailable',
        mode: sk.startsWith('sk_live_') ? 'live_api' : 'sandbox_api',
        checkedAt: now,
        errorDetail: `Stripe API probe failed: ${err instanceof Error ? err.message : 'network error'}`,
      });
    }
  } else if (providerId === 'paypal') {
    const cid = (process.env.PAYPAL_CLIENT_ID || '').trim();
    const sec = (process.env.PAYPAL_CLIENT_SECRET || '').trim();
    if (!cid || !sec) {
      verificationCache.delete('paypal');
      return getProviderServerStatus(providerId, hasLocalIdentifier, baseUrl);
    }
    const mode = (process.env.PAYPAL_ENV || '').toLowerCase() === 'live' ? 'live_api' : 'sandbox_api';
    try {
      const auth = Buffer.from(`${cid}:${sec}`).toString('base64');
      const resp = await fetch(`${getPayPalApiBase()}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(8000),
      });
      if (resp.ok) {
        const hasWh = Boolean((process.env.PAYPAL_WEBHOOK_ID || '').trim());
        verificationCache.set('paypal', {
          status: hasWh ? 'verified' : 'verification_pending',
          mode,
          checkedAt: now,
          errorDetail: hasWh
            ? undefined
            : 'OAuth token verified, but PAYPAL_WEBHOOK_ID is still required for webhook verification.',
        });
      } else {
        verificationCache.set('paypal', {
          status: 'unavailable',
          mode,
          checkedAt: now,
          errorDetail: `PayPal OAuth probe returned HTTP ${resp.status}.`,
        });
      }
    } catch (err) {
      verificationCache.set('paypal', {
        status: 'unavailable',
        mode,
        checkedAt: now,
        errorDetail: `PayPal OAuth probe failed: ${err instanceof Error ? err.message : 'network error'}`,
      });
    }
  }

  return getProviderServerStatus(providerId, hasLocalIdentifier, baseUrl);
}

export function listAllProviderStatuses(
  knownProviderIds: string[],
  localAccountProviderIds: string[],
  baseUrl = ''
): Record<string, PaymentProviderServerStatus> {
  const localSet = new Set(localAccountProviderIds);
  const allIds = Array.from(new Set([...Object.keys(ADAPTER_REGISTRY), ...knownProviderIds]));
  const result: Record<string, PaymentProviderServerStatus> = {};
  for (const pid of allIds) {
    result[pid] = getProviderServerStatus(pid, localSet.has(pid), baseUrl);
  }
  return result;
}

export async function createStripeCheckoutSession(params: {
  invoice: Invoice;
  invoiceRef: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ ok: true; url: string; sessionId: string } | { ok: false; status: number; error: string }> {
  const sk = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!sk || !/^sk_(test|live)_/.test(sk)) {
    return {
      ok: false,
      status: 503,
      error: 'Stripe checkout is not configured on the server (missing STRIPE_SECRET_KEY).',
    };
  }

  const { invoice, invoiceRef, successUrl, cancelUrl } = params;
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
  const amountMinor = toMinorUnits(totals.grandTotal, invoice.currency);
  if (amountMinor <= 0) {
    return { ok: false, status: 400, error: 'Invoice total must be greater than zero for Stripe Checkout.' };
  }

  const body = new URLSearchParams();
  body.set('mode', 'payment');
  body.set('success_url', successUrl);
  body.set('cancel_url', cancelUrl);
  body.set('client_reference_id', invoice.id);
  body.set('metadata[invoiceId]', invoice.id);
  body.set('metadata[invoiceNumber]', invoice.invoiceNumber);
  body.set('metadata[invoiceRef]', invoiceRef);
  body.set('line_items[0][price_data][currency]', invoice.currency.toLowerCase());
  body.set('line_items[0][price_data][unit_amount]', String(amountMinor));
  body.set(
    'line_items[0][price_data][product_data][name]',
    `Invoice ${invoice.invoiceNumber} — ${invoice.business.name}`
  );
  body.set('line_items[0][quantity]', '1');
  if (invoice.customer.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoice.customer.email)) {
    body.set('customer_email', invoice.customer.email.trim());
  }

  try {
    const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sk}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(10000),
    });

    const data = (await resp.json()) as { id?: string; url?: string; error?: { message?: string } };
    if (!resp.ok || !data.url || !data.id) {
      return {
        ok: false,
        status: resp.status >= 400 ? resp.status : 502,
        error: data.error?.message || 'Stripe rejected Checkout Session creation.',
      };
    }

    return { ok: true, url: data.url, sessionId: data.id };
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: `Failed to reach Stripe API: ${err instanceof Error ? err.message : 'network error'}`,
    };
  }
}

export function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  toleranceSeconds = 300
): { valid: boolean; reason?: string } {
  const secret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    return { valid: false, reason: 'STRIPE_WEBHOOK_SECRET is not configured on server.' };
  }
  if (!signatureHeader) {
    return { valid: false, reason: 'Missing Stripe-Signature header.' };
  }

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const eqIdx = kv.indexOf('=');
      if (eqIdx <= 0) return [kv.trim(), ''];
      return [kv.slice(0, eqIdx).trim(), kv.slice(eqIdx + 1).trim()];
    })
  );

  const timestampSec = Number(parts.t);
  const v1Sig = parts.v1;
  if (!Number.isFinite(timestampSec) || !v1Sig) {
    return { valid: false, reason: 'Invalid Stripe-Signature header format.' };
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampSec);
  if (ageSeconds > toleranceSeconds) {
    return {
      valid: false,
      reason: `Stripe webhook timestamp outside ${toleranceSeconds}s replay window.`,
    };
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${parts.t}.${rawBody}`)
    .digest('hex');

  const valid =
    expected.length === v1Sig.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1Sig));
  return valid ? { valid: true } : { valid: false, reason: 'Stripe signature mismatch.' };
}



export async function verifyPayPalWebhookSignature(
  headers: Record<string, string | string[] | undefined>,
  webhookEvent: unknown
): Promise<{ valid: boolean; reason?: string }> {
  const cid = (process.env.PAYPAL_CLIENT_ID || '').trim();
  const sec = (process.env.PAYPAL_CLIENT_SECRET || '').trim();
  const webhookId = (process.env.PAYPAL_WEBHOOK_ID || '').trim();
  if (!cid || !sec || !webhookId) {
    return {
      valid: false,
      reason: 'PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, and PAYPAL_WEBHOOK_ID must be configured for PayPal webhook verification.',
    };
  }

  const transmissionId = String(headers['paypal-transmission-id'] || '');
  const transmissionTime = String(headers['paypal-transmission-time'] || '');
  const certUrl = String(headers['paypal-cert-url'] || '');
  const authAlgo = String(headers['paypal-auth-algo'] || '');
  const transmissionSig = String(headers['paypal-transmission-sig'] || '');

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    return { valid: false, reason: 'Missing required PayPal transmission signature headers.' };
  }

  try {
    const base = getPayPalApiBase();
    const auth = Buffer.from(`${cid}:${sec}`).toString('base64');
    const tokenResp = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(8000),
    });
    if (!tokenResp.ok) {
      return { valid: false, reason: `PayPal OAuth token exchange failed (${tokenResp.status}).` };
    }
    const tokenJson = (await tokenResp.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      return { valid: false, reason: 'PayPal OAuth response missing access_token.' };
    }

    const verifyResp = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: webhookEvent,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!verifyResp.ok) {
      return { valid: false, reason: `PayPal signature verification API returned ${verifyResp.status}.` };
    }
    const verifyJson = (await verifyResp.json()) as { verification_status?: string };
    if (verifyJson.verification_status === 'SUCCESS') {
      return { valid: true };
    }
    return {
      valid: false,
      reason: `PayPal webhook verification returned status: ${verifyJson.verification_status || 'FAILURE'}.`,
    };
  } catch (err) {
    return {
      valid: false,
      reason: `PayPal verification network failure: ${err instanceof Error ? err.message : 'unknown error'}`,
    };
  }
}

export async function verifyWebhookForProvider(params: {
  providerId: string;
  rawBody: string;
  body: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
}): Promise<{ valid: boolean; reason?: string; statusCode?: number }> {
  const { providerId, rawBody, body, headers } = params;

  if (providerId === 'stripe') {
    const sigHeader = headers['stripe-signature'] as string | undefined;
    const res = verifyStripeWebhookSignature(rawBody, sigHeader);
    return { ...res, statusCode: res.valid ? 200 : 401 };
  }

  if (providerId === 'paypal') {
    const res = await verifyPayPalWebhookSignature(headers, body);
    return { ...res, statusCode: res.valid ? 200 : 401 };
  }


  return {
    valid: false,
    statusCode: 501,
    reason: `Automated webhook settlement is not implemented for provider "${providerId}". Use manual remittance verification.`,
  };
}

export function extractStripeSettlementDetails(payload: Record<string, unknown>): {
  supportedEvent: boolean;
  paid: boolean;
  eventId: string;
  invoiceRef: string;
  txId: string;
  amountPaidMinor?: number;
  currency?: CurrencyCode;
  reason?: string;
} {
  const eventType = String(payload.type || '');
  const eventId = String(payload.id || '');
  const dataObj = ((payload.data as Record<string, unknown> | undefined)?.object ||
    {}) as Record<string, unknown>;
  const metadata = (dataObj.metadata || {}) as Record<string, unknown>;
  const invoiceRef = String(
    metadata.invoiceRef || metadata.invoiceNumber || metadata.invoiceId || payload.invoiceRef || ''
  ).trim();
  const txId = String(dataObj.payment_intent || dataObj.id || eventId);

  if (!eventType || (eventType !== 'checkout.session.completed' && eventType !== 'payment_intent.succeeded')) {
    return {
      supportedEvent: false,
      paid: false,
      eventId,
      invoiceRef,
      txId,
      reason: `Ignored Stripe event type "${eventType || 'unknown'}".`,
    };
  }

  const isPaid =
    eventType === 'checkout.session.completed'
      ? dataObj.payment_status === 'paid'
      : dataObj.status === 'succeeded';

  const amountRaw = dataObj.amount_total ?? dataObj.amount_received ?? dataObj.amount;
  const amountPaidMinor = typeof amountRaw === 'number' && Number.isFinite(amountRaw) ? amountRaw : undefined;
  const currency = typeof dataObj.currency === 'string' ? (dataObj.currency.toUpperCase() as CurrencyCode) : undefined;

  return {
    supportedEvent: true,
    paid: isPaid,
    eventId,
    invoiceRef,
    txId,
    amountPaidMinor,
    currency,
    reason: isPaid ? undefined : 'Stripe payment status is not yet paid/succeeded.',
  };
}
