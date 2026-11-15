import { useEffect, useState } from 'react';
import {
  X,
  CheckCircle2,
  ShieldAlert,
  Copy,
  Check,
  CreditCard,
  Landmark,
  AlertCircle,
  ExternalLink,
  Loader2,
  Clock,
} from 'lucide-react';
import type {
  ConnectedPaymentAccount,
  Invoice,
  PaymentProviderServerStatus,
} from '../types/invoice';
import { OwnerAuthError, ownerFetch } from '../utils/apiClient';
import { calculateInvoiceTotals, formatCurrency } from '../utils/calculations';
import { buildDirectPaymentUrl, resolveInvoicePaymentAccounts } from '../utils/recurring';

interface ClientPaymentPortalModalProps {
  invoice: Invoice;
  paymentAccounts: ConnectedPaymentAccount[];
  onClose: () => void;
  onConfirmManualPayment: (invoiceId: string, reference?: string) => void;
  onRequireOwnerAuth?: (reason: string) => void;
}

export function ClientPaymentPortalModal({
  invoice,
  paymentAccounts,
  onClose,
  onConfirmManualPayment,
  onRequireOwnerAuth,
}: ClientPaymentPortalModalProps) {
  const accepted = resolveInvoicePaymentAccounts(invoice, paymentAccounts);
  const [selectedId, setSelectedId] = useState<string>(accepted[0]?.id ?? '');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [manualRef, setManualRef] = useState('');
  const [paidSuccess, setPaidSuccess] = useState(invoice.status === 'paid');
  const [portalError, setPortalError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [serverStatuses, setServerStatuses] = useState<
    Record<string, PaymentProviderServerStatus>
  >({});

  useEffect(() => {
    const ids = Array.from(new Set(accepted.map((a) => a.providerId)));
    if (ids.length === 0) return;
    const qs = new URLSearchParams({
      catalogIds: ids.join(','),
      localIds: ids.join(','),
    });
    fetch(`/api/payment-providers?${qs.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { providers?: Record<string, PaymentProviderServerStatus> } | null) => {
        if (body?.providers) {
          setServerStatuses(body.providers);
        }
      })
      .catch(() => {
        // Ignore offline server status errors gracefully
      });
  }, [accepted.length]);

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
  const selectedMethod = accepted.find((a) => a.id === selectedId) ?? accepted[0];
  const selectedServerStatus = selectedMethod
    ? serverStatuses[selectedMethod.providerId]
    : undefined;
  const isOnlineConfiguredOrVerified =
    selectedServerStatus?.status === 'verified' ||
    selectedServerStatus?.status === 'credentials_configured';

  const paymentUrl =
    invoice.paymentLink ||
    buildDirectPaymentUrl(
      invoice.invoiceNumber,
      typeof window !== 'undefined' ? window.location.origin : '',
      invoice.shareToken
    );

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleStartStripeCheckout = async () => {
    setPortalError(null);
    setCheckoutLoading(true);
    try {
      const res = await ownerFetch('/api/payments/stripe/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          invoice.shareToken
            ? { shareToken: invoice.shareToken }
            : { invoice }
        ),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        throw new Error(body.error || 'Unable to create Stripe Checkout session.');
      }
      window.location.assign(body.url);
    } catch (err) {
      if (err instanceof OwnerAuthError && onRequireOwnerAuth) {
        onRequireOwnerAuth(
          'Sign in as workspace owner (or publish a Share Link first) to start a live Stripe Checkout session.'
        );
      } else {
        setPortalError(err instanceof Error ? err.message : 'Unable to start Checkout.');
      }
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleRecordManual = async () => {
    if (invoice.status === 'cancelled') {
      setPortalError('Cannot record payment on a cancelled invoice.');
      return;
    }
    setPortalError(null);
    setManualSaving(true);
    const refVal = manualRef.trim() || undefined;
    try {
      const res = await ownerFetch(
        `/api/invoices/${encodeURIComponent(invoice.id)}/manual-payment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference: refVal }),
        }
      );
      // 404 is acceptable when invoice is an unpublished local draft without a server share snapshot
      if (!res.ok && res.status !== 404) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Failed to record manual payment on server.');
      }
      onConfirmManualPayment(invoice.id, refVal);
      setPaidSuccess(true);
    } catch (err) {
      if (err instanceof OwnerAuthError) {
        if (invoice.shareToken && onRequireOwnerAuth) {
          onRequireOwnerAuth(
            'This invoice has a published Share Link. Sign in as workspace owner to record manual settlement on both server and local state.'
          );
          return;
        }
        // Unpublished local-only draft still updates cleanly in browser state
        onConfirmManualPayment(invoice.id, refVal);
        setPaidSuccess(true);
      } else {
        setPortalError(err instanceof Error ? err.message : 'Unable to confirm payment.');
      }
    } finally {
      setManualSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Payment Options & Settlement for ${invoice.invoiceNumber}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-[2px]"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {/* Top Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              Invoice Payment View
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {invoice.business.name} &middot; {invoice.invoiceNumber}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment portal"
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Amount Due Summary */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/50">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-500">Billed To</div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {invoice.customer.company || invoice.customer.name || 'Client'}
              </div>
              <div className="mt-1 font-mono text-[11px] text-slate-500 break-all">
                {paymentUrl}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Amount Due</div>
              <div className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {formatCurrency(totals.grandTotal, invoice.currency)}
              </div>
            </div>
          </div>

          {portalError && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
            >
              {portalError}
            </div>
          )}

          {/* Pending Verification Banner */}
          {!paidSuccess &&
            invoice.pendingClaims?.some((c) => c.status === 'pending_verification') && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <Clock className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <div className="font-semibold">Remittance Claim Pending Owner Verification</div>
                <p className="mt-0.5 text-[11px]">
                  A payer submitted a manual transfer reference. Verify receipt in your bank or
                  wallet before confirming manual settlement below.
                </p>
              </div>
            </div>
          )}

          {paidSuccess ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-2 dark:border-emerald-800 dark:bg-emerald-950/50">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
              <div className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                Invoice Settled
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                {invoice.paymentVerificationMode === 'gateway_webhook'
                  ? `Verified via gateway webhook for ${invoice.invoiceNumber}.`
                  : `Manual issuer settlement recorded for ${invoice.invoiceNumber}.`}
              </p>
            </div>
          ) : accepted.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
              No payment accounts are enabled on this invoice yet. Enable methods in Create Invoice
              Studio or Payment Gateways.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Available Payment Methods ({accepted.length})
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {accepted.map((acc) => {
                  const active = selectedMethod?.id === acc.id;
                  const st = serverStatuses[acc.providerId];
                  const ready = st?.status === 'verified' || st?.status === 'credentials_configured';
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setSelectedId(acc.id)}
                      className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                        active
                          ? 'border-blue-700 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/50'
                          : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
                        style={{ backgroundColor: acc.accentHex }}
                      >
                        {acc.shortCode}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {acc.providerName}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {st?.status === 'verified'
                            ? 'Live API Verified'
                            : ready
                              ? 'Server Credentials Set'
                              : acc.supportsOnlineCheckout
                                ? 'Requires Server Credentials'
                                : 'Bank / IBAN Remittance'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedMethod && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 dark:border-slate-700 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {selectedMethod.supportsOnlineCheckout ? (
                        <CreditCard className="h-4 w-4 text-blue-700" />
                      ) : (
                        <Landmark className="h-4 w-4 text-blue-700" />
                      )}
                      <span>{selectedMethod.providerName}</span>
                    </div>
                    <span className="text-[11px] text-slate-500">{selectedMethod.region}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-900">
                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-500">{selectedMethod.accountTitle}</div>
                      <div className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {selectedMethod.accountIdentifier}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedMethod.accountIdentifier, selectedMethod.id)}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shrink-0"
                    >
                      {copiedId === selectedMethod.id ? (
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

                  {selectedMethod.supportsOnlineCheckout && !isOnlineConfiguredOrVerified ? (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                      <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        <div className="font-semibold">Online Checkout Configuration Required</div>
                        <p className="mt-0.5 text-[11px] leading-relaxed">
                          Automated gateway settlement requires valid server environment keys and
                          signed webhooks ({selectedServerStatus?.requiredEnvVars.join(', ') || 'API Keys'}).
                          Invoices are never marked Paid until webhook confirmation or manual owner verification.
                        </p>
                      </div>
                    </div>
                  ) : isOnlineConfiguredOrVerified ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                        <div>
                          <div className="font-semibold">
                            {selectedServerStatus?.status === 'verified'
                              ? 'Live Gateway Verified'
                              : 'Server Adapter Configured'}
                          </div>
                          <p className="mt-0.5 text-[11px]">
                            Webhook endpoint <code className="font-mono">{selectedServerStatus?.webhookEndpoint}</code>{' '}
                            marks this invoice Paid upon signed payment event.
                          </p>
                        </div>
                      </div>
                      {selectedMethod.providerId === 'stripe' && selectedServerStatus?.checkoutSupported && (
                        <button
                          type="button"
                          disabled={checkoutLoading}
                          onClick={handleStartStripeCheckout}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 shrink-0"
                        >
                          {checkoutLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ExternalLink className="h-3.5 w-3.5" />
                          )}
                          <span>Open Stripe Checkout</span>
                        </button>
                      )}
                    </div>
                  ) : null}

                  {/* Explicit Owner-Confirmed Offline / Bank Remittance Action */}
                  <div className="border-t border-slate-200 pt-3 space-y-2.5 dark:border-slate-700">
                    <div className="flex items-start gap-1.5 text-[11px] text-slate-500">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>
                        Issuer Manual Recording: Only confirm below after verifying bank transfer or
                        cash receipt outside this app.
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={manualRef}
                        onChange={(e) => setManualRef(e.target.value)}
                        placeholder="Bank / Transaction Ref # (optional)"
                        aria-label="Manual settlement reference"
                        className="flex-1 min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        disabled={manualSaving || invoice.status === 'cancelled'}
                        onClick={handleRecordManual}
                        className="rounded-lg border border-slate-300 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-blue-700 dark:border-blue-600 dark:hover:bg-blue-800 whitespace-nowrap"
                      >
                        {manualSaving ? 'Saving...' : 'Record Manual Payment'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pending Claims & Settlement Audit History (when available on shared snapshot) */}
          {(invoice.pendingClaims?.length || invoice.paymentHistory?.length) ? (
            <div className="border-t border-slate-200 pt-4 space-y-3 dark:border-slate-800">
              {invoice.pendingClaims && invoice.pendingClaims.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Submitted Remittance Claims ({invoice.pendingClaims.length})
                  </div>
                  {invoice.pendingClaims.map((claim) => (
                    <div
                      key={claim.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] dark:border-slate-700 dark:bg-slate-800/40"
                    >
                      <span className="font-semibold">{claim.methodName}</span> &middot; Ref:{' '}
                      <code className="font-mono">{claim.reference}</code>
                      {claim.payerName ? ` · By ${claim.payerName}` : ''}
                      <span className="ml-2 uppercase text-amber-700 dark:text-amber-400">
                        ({claim.status.replace(/_/g, ' ')})
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {invoice.paymentHistory && invoice.paymentHistory.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Payment Audit Log
                  </div>
                  {invoice.paymentHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300"
                    >
                      <span className="font-semibold capitalize">
                        {entry.verificationMode.replace(/_/g, ' ')}
                      </span>
                      {entry.actor ? ` (${entry.actor})` : ''}
                      {entry.reference ? ` · Ref: ${entry.reference}` : ''}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
