import crypto from 'node:crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type {
  ConnectedPaymentAccount,
  Invoice,
  RecurringDeliveryLog,
  RecurringInvoiceSchedule,
  SavedBusinessProfile,
} from '../src/types/invoice.ts';
import { calculateInvoiceTotals, toMinorUnits } from '../src/utils/calculations.ts';
import { buildAuthConfigFromEnv, createAuthHelpers, type AuthConfig } from './auth.ts';
import {
  createStripeCheckoutSession,
  extractStripeSettlementDetails,
  listAllProviderStatuses,
  verifyProviderLiveConnection,
  verifyWebhookForProvider,
} from './paymentAdapters.ts';
import { dispatchInvoiceEmail, isSmtpConfigured, runDueRecurringPass } from './recurringWorker.ts';
import {
  appendDeliveryLog,
  createOrUpdateShare,
  getPublicShareByToken,
  markInvoiceManualPayment,
  markInvoicePaidFromWebhook,
  readStore,
  sanitizeInvoiceForPublicShare,
  submitPaymentClaim,
  updateShareSettings,
  withStoreLock,
  writeStore,
} from './store.ts';
import {
  isValidIsoTimestamp,
  validateInvoicePayload,
  validatePaymentAccountsPayload,
  validatePaymentClaimInput,
} from './validation.ts';

export interface CreateAppOptions {
  dataDir?: string;
  authOverrides?: Partial<AuthConfig>;
  disableRateLimit?: boolean;
  rateLimitMax?: number;
}

export function getRequestOrigin(req: express.Request, portFallback = 3000): string {
  const configuredBase = (process.env.APP_BASE_URL || process.env.APP_URL || '').trim();
  if (configuredBase.startsWith('http://') || configuredBase.startsWith('https://')) {
    return configuredBase.replace(/\/+$/, '');
  }
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || `localhost:${portFallback}`)
    .split(',')[0]
    .trim();
  return `${proto}://${host}`;
}

function getAllowedOrigins(): Set<string> {
  const raw = (process.env.ALLOWED_ORIGINS || '').trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().replace(/\/+$/, ''))
      .filter(Boolean)
  );
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const auth = createAuthHelpers(buildAuthConfigFromEnv(options.authOverrides));
  const customDataDir = options.dataDir;
  const isProd = auth.config.isProd;

  app.set('trust proxy', 1);

  // Security headers compatible with React, Google Fonts, and embedded data-URL images
  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
              imgSrc: ["'self'", 'data:', 'blob:'],
              connectSrc: ["'self'"],
              frameAncestors: ["'none'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // Explicit CORS allowlist for cross-origin API calls (same-origin requests work naturally)
  const allowedOrigins = getAllowedOrigins();
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      const clean = origin.replace(/\/+$/, '');
      const requestHostOrigin = getRequestOrigin(req);
      if (clean === requestHostOrigin || allowedOrigins.has(clean)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, Authorization');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
        if (req.method === 'OPTIONS') {
          res.status(204).end();
          return;
        }
      } else if (req.method === 'OPTIONS') {
        res.status(403).json({ error: 'CORS origin denied.' });
        return;
      }
    }
    next();
  });

  // Capture raw body for webhook signature verification; cap standard JSON to 100kb and upload routes to 6mb
  const smallJson = express.json({ limit: '100kb' });
  const largeJson = express.json({ limit: '6mb' });
  const webhookJson = express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
    },
  });

  const makeLimiter = (windowMs: number, max: number, message: string) =>
    options.disableRateLimit
      ? (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()
      : rateLimit({
          windowMs,
          max: options.rateLimitMax ?? max,
          standardHeaders: true,
          legacyHeaders: false,
          message: { error: message },
        });

  const authLimiter = makeLimiter(15 * 60 * 1000, 20, 'Too many authentication attempts. Try again later.');
  const shareReadLimiter = makeLimiter(60 * 1000, 60, 'Too many share lookups. Please wait a minute.');
  const webhookLimiter = makeLimiter(60 * 1000, 120, 'Webhook rate limit exceeded.');
  const mutationLimiter = makeLimiter(60 * 1000, 60, 'Too many requests. Please slow down.');

  // ------------------------------------------------------------------
  // Health & Owner Session Auth Routes
  // ------------------------------------------------------------------
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      smtpConfigured: isSmtpConfigured(),
      authConfigured: auth.isLoginConfigured(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/auth/session', (req, res) => {
    res.json(auth.getSessionStatus(req));
  });

  app.post('/api/auth/login', authLimiter, smallJson, (req, res) => {
    if (!auth.isLoginConfigured()) {
      res.status(503).json({
        error:
          'Owner authentication is not configured on this server. Set OWNER_EMAIL and OWNER_PASSWORD_HASH (or OWNER_PASSWORD) in server environment variables.',
      });
      return;
    }

    const { email, password } = (req.body || {}) as { email?: string; password?: string };
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    if (!auth.verifyOwnerCredentials(email, password)) {
      res.status(401).json({ error: 'Invalid owner email or password.' });
      return;
    }

    const session = auth.issueSessionCookie(req, res);
    res.json({
      authenticated: true,
      ownerEmail: session.sub,
      csrfToken: session.csrf,
      authMode: 'single_owner_session',
    });
  });

  app.post('/api/auth/logout', smallJson, (req, res) => {
    const existing = auth.getSessionFromRequest(req);
    if (existing) {
      const csrfHeader = String(req.headers['x-csrf-token'] || '');
      if (csrfHeader && csrfHeader !== existing.csrf) {
        res.status(403).json({ error: 'Invalid CSRF token.' });
        return;
      }
    }
    auth.clearSessionCookie(res);
    res.json({ ok: true, authenticated: false });
  });

  // ------------------------------------------------------------------
  // Payment Provider Status, Live Probe, Checkout & Verified Webhooks
  // ------------------------------------------------------------------
  app.get('/api/payment-providers', (req, res) => {
    const localIdsParam = String(req.query.localIds || '');
    const localIds = localIdsParam.split(',').map((s) => s.trim()).filter(Boolean);
    const catalogIdsParam = String(req.query.catalogIds || '');
    const catalogIds = catalogIdsParam.split(',').map((s) => s.trim()).filter(Boolean);

    const origin = getRequestOrigin(req);
    const statuses = listAllProviderStatuses(catalogIds, localIds, origin);
    res.json({ providers: statuses });
  });

  app.post(
    '/api/payment-providers/:providerId/verify',
    mutationLimiter,
    auth.requireOwnerAuth,
    smallJson,
    async (req, res) => {
      const providerId = String(req.params.providerId);
      const { hasLocalIdentifier } = (req.body || {}) as { hasLocalIdentifier?: boolean };
      const origin = getRequestOrigin(req);
      const status = await verifyProviderLiveConnection(providerId, Boolean(hasLocalIdentifier), origin);
      res.json({ provider: status });
    }
  );

  // Create a Stripe Checkout Session for either a valid public share token or an authenticated owner invoice
  app.post('/api/payments/stripe/checkout-session', mutationLimiter, smallJson, async (req, res) => {
    const { shareToken, invoice: bodyInvoice } = (req.body || {}) as {
      shareToken?: string;
      invoice?: Invoice;
    };
    const origin = getRequestOrigin(req);

    let targetInvoice: Invoice | undefined;
    let invoiceRef = '';
    let baseReturnUrl = origin;

    if (typeof shareToken === 'string' && shareToken.trim()) {
      const lookup = getPublicShareByToken(shareToken.trim(), customDataDir);
      if (!lookup.record) {
        res.status(lookup.errorStatus || 404).json({ error: lookup.errorMessage });
        return;
      }
      targetInvoice = lookup.record.invoice;
      invoiceRef = lookup.record.invoiceNumber;
      baseReturnUrl = `${origin}/?share=${encodeURIComponent(shareToken.trim())}`;
    } else {
      const session = auth.getSessionFromRequest(req);
      if (!session) {
        res.status(401).json({ error: 'Valid shareToken or owner session is required to initiate Checkout.' });
        return;
      }
      const check = validateInvoicePayload(bodyInvoice);
      if (!check.ok) {
        res.status(400).json({ error: check.error });
        return;
      }
      targetInvoice = check.invoice;
      invoiceRef = check.invoice.invoiceNumber;
      baseReturnUrl = `${origin}/?pay=${encodeURIComponent(check.invoice.invoiceNumber)}`;
    }

    if (targetInvoice.status === 'paid' || targetInvoice.status === 'cancelled') {
      res.status(409).json({ error: `Cannot start checkout for a ${targetInvoice.status} invoice.` });
      return;
    }

    const sep = baseReturnUrl.includes('?') ? '&' : '?';
    const result = await createStripeCheckoutSession({
      invoice: targetInvoice,
      invoiceRef,
      successUrl: `${baseReturnUrl}${sep}checkout=success`,
      cancelUrl: `${baseReturnUrl}${sep}checkout=cancelled`,
    });

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ url: result.url, sessionId: result.sessionId });
  });

  app.post('/api/webhooks/payments/:providerId', webhookLimiter, webhookJson, async (req, res) => {
    const providerId = String(req.params.providerId);
    const rawBody = (req as express.Request & { rawBody?: string }).rawBody || JSON.stringify(req.body || {});
    const payload = (req.body || {}) as Record<string, unknown>;

    const sigCheck = await verifyWebhookForProvider({
      providerId,
      rawBody,
      body: payload,
      headers: req.headers,
    });

    if (!sigCheck.valid) {
      res.status(sigCheck.statusCode || 401).json({ ok: false, error: sigCheck.reason });
      return;
    }

    if (providerId === 'stripe') {
      const details = extractStripeSettlementDetails(payload);
      if (!details.supportedEvent) {
        res.json({ ok: true, ignored: true, reason: details.reason });
        return;
      }
      if (!details.paid) {
        res.status(400).json({ ok: false, error: details.reason });
        return;
      }
      if (!details.invoiceRef) {
        res.status(400).json({ ok: false, error: 'Stripe event missing invoiceRef metadata.' });
        return;
      }

      const outcome = await markInvoicePaidFromWebhook(
        details.invoiceRef,
        details.eventId || `stripe-${Date.now()}`,
        details.txId,
        {
          providerId: 'stripe',
          expectedCurrency: details.currency,
          amountPaidMinor: details.amountPaidMinor,
          expectedAmountMinorFn: (inv) => {
            const totals = calculateInvoiceTotalsSafe(inv);
            return toMinorUnits(totals.grandTotal, inv.currency);
          },
        },
        customDataDir
      );

      if (!outcome.ok) {
        res.status(outcome.statusCode || 404).json({ ok: false, error: outcome.reason });
        return;
      }
      res.json({ ok: true, duplicate: Boolean(outcome.duplicate), invoice: outcome.record?.invoice });
      return;
    }

    // PayPal verified webhook
    const eventId = String(payload.id || payload.eventId || `evt-${Date.now()}`);
    const resource = (payload.resource || {}) as Record<string, unknown>;
    const invoiceRef = String(
      payload.invoiceRef || resource.invoice_id || resource.custom_id || ''
    ).trim();
    const txId = String(resource.id || eventId);

    if (!invoiceRef) {
      res.status(400).json({ ok: false, error: 'Webhook payload missing invoice reference.' });
      return;
    }

    const outcome = await markInvoicePaidFromWebhook(
      invoiceRef,
      eventId,
      txId,
      { providerId },
      customDataDir
    );
    if (!outcome.ok) {
      res.status(outcome.statusCode || 404).json({ ok: false, error: outcome.reason });
      return;
    }
    res.json({ ok: true, duplicate: Boolean(outcome.duplicate), invoice: outcome.record?.invoice });
  });

  // ------------------------------------------------------------------
  // Share Links (Owner Creates/Updates, Public Reads & Submits Claims)
  // ------------------------------------------------------------------
  app.post('/api/shares', mutationLimiter, auth.requireOwnerAuth, largeJson, async (req, res) => {
    const { invoice, paymentAccounts, expiresAt } = (req.body || {}) as {
      invoice?: unknown;
      paymentAccounts?: unknown;
      expiresAt?: unknown;
    };

    const check = validateInvoicePayload(invoice);
    if (!check.ok) {
      res.status(400).json({ error: check.error });
      return;
    }

    let cleanExpiry: string | undefined;
    if (expiresAt !== undefined && expiresAt !== null && expiresAt !== '') {
      if (!isValidIsoTimestamp(expiresAt)) {
        res.status(400).json({ error: 'expiresAt must be a valid ISO timestamp.' });
        return;
      }
      cleanExpiry = expiresAt;
    }

    const origin = getRequestOrigin(req);
    const validAccounts: ConnectedPaymentAccount[] = validatePaymentAccountsPayload(paymentAccounts);
    const created = await createOrUpdateShare(
      check.invoice,
      validAccounts,
      origin,
      cleanExpiry,
      check.invoice.shareToken,
      customDataDir
    );

    const providerStatuses = listAllProviderStatuses(
      created.record.paymentAccounts.map((p) => p.providerId),
      created.record.paymentAccounts.map((p) => p.providerId),
      origin
    );

    res.json({
      shareToken: created.token,
      shareUrl: created.shareUrl,
      expiresAt: created.record.expiresAt,
      revoked: created.record.revoked,
      invoice: created.record.invoice,
      providerStatuses,
    });
  });

  app.get('/api/shares/:token', shareReadLimiter, (req, res) => {
    const token = String(req.params.token);
    const lookup = getPublicShareByToken(token, customDataDir);
    if (!lookup.record) {
      res.status(lookup.errorStatus || 404).json({ error: lookup.errorMessage });
      return;
    }

    const origin = getRequestOrigin(req);
    const providerStatuses = listAllProviderStatuses(
      lookup.record.paymentAccounts.map((p) => p.providerId),
      lookup.record.paymentAccounts.map((p) => p.providerId),
      origin
    );

    // Public response intentionally omits raw token echoes and internal metadata
    res.json({
      expiresAt: lookup.record.expiresAt,
      revoked: lookup.record.revoked,
      invoice: lookup.record.invoice,
      paymentAccounts: lookup.record.paymentAccounts,
      providerStatuses,
    });
  });

  app.post('/api/shares/:token/payment-claim', shareReadLimiter, smallJson, async (req, res) => {
    const token = String(req.params.token);
    const check = validatePaymentClaimInput(req.body);
    if (!check.ok) {
      res.status(400).json({ error: check.error });
      return;
    }

    const result = await submitPaymentClaim(token, check.claim, customDataDir);
    if (!result.ok) {
      res.status(result.errorStatus || 400).json({ error: result.errorMessage });
      return;
    }

    res.status(201).json({
      ok: true,
      claim: result.claim,
      invoice: result.record?.invoice ? sanitizeInvoiceForPublicShare(result.record.invoice) : undefined,
    });
  });

  app.patch('/api/shares/:token', mutationLimiter, auth.requireOwnerAuth, smallJson, async (req, res) => {
    const token = String(req.params.token);
    const { revoked, expiresAt } = (req.body || {}) as {
      revoked?: boolean;
      expiresAt?: string | null;
    };

    if (expiresAt !== undefined && expiresAt !== null && expiresAt !== '' && !isValidIsoTimestamp(expiresAt)) {
      res.status(400).json({ error: 'expiresAt must be a valid ISO timestamp or null.' });
      return;
    }

    const updated = await updateShareSettings(token, { revoked, expiresAt }, customDataDir);
    if (!updated) {
      res.status(404).json({ error: 'Share record not found.' });
      return;
    }
    res.json({
      revoked: updated.revoked,
      expiresAt: updated.expiresAt,
      invoice: updated.invoice,
    });
  });

  // Owner-confirmed offline/bank settlement (never faked by public clients)
  app.post(
    '/api/invoices/:id/manual-payment',
    mutationLimiter,
    auth.requireOwnerAuth,
    smallJson,
    async (req, res) => {
      const id = String(req.params.id);
      const { reference } = (req.body || {}) as { reference?: string };
      const session = (req as express.Request & { ownerSession?: { sub: string } }).ownerSession;
      const result = await markInvoiceManualPayment(
        id,
        typeof reference === 'string' ? reference : undefined,
        session?.sub || 'workspace_owner',
        customDataDir
      );

      if (!result.ok) {
        res.status(result.errorStatus || 404).json({ error: result.errorMessage });
        return;
      }

      res.json({
        ok: true,
        verificationMode: 'manual',
        updatedShare: true,
        paidAt: result.record?.paidAt,
        invoice: result.record?.invoice ? sanitizeInvoiceForPublicShare(result.record.invoice) : undefined,
      });
    }
  );

  // ------------------------------------------------------------------
  // Recurring Invoice Dispatch, Sync & Server Due-Schedule Worker
  // ------------------------------------------------------------------
  app.get('/api/recurring/logs', auth.requireOwnerAuth, (_req, res) => {
    const store = readStore(customDataDir);
    res.json({
      smtpConfigured: isSmtpConfigured(),
      logs: store.deliveryLogs,
    });
  });

  app.post('/api/recurring/sync', mutationLimiter, auth.requireOwnerAuth, largeJson, async (req, res) => {
    const { schedules, businessProfile } = (req.body || {}) as {
      schedules?: RecurringInvoiceSchedule[];
      businessProfile?: SavedBusinessProfile;
    };

    if (schedules !== undefined && !Array.isArray(schedules)) {
      res.status(400).json({ error: 'schedules must be an array.' });
      return;
    }

    const count = await withStoreLock(() => {
      const store = readStore(customDataDir);
      if (Array.isArray(schedules)) {
        store.recurringSchedules = schedules.slice(0, 200);
      }
      if (businessProfile && typeof businessProfile === 'object') {
        store.businessProfile = businessProfile;
      }
      writeStore(store, customDataDir);
      return store.recurringSchedules.length;
    });

    res.json({ ok: true, count });
  });

  app.post('/api/recurring/dispatch', mutationLimiter, auth.requireOwnerAuth, largeJson, async (req, res) => {
    const { invoice, scheduleId, scheduledDate } = (req.body || {}) as {
      invoice?: unknown;
      scheduleId?: string;
      scheduledDate?: string;
    };

    const check = validateInvoicePayload(invoice);
    if (!check.ok) {
      res.status(400).json({ error: check.error });
      return;
    }

    const origin = getRequestOrigin(req);
    const result = await dispatchInvoiceEmail(check.invoice, check.invoice.customer.email, origin);

    const log: RecurringDeliveryLog = {
      id: `dlog-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      scheduleId: scheduleId || check.invoice.recurringScheduleId || 'manual',
      invoiceId: check.invoice.id,
      invoiceNumber: check.invoice.invoiceNumber,
      scheduledDate: scheduledDate || check.invoice.issueDate,
      dispatchedAt: new Date().toISOString(),
      status: result.status,
      detail: result.detail,
      recipientEmail: check.invoice.customer.email || undefined,
      attempts: result.attempts,
    };
    await appendDeliveryLog(log, customDataDir);

    res.json({
      deliveryStatus: result.status,
      detail: result.detail,
      attempts: result.attempts,
      smtpConfigured: isSmtpConfigured(),
      log,
    });
  });

  app.post('/api/recurring/process-due', mutationLimiter, auth.requireOwnerOrCronAuth, smallJson, async (req, res) => {
    const origin = getRequestOrigin(req);
    const outcome = await runDueRecurringPass(origin, customDataDir);
    res.json({
      ok: true,
      smtpConfigured: isSmtpConfigured(),
      ...outcome,
    });
  });

  // Safe global error handler for /api routes
  app.use('/api', (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = (err as { status?: number })?.status || 500;
    const message =
      status === 413
        ? 'Request payload exceeds maximum allowed size.'
        : isProd
          ? 'An internal server error occurred.'
          : err instanceof Error
            ? err.message
            : 'Internal server error.';
    if (status >= 500) {
      console.error('[API ERROR]', err);
    }
    res.status(status).json({ error: message });
  });

  return app;
}

// Local helper for Stripe settlement validation
function calculateInvoiceTotalsSafe(inv: Invoice) {
  return calculateInvoiceTotals(inv.items, inv.discountType, inv.discountValue, {
    currency: inv.currency,
    taxTreatment: inv.taxTreatment ?? 'after_discount',
    invoiceTaxRate: inv.invoiceTaxRate ?? 0,
  });
}
