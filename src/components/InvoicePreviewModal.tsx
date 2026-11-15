import { useEffect, useState } from 'react';
import {
  X,
  Printer,
  Download,
  CheckCircle2,
  Share2,
  FileEdit,
  Check,
  CreditCard,
  Copy,
  FileText,
  Loader2,
  ShieldOff,
  RotateCcw,
} from 'lucide-react';
import type { ConnectedPaymentAccount, DateFormatOption, Invoice } from '../types/invoice';
import { OwnerAuthError, ownerFetch } from '../utils/apiClient';
import { downloadInvoicePdf, generateInvoicePdfBlob } from '../utils/pdfGenerator';
import { buildDirectPaymentUrl } from '../utils/recurring';
import { InvoiceRenderer } from './InvoiceRenderer';
import { StatusLabel } from './StatusLabel';

interface InvoicePreviewModalProps {
  invoice: Invoice;
  dateFormat: DateFormatOption;
  paymentAccounts: ConnectedPaymentAccount[];
  onClose: () => void;
  onMarkPaid: (id: string) => void;
  onSaveDraft: (id: string) => void;
  onEdit: (invoice: Invoice) => void;
  onOpenPaymentPortal: (invoice: Invoice) => void;
  onUpdateInvoiceShare?: (
    invoiceId: string,
    patch: Partial<Pick<Invoice, 'shareToken' | 'shareEnabled' | 'shareExpiresAt' | 'paymentLink'>>
  ) => void;
  onRequireOwnerAuth?: (reason: string) => void;
}

export function InvoicePreviewModal({
  invoice,
  dateFormat,
  paymentAccounts,
  onClose,
  onMarkPaid,
  onSaveDraft,
  onEdit,
  onOpenPaymentPortal,
  onUpdateInvoiceShare,
  onRequireOwnerAuth,
}: InvoicePreviewModalProps) {
  const [feedback, setFeedback] = useState<{ type: 'info' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [expiryDays, setExpiryDays] = useState<string>('30');

  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfPreviewMode, setPdfPreviewMode] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfGeneratingPreview, setPdfGeneratingPreview] = useState(false);

  const directPaymentLink =
    invoice.paymentLink ||
    buildDirectPaymentUrl(
      invoice.invoiceNumber,
      typeof window !== 'undefined' ? window.location.origin : '',
      invoice.shareToken
    );

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);

  const showToast = (text: string, type: 'info' | 'error' = 'info') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handlePrint = () => {
    setPdfPreviewMode(false);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleDownloadPdf = async () => {
    setPdfDownloading(true);
    try {
      const filename = await downloadInvoicePdf(invoice, dateFormat, paymentAccounts);
      showToast(`Downloaded ${filename} (multi-page vector PDF).`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to generate PDF document.',
        'error'
      );
    } finally {
      setPdfDownloading(false);
    }
  };

  const handleTogglePdfPreview = async () => {
    if (pdfPreviewMode) {
      setPdfPreviewMode(false);
      return;
    }
    setPdfGeneratingPreview(true);
    try {
      const { blob } = await generateInvoicePdfBlob(invoice, dateFormat, paymentAccounts);
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
      }
      const nextUrl = URL.createObjectURL(blob);
      setPdfPreviewUrl(nextUrl);
      setPdfPreviewMode(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to render PDF preview.',
        'error'
      );
    } finally {
      setPdfGeneratingPreview(false);
    }
  };

  const handlePublishShareLink = async () => {
    setShareOpen(true);
    setShareLoading(true);
    try {
      const days = Number(expiryDays);
      const expiresAt =
        Number.isFinite(days) && days > 0
          ? new Date(Date.now() + days * 86400_000).toISOString()
          : undefined;

      const res = await ownerFetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice,
          paymentAccounts,
          expiresAt,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        shareToken?: string;
        shareUrl?: string;
        expiresAt?: string;
        error?: string;
      };
      if (!res.ok || !body.shareToken || !body.shareUrl) {
        throw new Error(body.error || 'Share server returned an unexpected response.');
      }
      if (onUpdateInvoiceShare) {
        onUpdateInvoiceShare(invoice.id, {
          shareToken: body.shareToken,
          shareEnabled: true,
          shareExpiresAt: body.expiresAt,
          paymentLink: body.shareUrl,
        });
      }
      try {
        await navigator.clipboard.writeText(body.shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        showToast('Cross-device share link published and copied to clipboard.');
      } catch {
        showToast('Cross-device share link published below.');
      }
    } catch (err) {
      if (err instanceof OwnerAuthError && onRequireOwnerAuth) {
        onRequireOwnerAuth('Sign in as workspace owner to publish a cross-device share link.');
      } else {
        showToast(
          err instanceof Error
            ? `Server share unavailable (${err.message}).`
            : 'Could not publish share link to server.',
          'error'
        );
      }
    } finally {
      setShareLoading(false);
    }
  };

  const handleToggleRevokeShare = async () => {
    if (!invoice.shareToken) return;
    setShareLoading(true);
    const nextRevoked = invoice.shareEnabled !== false;
    try {
      const res = await ownerFetch(`/api/shares/${encodeURIComponent(invoice.shareToken)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revoked: nextRevoked }),
      });
      if (!res.ok) {
        throw new Error('Failed to update share state.');
      }
      if (onUpdateInvoiceShare) {
        onUpdateInvoiceShare(invoice.id, { shareEnabled: !nextRevoked });
      }
      showToast(
        nextRevoked
          ? 'Share link revoked. External recipients can no longer view it.'
          : 'Share link re-enabled.'
      );
    } catch (err) {
      if (err instanceof OwnerAuthError && onRequireOwnerAuth) {
        onRequireOwnerAuth('Sign in as workspace owner to revoke or re-enable share links.');
      } else {
        showToast(err instanceof Error ? err.message : 'Unable to update share link.', 'error');
      }
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(directPaymentLink);
      setCopied(true);
      showToast('Shareable invoice link copied to clipboard.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('Shareable link displayed below.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Invoice Preview ${invoice.invoiceNumber}`}
      className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 backdrop-blur-[2px]"
    >
      {/* Modal Action Header */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {invoice.invoiceNumber}
          </span>
          <StatusLabel status={invoice.status} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(invoice)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap"
          >
            <FileEdit className="h-3.5 w-3.5" />
            <span>Edit</span>
          </button>

          {invoice.status !== 'draft' && (
            <button
              type="button"
              onClick={() => {
                onSaveDraft(invoice.id);
                showToast('Invoice moved to Draft status.');
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap"
            >
              <span>Save as Draft</span>
            </button>
          )}

          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <button
              type="button"
              onClick={() => {
                onMarkPaid(invoice.id);
                showToast('Invoice marked as Paid (Manual confirmation).');
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 whitespace-nowrap"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Mark Paid</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenPaymentPortal(invoice)}
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300 whitespace-nowrap"
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>Pay Portal</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!shareOpen) {
                handlePublishShareLink();
              } else {
                setShareOpen(false);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Share2 className="h-3.5 w-3.5" />
            )}
            <span>Share Link</span>
          </button>

          <button
            type="button"
            disabled={pdfGeneratingPreview}
            onClick={handleTogglePdfPreview}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              pdfPreviewMode
                ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            {pdfGeneratingPreview ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            <span>{pdfPreviewMode ? 'Document View' : 'Preview PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Invoice</span>
          </button>

          <button
            type="button"
            disabled={pdfDownloading}
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap"
          >
            {pdfDownloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>{pdfDownloading ? 'Generating...' : 'Download PDF'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close invoice preview"
            className="ml-1 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Backend-Backed Cross-Device Share Drawer */}
      {shareOpen && (
        <div className="no-print border-b border-slate-200 bg-slate-50 px-4 sm:px-6 py-3 dark:border-slate-800 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-[820px] flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <span>Cross-Device Public Share Link</span>
                {invoice.shareToken && (
                  <span
                    className={`font-semibold ${
                      invoice.shareEnabled === false ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    &middot; {invoice.shareEnabled === false ? 'Revoked' : 'Active'}
                  </span>
                )}
              </div>
              <div className="font-mono text-xs text-slate-800 dark:text-slate-200 truncate">
                {directPaymentLink}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                aria-label="Share link expiration"
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="7">Expires in 7 days</option>
                <option value="30">Expires in 30 days</option>
                <option value="90">Expires in 90 days</option>
                <option value="0">No expiration</option>
              </select>

              <button
                type="button"
                disabled={shareLoading}
                onClick={handlePublishShareLink}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {shareLoading ? 'Syncing...' : 'Refresh / Publish'}
              </button>

              <button
                type="button"
                onClick={handleCopyShareLink}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>{copied ? 'Copied' : 'Copy Link'}</span>
              </button>

              {invoice.shareToken && (
                <button
                  type="button"
                  disabled={shareLoading}
                  onClick={handleToggleRevokeShare}
                  className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                    invoice.shareEnabled === false
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-rose-200 bg-rose-50 text-rose-700'
                  }`}
                >
                  {invoice.shareEnabled === false ? (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Re-enable</span>
                    </>
                  ) : (
                    <>
                      <ShieldOff className="h-3.5 w-3.5" />
                      <span>Revoke</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`no-print border-b px-6 py-2 text-center text-xs font-medium ${
            feedback.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/70 dark:text-rose-200'
              : 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/70 dark:text-blue-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Document or Embedded PDF Preview Viewport */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="mx-auto max-w-[820px]">
          {pdfPreviewMode && pdfPreviewUrl ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-xs text-slate-600">
                <span>Generated Vector PDF Preview</span>
                <button
                  type="button"
                  onClick={() => setPdfPreviewMode(false)}
                  className="font-medium text-blue-700 hover:underline"
                >
                  Return to HTML Document View
                </button>
              </div>
              <iframe
                title={`PDF Preview for ${invoice.invoiceNumber}`}
                src={pdfPreviewUrl}
                className="h-[75vh] w-full border-0"
              />
            </div>
          ) : (
            <InvoiceRenderer
              invoice={invoice}
              dateFormat={dateFormat}
              paymentAccounts={paymentAccounts}
              interactive={false}
              printableId="printable-invoice-root"
            />
          )}
        </div>
      </div>
    </div>
  );
}
