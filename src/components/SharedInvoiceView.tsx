import { useEffect, useState, type FormEvent } from 'react';
import {
  Download,
  Printer,
  ShieldAlert,
  CheckCircle2,
  Copy,
  Check,
  CreditCard,
  Landmark,
  AlertCircle,
  Loader2,
  ExternalLink,
  Clock,
  Send,
  RefreshCw,
} from 'lucide-react';
import type {
  ConnectedPaymentAccount,
  Invoice,
  PaymentProviderServerStatus,
} from '../types/invoice';
import { calculateInvoiceTotals, formatCurrency } from '../utils/calculations';
import { downloadInvoicePdf } from '../utils/pdfGenerator';
import { resolveInvoicePaymentAccounts } from '../utils/recurring';
import { InvoiceRenderer } from './InvoiceRenderer';
import { StatusLabel } from './StatusLabel';

interface SharedInvoiceViewProps {
  shareToken: string;
  onExitToWorkspace?: () => void;
}

interface SharedApiPayload {
  expiresAt?: string;
  revoked: boolean;
  invoice: Invoice;
  paymentAccounts: ConnectedPaymentAccount[];
  providerStatuses: Record<string, PaymentProviderServerStatus>;
}

export function SharedInvoiceView({ shareToken, onExitToWorkspace }: SharedInvoiceViewProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<SharedApiPayload | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutBanner, setCheckoutBanner] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const status = new URLSearchParams(window.location.search).get('checkout');
      if (status === 'success') {
        return {
          type: 'success',
          text: 'Stripe Checkout session completed. Invoice payment status updates automatically as soon as the signed webhook confirms settlement.',
        };
      }
      if (status === 'cancelled') {
        return {
          type: 'info',
          text: 'Online checkout was cancelled. You can retry payment or submit a bank/wallet transfer reference below.',
        };
      }
    } catch {
      // Ignore query parse issues
    }
    return null;
  });

  // Public remittance claim form state
  const [claimPayerName, setClaimPayerName] = useState('');
  const [claimPayerEmail, setClaimPayerEmail] = useState('');
  const [claimMethodName, setClaimMethodName] = useState('');
  const [claimReference, setClaimReference] = useState('');
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimFeedback, setClaimFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const loadShare = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setErrorMsg(null);
    }

    try {
      const res = await fetch(`/api/shares/${encodeURIComponent(shareToken)}`);
      const body = (await res.json().catch(() => ({}))) as SharedApiPayload & { error?: string };
      if (!res.ok) {
        throw new Error(body.error || `Unable to load shared invoice (${res.status}).`);
      }
      setData(body);
      if (!claimMethodName) {
        const firstAcc = resolveInvoicePaymentAccounts(body.invoice, body.paymentAccounts)[0];
        if (firstAcc) {
          setClaimMethodName(firstAcc.providerName);
        } else {
          setClaimMethodName('Bank Transfer');
        }
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Could not reach the invoice sharing server.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadShare(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareToken]);

  const handleDownloadPdf = async () => {
    if (!data) return;
    setDownloadingPdf(true);
    setPdfError(null);
    try {
      await downloadInvoicePdf(data.invoice, 'DD MMM YYYY', data.paymentAccounts);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'PDF export failed.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleCopy = async (value: string, id: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleStartStripeCheckout = async () => {
    setCheckoutLoading(true);
    setCheckoutBanner(null);
    try {
      const res = await fetch('/api/payments/stripe/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareToken }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        throw new Error(body.error || 'Could not start Stripe Checkout session.');
      }
      window.location.assign(body.url);
    } catch (err) {
      setCheckoutBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to initialize Stripe Checkout.',
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleSubmitClaim = async (e: FormEvent) => {
    e.preventDefault();
    setClaimFeedback(null);
    if (!claimPayerName.trim() || !claimReference.trim() || !claimMethodName.trim()) {
      setClaimFeedback({
        type: 'error',
        text: 'Please provide your name, payment method, and transaction reference.',
      });
      return;
    }

    setClaimSubmitting(true);
    try {
      const res = await fetch(`/api/shares/${encodeURIComponent(shareToken)}/payment-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerName: claimPayerName.trim(),
          payerEmail: claimPayerEmail.trim() || undefined,
          methodName: claimMethodName.trim(),
          reference: claimReference.trim(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        invoice?: Invoice;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error || `Failed to submit remittance claim (${res.status}).`);
      }
      if (body.invoice && data) {
        setData({ ...data, invoice: body.invoice });
      }
      setClaimReference('');
      setClaimFeedback({
        type: 'success',
        text: 'Remittance claim recorded as Pending Verification. The invoice issuer must confirm receipt before status changes to Paid.',
      });
    } catch (err) {
      setClaimFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to submit remittance claim.',
      });
    } finally {
      setClaimSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-slate-600">
        <Loader2 className="h-7 w-7 animate-spin text-blue-700" />
        <p className="mt-3 text-sm font-medium">Loading shared invoice...</p>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full rounded-xl border border-slate-200 bg-white p-6 text-center space-y-4 shadow-sm">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" />
          <h1 className="text-lg font-bold text-slate-900">Invoice Link Unavailable</h1>
          <p className="text-xs leading-relaxed text-slate-600">
            {errorMsg || 'This shared invoice link is invalid, expired, or has been revoked.'}
          </p>
          {onExitToWorkspace && (
            <button
              type="button"
              onClick={onExitToWorkspace}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              Go to Universal Invoice Generator
            </button>
          )}
        </div>
      </div>
    );
  }

  const { invoice, paymentAccounts, providerStatuses } = data;
  const accepted = resolveInvoicePaymentAccounts(invoice, paymentAccounts);
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
  const stripeStatus = providerStatuses.stripe;
  const canPayOnlineStripe =
    Boolean(stripeStatus?.checkoutSupported) &&
    invoice.status !== 'paid' &&
    invoice.status !== 'cancelled' &&
    accepted.some((acc) => acc.providerId === 'stripe');
  const pendingClaims = invoice.pendingClaims ?? [];

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 sm:px-6">
      <div className="mx-auto max-w-[920px] space-y-5">
        {/* Recipient Header Bar */}
        <header className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-sm font-bold text-slate-900">
                {invoice.invoiceNumber}
              </span>
              <StatusLabel status={invoice.status} />
              {pendingClaims.some((c) => c.status === 'pending_verification') &&
                invoice.status !== 'paid' && (
                  <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    <Clock className="h-3 w-3" />
                    <span>Pending Verification</span>
                  </span>
                )}
            </div>
            <p className="text-xs text-slate-500">
              Issued by <strong className="text-slate-800">{invoice.business.name}</strong> &middot;
              Amount Due:{' '}
              <strong className="font-mono text-slate-900">
                {formatCurrency(totals.grandTotal, invoice.currency)}
              </strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => loadShare(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>
            <button
              type="button"
              disabled={downloadingPdf}
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {downloadingPdf ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              <span>{downloadingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>
          </div>
        </header>

        {checkoutBanner && (
          <div
            role="status"
            className={`no-print rounded-lg border px-4 py-3 text-xs ${
              checkoutBanner.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : checkoutBanner.type === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                  : 'border-blue-200 bg-blue-50 text-blue-900'
            }`}
          >
            {checkoutBanner.text}
          </div>
        )}

        {pdfError && (
          <div className="no-print rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800">
            {pdfError}
          </div>
        )}

        {/* Payment Settlement Card */}
        <section className="no-print rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Payment Options</h2>
              <p className="text-xs text-slate-500">
                Available remittance details and online gateway checkout status for this invoice.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canPayOnlineStripe && (
                <button
                  type="button"
                  disabled={checkoutLoading}
                  onClick={handleStartStripeCheckout}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {checkoutLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {checkoutLoading ? 'Connecting Stripe...' : 'Pay Online via Stripe Checkout'}
                  </span>
                </button>
              )}
              {invoice.status === 'paid' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    Paid{' '}
                    {invoice.paymentVerificationMode === 'gateway_webhook'
                      ? '(Verified via Gateway Webhook)'
                      : '(Confirmed by Issuer)'}
                  </span>
                </span>
              )}
            </div>
          </div>

          {accepted.length === 0 ? (
            <p className="text-xs text-slate-500">
              Follow the payment instructions listed directly on the invoice document below.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {accepted.map((acc) => {
                const serverStatus = providerStatuses[acc.providerId];
                const isGatewayVerified =
                  serverStatus?.status === 'verified' ||
                  serverStatus?.status === 'credentials_configured';

                return (
                  <div
                    key={acc.id}
                    className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {acc.supportsOnlineCheckout ? (
                          <CreditCard className="h-4 w-4 text-blue-700" />
                        ) : (
                          <Landmark className="h-4 w-4 text-slate-700" />
                        )}
                        <span className="text-xs font-bold text-slate-900">{acc.providerName}</span>
                      </div>
                      <span
                        className={`text-[10px] font-semibold ${
                          serverStatus?.status === 'verified'
                            ? 'text-emerald-700'
                            : serverStatus?.status === 'credentials_configured'
                              ? 'text-blue-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {serverStatus?.status === 'verified'
                          ? 'Live Gateway Verified'
                          : serverStatus?.status === 'credentials_configured'
                            ? 'Server Gateway Ready'
                            : acc.supportsOnlineCheckout
                              ? 'Setup Required for Auto-Checkout'
                              : 'Manual Remittance'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 rounded bg-white border border-slate-200 px-2.5 py-1.5">
                      <div className="min-w-0">
                        <div className="text-[10px] text-slate-500">{acc.accountTitle}</div>
                        <div className="font-mono text-xs font-semibold text-slate-800 truncate">
                          {acc.accountIdentifier}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(acc.accountIdentifier, acc.id)}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 shrink-0"
                      >
                        {copiedId === acc.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    {acc.supportsOnlineCheckout && !isGatewayVerified && (
                      <div className="flex items-start gap-1.5 text-[11px] text-amber-800">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>
                          Automated online checkout awaits server API credentials from the sender.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Submitted Remittance Claims */}
          {pendingClaims.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                <Clock className="h-3.5 w-3.5" />
                <span>Submitted Remittance Claims ({pendingClaims.length})</span>
              </div>
              <div className="space-y-1.5">
                {pendingClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded bg-white/90 px-3 py-1.5 text-[11px] border border-amber-200/80"
                  >
                    <div>
                      <span className="font-semibold text-slate-900">{claim.payerName}</span>{' '}
                      <span className="text-slate-500">via {claim.methodName}</span> &middot; Ref:{' '}
                      <span className="font-mono font-semibold text-slate-800">
                        {claim.reference}
                      </span>
                    </div>
                    <span className="font-semibold uppercase text-[10px] text-amber-800">
                      {claim.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Public Remittance Claim Form (Never sets Paid directly) */}
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <form
              onSubmit={handleSubmitClaim}
              className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3"
            >
              <div>
                <h3 className="text-xs font-bold text-slate-900">
                  Report Bank or Wallet Remittance Claim
                </h3>
                <p className="text-[11px] text-slate-500">
                  Already sent a bank transfer or mobile wallet payment? Submit your reference for
                  issuer verification. Status remains Pending Verification until the issuer confirms
                  receipt.
                </p>
              </div>

              {claimFeedback && (
                <div
                  role="status"
                  className={`rounded-md border px-3 py-2 text-xs ${
                    claimFeedback.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border-rose-200 bg-rose-50 text-rose-800'
                  }`}
                >
                  {claimFeedback.text}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <input
                  type="text"
                  required
                  aria-label="Payer full name"
                  value={claimPayerName}
                  onChange={(e) => setClaimPayerName(e.target.value)}
                  placeholder="Your Name *"
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                <input
                  type="email"
                  aria-label="Payer email"
                  value={claimPayerEmail}
                  onChange={(e) => setClaimPayerEmail(e.target.value)}
                  placeholder="Your Email (optional)"
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                <input
                  type="text"
                  required
                  aria-label="Payment method used"
                  value={claimMethodName}
                  onChange={(e) => setClaimMethodName(e.target.value)}
                  placeholder="Method (e.g. UBL / SadaPay) *"
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                <input
                  type="text"
                  required
                  aria-label="Transaction reference number"
                  value={claimReference}
                  onChange={(e) => setClaimReference(e.target.value)}
                  placeholder="Transaction / IBAN Ref *"
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={claimSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{claimSubmitting ? 'Submitting...' : 'Submit Remittance Claim'}</span>
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Sanitized Invoice Document */}
        <div className="overflow-hidden rounded-xl shadow-sm">
          <InvoiceRenderer
            invoice={invoice}
            paymentAccounts={paymentAccounts}
            interactive={false}
            printableId="printable-invoice-root"
          />
        </div>

        <footer className="no-print text-center text-[11px] text-slate-500 py-2">
          Shared via Universal Invoice Generator &middot; Muhammad Abdul Samad Tariq (CEO &amp;
          Founder)
        </footer>
      </div>
    </div>
  );
}
