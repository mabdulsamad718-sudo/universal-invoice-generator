import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type http from 'node:http';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.ts';
import { hashPasswordScrypt } from './auth.ts';
import type { ConnectedPaymentAccount, Invoice } from '../src/types/invoice.ts';

function buildTestInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-srv-1',
    invoiceNumber: 'INV-2026-101',
    title: 'INVOICE',
    issueDate: '2026-11-14',
    dueDate: '2026-11-28',
    currency: 'USD',
    status: 'unpaid',
    clientId: 'cli-secret-999',
    business: {
      name: 'Studio North',
      logoDataUrl: '',
      address: '100 Main St',
      phone: '+1 555 0100',
      email: 'owner@studionorth.test',
      website: 'https://studionorth.test',
      taxNumber: 'TN-100',
    },
    customer: {
      name: 'Ada Lovelace',
      company: 'Analytical Engine Ltd',
      address: '200 Elm St',
      email: 'ada@engine.test',
      phone: '+44 20 7946 0000',
    },
    items: [
      { id: 'i1', description: 'Platform Engineering', quantity: 2, unitPrice: 500, taxRate: 10 },
    ],
    discountType: 'percent',
    discountValue: 0,
    taxTreatment: 'after_discount',
    invoiceTaxRate: 0,
    additional: {
      paymentInstructions: 'Settle via Stripe or IBAN.',
      bankDetails: 'PK00MEZN000112233',
      notes: 'Thank you.',
      internalNotes: 'PRIVATE COST BASIS $200 — MUST NOT LEAK',
      terms: 'Net 14 days',
      footerMessage: '',
    },
    design: {
      template: 'modern',
      accentColor: '#1D4ED8',
      fontStyle: 'sans',
      logoPlacement: 'left',
      headerStyle: 'clean',
      footerStyle: 'detailed',
    },
    signature: {
      enabled: false,
      dataUrl: '',
      label: 'Authorized Signature',
      x: 8,
      y: 80,
      width: 150,
    },
    stamp: {
      enabled: false,
      dataUrl: '',
      label: 'Company Seal',
      x: 72,
      y: 78,
      size: 90,
      opacity: 0.85,
    },
    updatedAt: '2026-11-14T00:00:00Z',
    ...overrides,
  };
}

const TEST_ACCOUNTS: ConnectedPaymentAccount[] = [
  {
    id: 'acc-stripe',
    providerId: 'stripe',
    providerName: 'Stripe',
    shortCode: 'STRP',
    category: 'global',
    supportsOnlineCheckout: true,
    connected: true,
    enabledByDefault: true,
    accountTitle: 'Studio North Stripe',
    accountIdentifier: 'acct_test_123',
    region: 'Global',
    accentHex: '#635BFF',
  },
];

async function startTestServer(app: ReturnType<typeof createApp>) {
  return new Promise<{ server: http.Server; baseUrl: string }>((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

describe('Server Security, Auth, Shares, Webhooks & Recurring Worker', () => {
  let tmpDir: string;
  let server: http.Server;
  let baseUrl: string;

  const ownerEmail = 'owner@test.local';
  const ownerPassword = 'Sup3rSecureTestPassword!';
  const cronSecret = 'cron-secret-token-xyz';
  const stripeWebhookSecret = 'whsec_test_secret_1234567890';

  let ownerCookie = '';
  let ownerCsrf = '';

  const prevEnv: Record<string, string | undefined> = {};

  before(async () => {
    for (const k of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']) {
      prevEnv[k] = process.env[k];
    }
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy_formatted_key_for_tests';
    process.env.STRIPE_WEBHOOK_SECRET = stripeWebhookSecret;

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uig-server-test-'));
    const app = createApp({
      dataDir: tmpDir,
      disableRateLimit: true,
      authOverrides: {
        isProd: false,
        sessionSecret: 'test-session-secret-0123456789abcdef',
        ownerEmail,
        ownerPasswordHash: hashPasswordScrypt(ownerPassword),
        cronSecret,
      },
    });
    const started = await startTestServer(app);
    server = started.server;
    baseUrl = started.baseUrl;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('exposes /api/health without leaking secrets', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean; authConfigured: boolean; smtpConfigured: boolean };
    assert.equal(body.ok, true);
    assert.equal(body.authConfigured, true);
    assert.equal(typeof body.smtpConfigured, 'boolean');
  });

  it('blocks unauthenticated owner endpoints (401) and enforces login + CSRF (403)', async () => {
    const unauthShare = await fetch(`${baseUrl}/api/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice: buildTestInvoice() }),
    });
    assert.equal(unauthShare.status, 401);

    const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password: 'wrong-password' }),
    });
    assert.equal(badLogin.status, 401);

    const goodLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
    });
    assert.equal(goodLogin.status, 200);
    const setCookie = goodLogin.headers.get('set-cookie') || '';
    ownerCookie = setCookie.split(';')[0];
    assert.ok(ownerCookie.startsWith('uig_session='));

    const loginBody = (await goodLogin.json()) as { authenticated: boolean; csrfToken: string };
    assert.equal(loginBody.authenticated, true);
    ownerCsrf = loginBody.csrfToken;
    assert.ok(ownerCsrf.length >= 16);

    // State-changing call with session cookie but missing CSRF token must fail 403
    const noCsrfRes = await fetch(`${baseUrl}/api/shares`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie,
      },
      body: JSON.stringify({ invoice: buildTestInvoice() }),
    });
    assert.equal(noCsrfRes.status, 403);
  });

  it('creates share with SHA-256 hashed storage, sanitizes public view, and handles claims & revocation', async () => {
    const createRes = await fetch(`${baseUrl}/api/shares`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie,
        'X-CSRF-Token': ownerCsrf,
      },
      body: JSON.stringify({
        invoice: buildTestInvoice(),
        paymentAccounts: TEST_ACCOUNTS,
      }),
    });
    assert.equal(createRes.status, 200);
    const created = (await createRes.json()) as { shareToken: string; invoice: Invoice };
    assert.ok(created.shareToken.length >= 24);

    // Raw shareToken must NOT appear anywhere in .data/store.json on disk
    const storeRaw = fs.readFileSync(path.join(tmpDir, 'store.json'), 'utf8');
    assert.equal(storeRaw.includes(created.shareToken), false);

    // Public GET must strip raw token, internalNotes, clientId
    const pubRes = await fetch(`${baseUrl}/api/shares/${encodeURIComponent(created.shareToken)}`);
    assert.equal(pubRes.status, 200);
    const pubJson = (await pubRes.json()) as {
      shareToken?: string;
      invoice: Invoice;
    };
    assert.equal(pubJson.shareToken, undefined);
    assert.equal(pubJson.invoice.shareToken, undefined);
    assert.equal(pubJson.invoice.clientId, undefined);
    assert.equal(pubJson.invoice.additional.internalNotes, undefined);

    // Public remittance claim records pending_verification and NEVER marks paid
    const claimRes = await fetch(
      `${baseUrl}/api/shares/${encodeURIComponent(created.shareToken)}/payment-claim`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerName: 'Ada Lovelace',
          payerEmail: 'ada@engine.test',
          methodName: 'Meezan Bank',
          reference: 'TXN-MZN-8812',
        }),
      }
    );
    assert.equal(claimRes.status, 201);
    const publicAfterClaim = await fetch(`${baseUrl}/api/shares/${created.shareToken}`);
    assert.equal(publicAfterClaim.status, 200);
    const publicAfterClaimJson = (await publicAfterClaim.json()) as Record<string, any>;
    assert.equal(publicAfterClaimJson.pendingClaims, undefined);
    assert.equal(publicAfterClaimJson.paymentHistory, undefined);
    assert.equal(publicAfterClaimJson.invoice?.pendingClaims, undefined);
    assert.equal(publicAfterClaimJson.invoice?.paymentHistory, undefined);
    const claimBody = (await claimRes.json()) as { invoice: Invoice };
    assert.equal(claimBody.invoice.status, 'unpaid');
    assert.equal(claimBody.invoice.pendingClaims, undefined);

    // Revoking returns 410 Gone on subsequent public lookup
    const revokeRes = await fetch(`${baseUrl}/api/shares/${encodeURIComponent(created.shareToken)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie,
        'X-CSRF-Token': ownerCsrf,
      },
      body: JSON.stringify({ revoked: true }),
    });
    assert.equal(revokeRes.status, 200);

    const revokedRead = await fetch(`${baseUrl}/api/shares/${encodeURIComponent(created.shareToken)}`);
    assert.equal(revokedRead.status, 410);
  });

  it('rejects expired share links with 410 and blocks Checkout on paid/cancelled invoices with 409', async () => {
    const expiredRes = await fetch(`${baseUrl}/api/shares`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie,
        'X-CSRF-Token': ownerCsrf,
      },
      body: JSON.stringify({
        invoice: buildTestInvoice({ id: 'inv-exp-1', invoiceNumber: 'INV-2026-102' }),
        paymentAccounts: TEST_ACCOUNTS,
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      }),
    });
    const expiredCreated = (await expiredRes.json()) as { shareToken: string };
    const expiredRead = await fetch(
      `${baseUrl}/api/shares/${encodeURIComponent(expiredCreated.shareToken)}`
    );
    assert.equal(expiredRead.status, 410);

    // Cancelled invoice share blocks Stripe Checkout (409) and manual payment (409)
    const cancelledRes = await fetch(`${baseUrl}/api/shares`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie,
        'X-CSRF-Token': ownerCsrf,
      },
      body: JSON.stringify({
        invoice: buildTestInvoice({
          id: 'inv-cancel-1',
          invoiceNumber: 'INV-2026-103',
          status: 'cancelled',
        }),
        paymentAccounts: TEST_ACCOUNTS,
      }),
    });
    const cancelledCreated = (await cancelledRes.json()) as { shareToken: string };

    const checkoutCancelled = await fetch(`${baseUrl}/api/payments/stripe/checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareToken: cancelledCreated.shareToken }),
    });
    assert.equal(checkoutCancelled.status, 409);

    const manualCancelled = await fetch(`${baseUrl}/api/invoices/inv-cancel-1/manual-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie,
        'X-CSRF-Token': ownerCsrf,
      },
      body: JSON.stringify({ reference: 'REF-1' }),
    });
    assert.equal(manualCancelled.status, 409);
  });

  it('verifies Stripe webhook HMAC, replay timestamp, currency & minor-unit amount, and deduplicates events', async () => {
    const shareRes = await fetch(`${baseUrl}/api/shares`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie,
        'X-CSRF-Token': ownerCsrf,
      },
      body: JSON.stringify({
        invoice: buildTestInvoice({
          id: 'inv-stripe-1',
          invoiceNumber: 'INV-2026-200',
          // 2 * 500 = 1000 + 10% tax = 1100.00 USD => 110000 minor units
        }),
        paymentAccounts: TEST_ACCOUNTS,
      }),
    });
    assert.equal(shareRes.status, 200);

    const makeStripeEvent = (overrides: Record<string, unknown> = {}) =>
      JSON.stringify({
        id: 'evt_stripe_test_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_1',
            payment_intent: 'pi_test_1',
            payment_status: 'paid',
            currency: 'usd',
            amount_total: 110000,
            metadata: { invoiceRef: 'INV-2026-200' },
            ...overrides,
          },
        },
      });

    const signStripe = (rawBody: string, tsSec = Math.floor(Date.now() / 1000)) => {
      const sig = crypto
        .createHmac('sha256', stripeWebhookSecret)
        .update(`${tsSec}.${rawBody}`)
        .digest('hex');
      return `t=${tsSec},v1=${sig}`;
    };

    // 1. Bad signature -> 401
    const raw1 = makeStripeEvent();
    const badSigRes = await fetch(`${baseUrl}/api/webhooks/payments/stripe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 't=123,v1=deadbeef' },
      body: raw1,
    });
    assert.equal(badSigRes.status, 401);

    // 2. Stale timestamp (>300s) -> 401
    const staleTs = Math.floor(Date.now() / 1000) - 600;
    const staleRes = await fetch(`${baseUrl}/api/webhooks/payments/stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signStripe(raw1, staleTs),
      },
      body: raw1,
    });
    assert.equal(staleRes.status, 401);

    // 3. Underpayment -> 422
    const rawUnder = makeStripeEvent({ amount_total: 50000 });
    const underRes = await fetch(`${baseUrl}/api/webhooks/payments/stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signStripe(rawUnder),
      },
      body: rawUnder,
    });
    assert.equal(underRes.status, 422);

    // 4. Currency mismatch -> 422
    const rawEur = makeStripeEvent({ currency: 'eur' });
    const eurRes = await fetch(`${baseUrl}/api/webhooks/payments/stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signStripe(rawEur),
      },
      body: rawEur,
    });
    assert.equal(eurRes.status, 422);

    // 5. Valid settlement -> 200 paid
    const okRes = await fetch(`${baseUrl}/api/webhooks/payments/stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signStripe(raw1),
      },
      body: raw1,
    });
    assert.equal(okRes.status, 200);
    const okJson = (await okRes.json()) as { ok: boolean; duplicate: boolean; invoice: Invoice };
    assert.equal(okJson.ok, true);
    assert.equal(okJson.duplicate, false);
    assert.equal(okJson.invoice.status, 'paid');
    assert.equal(okJson.invoice.paymentVerificationMode, 'gateway_webhook');

    // 6. Duplicate eventId -> 200 duplicate: true
    const dupRes = await fetch(`${baseUrl}/api/webhooks/payments/stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signStripe(raw1),
      },
      body: raw1,
    });
    assert.equal(dupRes.status, 200);
    const dupJson = (await dupRes.json()) as { ok: boolean; duplicate: boolean };
    assert.equal(dupJson.duplicate, true);
  });

  it('rejects forged PayPal webhooks and enforces payload size / cron bearer auth', async () => {
    const ppBad = await fetch(`${baseUrl}/api/webhooks/payments/paypal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'EVT-1', resource: { invoice_id: 'INV-2026-101' } }),
    });
    assert.equal(ppBad.status, 401);

    // Oversized JSON on smallJson route -> 413
    const huge = JSON.stringify({ email: ownerEmail, password: 'x'.repeat(150 * 1024) });
    const tooLarge = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: huge,
    });
    assert.equal(tooLarge.status, 413);

    // Malformed JSON -> 400
    const badJson = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"bad":',
    });
    assert.equal(badJson.status, 400);

    // Recurring process-due rejects bad bearer token and accepts valid CRON_SECRET
    const badCron = await fetch(`${baseUrl}/api/recurring/process-due`, {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-secret' },
    });
    assert.equal(badCron.status, 401);

    const okCron = await fetch(`${baseUrl}/api/recurring/process-due`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    assert.equal(okCron.status, 200);
    const cronJson = (await okCron.json()) as { ok: boolean; generatedCount: number };
    assert.equal(cronJson.ok, true);
  });

  it('enforces rate limiting (429) when limiter is active', async () => {
    const rlDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uig-rl-test-'));
    const rlApp = createApp({
      dataDir: rlDir,
      disableRateLimit: false,
      rateLimitMax: 2,
      authOverrides: {
        isProd: false,
        sessionSecret: 'rl-secret',
        ownerEmail,
        ownerPasswordHash: hashPasswordScrypt(ownerPassword),
      },
    });
    const rlStarted = await startTestServer(rlApp);
    try {
      const r1 = await fetch(`${rlStarted.baseUrl}/api/shares/nonexistent-token-123`);
      const r2 = await fetch(`${rlStarted.baseUrl}/api/shares/nonexistent-token-123`);
      const r3 = await fetch(`${rlStarted.baseUrl}/api/shares/nonexistent-token-123`);
      assert.equal(r1.status, 404);
      assert.equal(r2.status, 404);
      assert.equal(r3.status, 429);
    } finally {
      await new Promise<void>((resolve) => rlStarted.server.close(() => resolve()));
      fs.rmSync(rlDir, { recursive: true, force: true });
    }
  });
});
