import { useState, type ChangeEvent } from 'react';
import {
  Plus,
  Trash2,
  Sparkles,
  Upload,
  Save,
  Eye,
  CheckCircle2,
  Building2,
  UserCheck,
  FileText,
  Palette,
  Stamp,
  StickyNote,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  CreditCard,
  Download,
  Loader2,
} from 'lucide-react';
import type {
  ClientProfile,
  ConnectedPaymentAccount,
  CookieConsentRecord,
  CurrencyCode,
  DateFormatOption,
  FooterStyle,
  HeaderStyle,
  Invoice,
  InvoiceFontStyle,
  InvoiceItem,
  InvoiceNumberConfig,
  InvoiceStatus,
  LogoPlacement,
  SavedBusinessProfile,
  TaxTreatment,
  TemplateId,
} from '../types/invoice';
import { ACCENT_COLOR_PRESETS } from '../data/seedData';
import {
  calculateInvoiceTotals,
  calculateLineItem,
  formatCurrency,
  resolveEffectiveTaxRate,
  suggestNextInvoiceNumber,
} from '../utils/calculations';
import {
  getInvoiceAuthElements,
  syncAuthElementsToInvoice,
  validateUploadedAssetFile,
} from '../utils/authElements';
import {
  loadFunctionalPreference,
  saveFunctionalPreference,
} from '../utils/cookieConsent';
import { downloadInvoicePdf } from '../utils/pdfGenerator';
import { resolveInvoicePaymentAccounts } from '../utils/recurring';
import { InvoiceRenderer } from './InvoiceRenderer';
import { SignatureStampStudio } from './SignatureStampStudio';

interface CreateInvoiceViewProps {
  invoice: Invoice;
  isEditingExisting: boolean;
  existingInvoices: Invoice[];
  clients: ClientProfile[];
  paymentAccounts: ConnectedPaymentAccount[];
  businessProfile: SavedBusinessProfile;
  dateFormat: DateFormatOption;
  numberingConfig?: InvoiceNumberConfig;
  cookieConsent?: CookieConsentRecord | null;
  onChange: (updated: Invoice) => void;
  onSaveInvoice: (invoice: Invoice, statusOverride?: InvoiceStatus) => void;
  onSaveBusinessProfile: (profilePatch: Partial<SavedBusinessProfile>) => void;
  onSaveSignatureToProfile?: (dataUrl: string, label: string) => void;
  onSaveStampToProfile?: (dataUrl: string, label: string) => void;
  onRemoveSavedAsset?: (kind: 'signature' | 'stamp', assetId: string) => void;
  onSaveClientFromInvoice: (customer: Invoice['customer']) => void;
  onNavigateGateways: () => void;
  onOpenPreviewModal: (invoice: Invoice) => void;
  onResetNew: () => void;
}

const CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'PKR', 'AED', 'CAD', 'AUD', 'SAR', 'INR', 'JPY'];

export function CreateInvoiceView({
  invoice,
  isEditingExisting,
  existingInvoices,
  clients,
  paymentAccounts,
  businessProfile,
  dateFormat,
  numberingConfig,
  cookieConsent = null,
  onChange,
  onSaveInvoice,
  onSaveBusinessProfile,
  onSaveSignatureToProfile,
  onSaveStampToProfile,
  onRemoveSavedAsset,
  onSaveClientFromInvoice,
  onNavigateGateways,
  onOpenPreviewModal,
  onResetNew,
}: CreateInvoiceViewProps) {
  const [mobileMode, setMobileMode] = useState<'edit' | 'preview'>('edit');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => ({
    business: true,
    customer: true,
    details: true,
    items: true,
    template: true,
    signature: true,
    payments: true,
    additional: false,
    compactPreview: loadFunctionalPreference<boolean>(cookieConsent, 'compactPreview', false),
  }));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);

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

  const authElements = getInvoiceAuthElements(invoice);

  const connectedAccounts = paymentAccounts.filter((a) => a.connected);
  const activePaymentIds = new Set(
    resolveInvoicePaymentAccounts(invoice, paymentAccounts).map((a) => a.id)
  );

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3200);
  };

  const updateBusiness = (patch: Partial<Invoice['business']>) => {
    onChange({ ...invoice, business: { ...invoice.business, ...patch } });
  };

  const updateCustomer = (patch: Partial<Invoice['customer']>) => {
    setValidationError(null);
    onChange({ ...invoice, customer: { ...invoice.customer, ...patch } });
  };

  const updateDesign = (patch: Partial<Invoice['design']>) => {
    onChange({ ...invoice, design: { ...invoice.design, ...patch } });
  };

  const updateAdditional = (patch: Partial<Invoice['additional']>) => {
    onChange({ ...invoice, additional: { ...invoice.additional, ...patch } });
  };

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateUploadedAssetFile(file);
    if (err) {
      setValidationError(err);
      e.target.value = '';
      return;
    }
    setValidationError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateBusiness({ logoDataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDirectDownloadPdf = async () => {
    setPdfDownloading(true);
    setValidationError(null);
    try {
      await downloadInvoicePdf(invoice, dateFormat, paymentAccounts);
      showStatus(`Downloaded ${invoice.invoiceNumber || 'invoice'}.pdf.`);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Unable to generate PDF.');
    } finally {
      setPdfDownloading(false);
    }
  };

  const addItem = () => {
    const newItem: InvoiceItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description: '',
      quantity: 1,
      unitPrice: 0,
      taxRate: undefined,
    };
    onChange({ ...invoice, items: [...invoice.items, newItem] });
  };

  const updateItem = (id: string, patch: Partial<InvoiceItem>) => {
    onChange({
      ...invoice,
      items: invoice.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    });
  };

  const removeItem = (id: string) => {
    onChange({
      ...invoice,
      items: invoice.items.filter((it) => it.id !== id),
    });
  };

  const validateAndSave = (statusOverride?: InvoiceStatus) => {
    if (!invoice.invoiceNumber.trim()) {
      setValidationError('Please enter an invoice number before saving.');
      setOpenSections((prev) => ({ ...prev, details: true }));
      return;
    }
    if (!invoice.business.name.trim()) {
      setValidationError('Please enter your business or sender name.');
      setOpenSections((prev) => ({ ...prev, business: true }));
      return;
    }
    if (!invoice.customer.name.trim() && !invoice.customer.company.trim()) {
      setValidationError('Please enter a customer name or company name.');
      setOpenSections((prev) => ({ ...prev, customer: true }));
      return;
    }

    setValidationError(null);
    onSaveInvoice(invoice, statusOverride);
    const label =
      statusOverride === 'draft'
        ? 'saved as draft'
        : statusOverride === 'paid'
          ? 'saved and marked as Paid'
          : 'saved';
    showStatus(`Invoice ${invoice.invoiceNumber} ${label}.`);
  };

  return (
    <div className="space-y-5">
      {/* Studio Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 sm:px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {isEditingExisting ? `Editing ${invoice.invoiceNumber}` : 'New Invoice Studio'}
              </h2>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-medium capitalize text-slate-500 dark:text-slate-400">
                {invoice.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live preview updates automatically as you edit fields, templates, and signature placement.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onResetNew}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={handleDirectDownloadPdf}
            disabled={pdfDownloading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap"
          >
            {pdfDownloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>Download PDF</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenPreviewModal(invoice)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Preview &amp; Export</span>
          </button>

          <button
            type="button"
            onClick={() => validateAndSave('draft')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 whitespace-nowrap"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save as Draft</span>
          </button>

          <button
            type="button"
            onClick={() => validateAndSave(invoice.status === 'draft' ? 'unpaid' : invoice.status)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{isEditingExisting ? 'Update Invoice' : 'Save Invoice'}</span>
          </button>
        </div>
      </div>

      {/* Feedback & Validation Alerts */}
      {validationError && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
        >
          {validationError}
        </div>
      )}

      {statusMessage && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"
        >
          {statusMessage}
        </div>
      )}

      {/* Mobile / Tablet Mode Toggle */}
      <div className="flex lg:hidden rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => setMobileMode('edit')}
          className={`flex-1 rounded-md py-2 text-xs font-semibold transition-colors ${
            mobileMode === 'edit'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Edit Invoice
        </button>
        <button
          type="button"
          onClick={() => setMobileMode('preview')}
          className={`flex-1 rounded-md py-2 text-xs font-semibold transition-colors ${
            mobileMode === 'preview'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Live Preview
        </button>
      </div>

      {/* Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANEL: Editor Form */}
        <div
          className={`lg:col-span-6 space-y-4 ${
            mobileMode === 'preview' ? 'hidden lg:block' : 'block'
          }`}
        >
          {/* A. Business Information */}
          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => toggleSection('business')}
              aria-expanded={openSections.business}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <div className="flex items-center gap-2.5">
                <Building2 className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Business Information
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {invoice.business.name || 'Sender details & logo'}
                  </p>
                </div>
              </div>
              {openSections.business ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {openSections.business && (
              <div className="border-t border-slate-200 px-5 py-4 space-y-4 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {invoice.business.logoDataUrl ? (
                      <img
                        src={invoice.business.logoDataUrl}
                        alt="Business logo"
                        className="h-11 w-11 rounded border border-slate-200 bg-white object-contain p-1"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded border border-dashed border-slate-300 text-xs font-semibold text-slate-400">
                        Logo
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <Upload className="h-3.5 w-3.5" />
                        <span>Upload Logo</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={handleLogoUpload}
                        />
                      </label>
                      {invoice.business.logoDataUrl && (
                        <button
                          type="button"
                          onClick={() => updateBusiness({ logoDataUrl: '' })}
                          className="text-xs text-slate-500 hover:text-rose-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        updateBusiness({
                          name: businessProfile.name,
                          logoDataUrl: businessProfile.logoDataUrl,
                          address: businessProfile.address,
                          phone: businessProfile.phone,
                          email: businessProfile.email,
                          website: businessProfile.website,
                          taxNumber: businessProfile.taxNumber,
                        });
                        showStatus('Loaded saved Business Profile details.');
                      }}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300"
                    >
                      Load Default
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        onSaveBusinessProfile({ ...invoice.business });
                        showStatus('Business info saved to Business Profile for future invoices.');
                      }}
                      className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
                    >
                      Save as Default
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="biz-name"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Business / Company Name *
                    </label>
                    <input
                      id="biz-name"
                      type="text"
                      value={invoice.business.name}
                      onChange={(e) => updateBusiness({ name: e.target.value })}
                      placeholder="e.g. Meridian Digital Studio"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="biz-email"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Email Address
                    </label>
                    <input
                      id="biz-email"
                      type="email"
                      value={invoice.business.email}
                      onChange={(e) => updateBusiness({ email: e.target.value })}
                      placeholder="billing@company.com"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="biz-phone"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Phone Number
                    </label>
                    <input
                      id="biz-phone"
                      type="text"
                      value={invoice.business.phone}
                      onChange={(e) => updateBusiness({ phone: e.target.value })}
                      placeholder="+1 (415) 000-0000"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="biz-website"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Website (optional)
                    </label>
                    <input
                      id="biz-website"
                      type="text"
                      value={invoice.business.website}
                      onChange={(e) => updateBusiness({ website: e.target.value })}
                      placeholder="https://company.com"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="biz-tax"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Tax Registration No. (optional)
                    </label>
                    <input
                      id="biz-tax"
                      type="text"
                      value={invoice.business.taxNumber}
                      onChange={(e) => updateBusiness({ taxNumber: e.target.value })}
                      placeholder="EIN / VAT / NTN"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="biz-address"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Business Address
                    </label>
                    <textarea
                      id="biz-address"
                      rows={2}
                      value={invoice.business.address}
                      onChange={(e) => updateBusiness({ address: e.target.value })}
                      placeholder="Street, City, Postal Code, Country"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* B. Customer Information */}
          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => toggleSection('customer')}
              aria-expanded={openSections.customer}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <div className="flex items-center gap-2.5">
                <UserCheck className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Customer Information
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {invoice.customer.company || invoice.customer.name || 'Enter client billing details'}
                  </p>
                </div>
              </div>
              {openSections.customer ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {openSections.customer && (
              <div className="border-t border-slate-200 px-5 py-4 space-y-3 dark:border-slate-800">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <label
                      htmlFor="quick-client-select"
                      className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                    >
                      Select Client from Directory
                    </label>
                    <select
                      id="quick-client-select"
                      value={invoice.clientId ?? ''}
                      onChange={(e) => {
                        const selected = clients.find((c) => c.id === e.target.value);
                        if (selected) {
                          setValidationError(null);
                          onChange({
                            ...invoice,
                            clientId: selected.id,
                            customer: {
                              name: selected.name,
                              company: selected.company,
                              address: selected.address,
                              email: selected.email,
                              phone: selected.phone,
                            },
                          });
                          showStatus(
                            `Pre-filled client details for ${selected.company || selected.name}.`
                          );
                        }
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <option value="">Choose a saved client to pre-fill...</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.company ? `${c.company} — ${c.name}` : c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(invoice.customer.name.trim() || invoice.customer.company.trim()) && (
                    <button
                      type="button"
                      onClick={() => {
                        onSaveClientFromInvoice(invoice.customer);
                        showStatus('Client profile saved to Client Directory.');
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400 whitespace-nowrap"
                    >
                      Save to Clients
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="cust-name"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Customer / Client Name *
                    </label>
                    <input
                      id="cust-name"
                      type="text"
                      value={invoice.customer.name}
                      onChange={(e) => updateCustomer({ name: e.target.value })}
                      placeholder="e.g. Sarah Jenkins"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="cust-company"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Company Name (optional)
                    </label>
                    <input
                      id="cust-company"
                      type="text"
                      value={invoice.customer.company}
                      onChange={(e) => updateCustomer({ company: e.target.value })}
                      placeholder="e.g. Horizon Labs Inc."
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="cust-email"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Email Address
                    </label>
                    <input
                      id="cust-email"
                      type="email"
                      value={invoice.customer.email}
                      onChange={(e) => updateCustomer({ email: e.target.value })}
                      placeholder="accounts@client.com"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="cust-phone"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Phone Number
                    </label>
                    <input
                      id="cust-phone"
                      type="text"
                      value={invoice.customer.phone}
                      onChange={(e) => updateCustomer({ phone: e.target.value })}
                      placeholder="+1 (555) 234-5678"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="cust-address"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Billing Address
                    </label>
                    <textarea
                      id="cust-address"
                      rows={2}
                      value={invoice.customer.address}
                      onChange={(e) => updateCustomer({ address: e.target.value })}
                      placeholder="Client street address, city, postal code"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* C. Invoice Details */}
          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => toggleSection('details')}
              aria-expanded={openSections.details}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <div className="flex items-center gap-2.5">
                <FileText className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Invoice Details
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {invoice.invoiceNumber} · {invoice.currency}
                  </p>
                </div>
              </div>
              {openSections.details ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {openSections.details && (
              <div className="border-t border-slate-200 px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3 dark:border-slate-800">
                <div>
                  <label
                    htmlFor="inv-title"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Invoice Title
                  </label>
                  <input
                    id="inv-title"
                    type="text"
                    value={invoice.title}
                    onChange={(e) => onChange({ ...invoice, title: e.target.value })}
                    placeholder="INVOICE"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="inv-number"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Invoice Number *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const issueYear =
                          Number(invoice.issueDate?.slice(0, 4)) || new Date().getFullYear();
                        const next = suggestNextInvoiceNumber(
                          existingInvoices,
                          issueYear,
                          numberingConfig
                        );
                        onChange({ ...invoice, invoiceNumber: next });
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline dark:text-blue-400"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>Suggest</span>
                    </button>
                  </div>
                  <input
                    id="inv-number"
                    type="text"
                    value={invoice.invoiceNumber}
                    onChange={(e) => {
                      setValidationError(null);
                      onChange({ ...invoice, invoiceNumber: e.target.value });
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="inv-issue-date"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Invoice Date
                  </label>
                  <input
                    id="inv-issue-date"
                    type="date"
                    value={invoice.issueDate}
                    onChange={(e) => onChange({ ...invoice, issueDate: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="inv-due-date"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Due Date
                  </label>
                  <input
                    id="inv-due-date"
                    type="date"
                    value={invoice.dueDate}
                    onChange={(e) => onChange({ ...invoice, dueDate: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="inv-currency"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Currency
                  </label>
                  <select
                    id="inv-currency"
                    value={invoice.currency}
                    onChange={(e) =>
                      onChange({ ...invoice, currency: e.target.value as CurrencyCode })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {CURRENCIES.map((cur) => (
                      <option key={cur} value={cur}>
                        {cur}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="inv-status"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Status
                  </label>
                  <select
                    id="inv-status"
                    value={invoice.status}
                    onChange={(e) =>
                      onChange({ ...invoice, status: e.target.value as InvoiceStatus })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            )}
          </section>

          {/* D. Invoice Items & Totals */}
          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => toggleSection('items')}
              aria-expanded={openSections.items}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Invoice Items & Calculations
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {invoice.items.length} item{invoice.items.length === 1 ? '' : 's'} · Total{' '}
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {formatCurrency(totals.grandTotal, invoice.currency)}
                  </span>
                </p>
              </div>
              {openSections.items ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {openSections.items && (
              <div className="border-t border-slate-200 px-5 py-4 space-y-4 dark:border-slate-800">
                <div className="space-y-3">
                  {invoice.items.map((item, idx) => {
                    const line = calculateLineItem(
                      item,
                      invoice.currency,
                      invoice.invoiceTaxRate ?? 0,
                      invoice.taxTreatment ?? 'after_discount'
                    );
                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2.5 dark:border-slate-700 dark:bg-slate-800/40"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-slate-500">
                            Item #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            aria-label={`Remove item ${idx + 1}`}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>

                        <div>
                          <label
                            htmlFor={`item-desc-${item.id}`}
                            className="block text-[11px] font-medium text-slate-600 dark:text-slate-300"
                          >
                            Item / Service Description
                          </label>
                          <input
                            id={`item-desc-${item.id}`}
                            type="text"
                            value={item.description}
                            onChange={(e) => updateItem(item.id, { description: e.target.value })}
                            placeholder="e.g. UI/UX Design & Prototyping"
                            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          <div>
                            <label
                              htmlFor={`item-qty-${item.id}`}
                              className="block text-[11px] font-medium text-slate-600 dark:text-slate-300"
                            >
                              Qty
                            </label>
                            <input
                              id={`item-qty-${item.id}`}
                              type="number"
                              min="0"
                              step="any"
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem(item.id, { quantity: Math.max(0, Number(e.target.value) || 0) })
                              }
                              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 tabular-nums"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`item-price-${item.id}`}
                              className="block text-[11px] font-medium text-slate-600 dark:text-slate-300"
                            >
                              Unit Price
                            </label>
                            <input
                              id={`item-price-${item.id}`}
                              type="number"
                              min="0"
                              step="any"
                              value={item.unitPrice}
                              onChange={(e) =>
                                updateItem(item.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })
                              }
                              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 tabular-nums"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`item-disc-${item.id}`}
                              className="block text-[11px] font-medium text-slate-600 dark:text-slate-300"
                            >
                              Item Disc.
                            </label>
                            <div className="mt-1 flex">
                              <select
                                aria-label={`Item ${idx + 1} discount type`}
                                value={item.discountType ?? 'percent'}
                                onChange={(e) =>
                                  updateItem(item.id, {
                                    discountType: e.target.value as 'percent' | 'fixed',
                                  })
                                }
                                className="rounded-l-md border border-r-0 border-slate-200 bg-slate-50 px-1 text-[10px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              >
                                <option value="percent">%</option>
                                <option value="fixed">{invoice.currency}</option>
                              </select>
                              <input
                                id={`item-disc-${item.id}`}
                                type="number"
                                min="0"
                                step="any"
                                value={item.discountValue ?? 0}
                                onChange={(e) =>
                                  updateItem(item.id, {
                                    discountValue: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="w-full min-w-0 rounded-r-md border border-slate-200 bg-white px-1.5 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 tabular-nums"
                              />
                            </div>
                          </div>

                          <div>
                            <label
                              htmlFor={`item-tax-${item.id}`}
                              className="block text-[11px] font-medium text-slate-600 dark:text-slate-300"
                            >
                              Tax (%)
                            </label>
                            <input
                              id={`item-tax-${item.id}`}
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              placeholder={String(resolveEffectiveTaxRate(undefined, invoice.invoiceTaxRate ?? 0))}
                              value={item.taxRate ?? ''}
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (raw === '') {
                                  updateItem(item.id, { taxRate: undefined });
                                  return;
                                }
                                const parsed = Number(raw);
                                updateItem(item.id, {
                                  taxRate: Number.isFinite(parsed)
                                    ? Math.max(0, Math.min(100, parsed))
                                    : 0,
                                });
                              }}
                              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 tabular-nums"
                            />
                          </div>

                          <div className="col-span-2 sm:col-span-1">
                            <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                              Line Total
                            </div>
                            <div className="mt-1 flex h-[30px] items-center justify-end rounded-md border border-slate-200/80 bg-white px-2 font-mono text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 tabular-nums">
                              {formatCurrency(line.lineTotal, invoice.currency)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-800/50 dark:text-blue-400 dark:hover:bg-slate-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add New Item</span>
                </button>

                {/* Discount, Tax Rules & Automatic Totals */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor="inv-discount-val"
                        className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                      >
                        Invoice Discount
                      </label>
                      <div className="mt-1 flex items-center gap-2">
                        <select
                          aria-label="Discount type"
                          value={invoice.discountType}
                          onChange={(e) =>
                            onChange({
                              ...invoice,
                              discountType: e.target.value as 'percent' | 'fixed',
                            })
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        >
                          <option value="percent">%</option>
                          <option value="fixed">{invoice.currency}</option>
                        </select>
                        <input
                          id="inv-discount-val"
                          type="number"
                          min="0"
                          step="any"
                          value={invoice.discountValue}
                          onChange={(e) =>
                            onChange({
                              ...invoice,
                              discountValue: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label
                          htmlFor="inv-tax-treatment"
                          className="block text-[11px] font-medium text-slate-600 dark:text-slate-300"
                        >
                          Tax Rule
                        </label>
                        <select
                          id="inv-tax-treatment"
                          value={invoice.taxTreatment ?? 'after_discount'}
                          onChange={(e) =>
                            onChange({
                              ...invoice,
                              taxTreatment: e.target.value as TaxTreatment,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        >
                          <option value="after_discount">After Discount</option>
                          <option value="before_discount">Before Discount</option>
                          <option value="tax_inclusive">Tax-Inclusive</option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="inv-fallback-tax"
                          className="block text-[11px] font-medium text-slate-600 dark:text-slate-300"
                        >
                          Fallback Tax (%)
                        </label>
                        <input
                          id="inv-fallback-tax"
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          value={invoice.invoiceTaxRate ?? 0}
                          onChange={(e) =>
                            onChange({
                              ...invoice,
                              invoiceTaxRate: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 tabular-nums"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/40">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Subtotal</span>
                      <span className="font-mono font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                        {formatCurrency(totals.subtotal, invoice.currency)}
                      </span>
                    </div>
                    {totals.discountAmount > 0 && (
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Discount</span>
                        <span className="font-mono font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                          -{formatCurrency(totals.discountAmount, invoice.currency)}
                        </span>
                      </div>
                    )}
                    {totals.taxBreakdown.length > 0 ? (
                      totals.taxBreakdown.map((tb) => (
                        <div key={tb.rate} className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Tax ({tb.rate}%)</span>
                          <span className="font-mono font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                            {formatCurrency(tb.taxAmount, invoice.currency)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Tax</span>
                        <span className="font-mono font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                          {formatCurrency(totals.taxTotal, invoice.currency)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-900 dark:border-slate-700 dark:text-slate-100">
                      <span>Grand Total</span>
                      <span className="font-mono text-sm text-blue-700 dark:text-blue-400 tabular-nums">
                        {formatCurrency(totals.grandTotal, invoice.currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* E. Template & Customization */}
          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => toggleSection('template')}
              aria-expanded={openSections.template}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <div className="flex items-center gap-2.5">
                <Palette className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Template & Brand Customization
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                    {invoice.design.template} template · {invoice.design.fontStyle} typography
                  </p>
                </div>
              </div>
              {openSections.template ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {openSections.template && (
              <div className="border-t border-slate-200 px-5 py-4 space-y-4 dark:border-slate-800">
                <div>
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Select Template
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {(
                      [
                        { id: 'modern', name: 'Modern', desc: 'Corporate bold' },
                        { id: 'classic', name: 'Classic', desc: 'Formal ledger' },
                        { id: 'minimal', name: 'Minimal', desc: 'Clean editorial' },
                      ] as { id: TemplateId; name: string; desc: string }[]
                    ).map((tpl) => {
                      const active = invoice.design.template === tpl.id;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => updateDesign({ template: tpl.id })}
                          className={`rounded-lg border p-2.5 text-left transition-colors ${
                            active
                              ? 'border-blue-700 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/50'
                              : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {tpl.name}
                          </div>
                          <div className="text-[11px] text-slate-500">{tpl.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Brand Accent Color
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {ACCENT_COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        aria-label={`Set accent color ${preset.name}`}
                        onClick={() => updateDesign({ accentColor: preset.value })}
                        className={`h-7 w-7 rounded-md border transition-transform ${
                          invoice.design.accentColor.toLowerCase() === preset.value.toLowerCase()
                            ? 'scale-105 border-slate-900 ring-2 ring-blue-500/30 dark:border-white'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                        style={{ backgroundColor: preset.value }}
                      />
                    ))}
                    <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                      <span>Custom</span>
                      <input
                        type="color"
                        aria-label="Custom brand accent color"
                        value={invoice.design.accentColor}
                        onChange={(e) => updateDesign({ accentColor: e.target.value })}
                        className="h-4 w-5 cursor-pointer border-0 bg-transparent p-0"
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label
                      htmlFor="design-font"
                      className="block text-[11px] font-medium text-slate-600 dark:text-slate-300"
                    >
                      Font Style
                    </label>
                    <select
                      id="design-font"
                      value={invoice.design.fontStyle}
                      onChange={(e) =>
                        updateDesign({ fontStyle: e.target.value as InvoiceFontStyle })
                      }
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="sans">Modern Sans</option>
                      <option value="serif">Formal Serif</option>
                      <option value="mono">Technical Mono</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="design-logo-pos"
                      className="block text-[11px] font-medium text-slate-600 dark:text-slate-300"
                    >
                      Logo Placement
                    </label>
                    <select
                      id="design-logo-pos"
                      value={invoice.design.logoPlacement}
                      onChange={(e) =>
                        updateDesign({ logoPlacement: e.target.value as LogoPlacement })
                      }
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="design-header"
                      className="block text-[11px] font-medium text-slate-600 dark:text-slate-300"
                    >
                      Header Style
                    </label>
                    <select
                      id="design-header"
                      value={invoice.design.headerStyle}
                      onChange={(e) =>
                        updateDesign({ headerStyle: e.target.value as HeaderStyle })
                      }
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="clean">Clean</option>
                      <option value="tinted">Tinted</option>
                      <option value="bordered">Bordered</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="design-footer"
                      className="block text-[11px] font-medium text-slate-600 dark:text-slate-300"
                    >
                      Footer Style
                    </label>
                    <select
                      id="design-footer"
                      value={invoice.design.footerStyle}
                      onChange={(e) =>
                        updateDesign({ footerStyle: e.target.value as FooterStyle })
                      }
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="detailed">Detailed</option>
                      <option value="minimal">Minimal</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* F. Signature & Stamp Studio */}
          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => toggleSection('signature')}
              aria-expanded={openSections.signature}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <div className="flex items-center gap-2.5">
                <Stamp className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Signature & Stamp Studio
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Draw or upload signature · Upload, size & position company seal
                  </p>
                </div>
              </div>
              {openSections.signature ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {openSections.signature && (
              <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
                <SignatureStampStudio
                  elements={authElements}
                  selectedElementId={selectedElementId}
                  onSelectElementId={setSelectedElementId}
                  businessProfile={businessProfile}
                  onElementsChange={(next) => onChange(syncAuthElementsToInvoice(invoice, next))}
                  onSaveSignatureToProfile={(dataUrl, label) => {
                    if (onSaveSignatureToProfile) {
                      onSaveSignatureToProfile(dataUrl, label);
                    } else {
                      onSaveBusinessProfile({
                        savedSignatureDataUrl: dataUrl,
                        savedSignatureLabel: label,
                      });
                    }
                  }}
                  onSaveStampToProfile={(dataUrl, label) => {
                    if (onSaveStampToProfile) {
                      onSaveStampToProfile(dataUrl, label);
                    } else {
                      onSaveBusinessProfile({
                        savedStampDataUrl: dataUrl,
                        savedStampLabel: label,
                      });
                    }
                  }}
                  onRemoveSavedAsset={onRemoveSavedAsset}
                />
              </div>
            )}
          </section>

          {/* G. Accepted Payment Methods & Gateways */}
          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => toggleSection('payments')}
              aria-expanded={openSections.payments}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <div className="flex items-center gap-2.5">
                <CreditCard className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Payment Gateways & Accepted Methods
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {activePaymentIds.size} method{activePaymentIds.size === 1 ? '' : 's'} offered on this invoice
                  </p>
                </div>
              </div>
              {openSections.payments ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {openSections.payments && (
              <div className="border-t border-slate-200 px-5 py-4 space-y-3 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    Select which connected gateways or bank accounts appear on this invoice:
                  </span>
                  <button
                    type="button"
                    onClick={onNavigateGateways}
                    className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400 whitespace-nowrap"
                  >
                    Connect Gateways
                  </button>
                </div>

                {connectedAccounts.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
                    No payment accounts connected yet. Click &ldquo;Connect Gateways&rdquo; to add Stripe, PayPal, SadaPay, Meezan, UBL, HBL, or any bank.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {connectedAccounts.map((acc) => {
                      const selected = activePaymentIds.has(acc.id);
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            const current = Array.from(activePaymentIds);
                            const next = selected
                              ? current.filter((id) => id !== acc.id)
                              : [...current, acc.id];
                            onChange({ ...invoice, enabledPaymentIds: next });
                          }}
                          className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
                            selected
                              ? 'border-blue-600 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/50'
                              : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <span
                            className="flex h-6 w-8 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white"
                            style={{ backgroundColor: acc.accentHex }}
                          >
                            {acc.shortCode}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {acc.providerName}
                            </div>
                            <div className="font-mono text-[10px] text-slate-500 truncate">
                              {acc.accountIdentifier}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* H. Additional Information (Optional) */}
          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => toggleSection('additional')}
              aria-expanded={openSections.additional}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <div className="flex items-center gap-2.5">
                <StickyNote className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Additional Information (Optional)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Payment instructions, bank details, notes, terms & custom footer
                  </p>
                </div>
              </div>
              {openSections.additional ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {openSections.additional && (
              <div className="border-t border-slate-200 px-5 py-4 space-y-3 dark:border-slate-800">
                <div>
                  <label
                    htmlFor="add-payment"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Payment Instructions
                  </label>
                  <input
                    id="add-payment"
                    type="text"
                    value={invoice.additional.paymentInstructions}
                    onChange={(e) => updateAdditional({ paymentInstructions: e.target.value })}
                    placeholder="e.g. Please pay via ACH or wire transfer within 14 days."
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="add-bank"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Bank Details
                  </label>
                  <textarea
                    id="add-bank"
                    rows={2}
                    value={invoice.additional.bankDetails}
                    onChange={(e) => updateAdditional({ bankDetails: e.target.value })}
                    placeholder="Bank Name, Routing / IBAN, Account Number"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="add-notes"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Notes
                  </label>
                  <textarea
                    id="add-notes"
                    rows={2}
                    value={invoice.additional.notes}
                    onChange={(e) => updateAdditional({ notes: e.target.value })}
                    placeholder="Thank you note or project reference"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="add-terms"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Terms & Conditions
                  </label>
                  <textarea
                    id="add-terms"
                    rows={2}
                    value={invoice.additional.terms}
                    onChange={(e) => updateAdditional({ terms: e.target.value })}
                    placeholder="Payment terms, late fee policy, or validity"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="add-footer"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Custom Footer Message
                  </label>
                  <input
                    id="add-footer"
                    type="text"
                    value={invoice.additional.footerMessage}
                    onChange={(e) => updateAdditional({ footerMessage: e.target.value })}
                    placeholder="Custom footer line"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="add-internal-notes"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Internal Private Notes (Creator Only)
                  </label>
                  <textarea
                    id="add-internal-notes"
                    rows={2}
                    value={invoice.additional.internalNotes ?? ''}
                    onChange={(e) => updateAdditional({ internalNotes: e.target.value })}
                    placeholder="Private memo — stripped from client share links and PDFs"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT PANEL: Real-Time Interactive Invoice Preview */}
        <div
          className={`lg:col-span-6 lg:sticky lg:top-20 ${
            mobileMode === 'edit' ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className="rounded-xl border border-slate-200 bg-slate-100/80 p-3 sm:p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Real-Time Document Preview
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                <span>
                  Template:{' '}
                  <span className="font-medium capitalize text-slate-700 dark:text-slate-200">
                    {invoice.design.template}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !openSections.compactPreview;
                    saveFunctionalPreference(cookieConsent, 'compactPreview', nextVal);
                    setOpenSections((prev) => ({
                      ...prev,
                      compactPreview: nextVal,
                    }));
                  }}
                  className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {openSections.compactPreview ? '100% View' : 'Compact Fit'}
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg shadow-sm">
              <InvoiceRenderer
                invoice={invoice}
                dateFormat={dateFormat}
                paymentAccounts={paymentAccounts}
                interactive={true}
                selectedElementId={selectedElementId}
                onSelectElementId={setSelectedElementId}
                compact={Boolean(openSections.compactPreview)}
                printableId="studio-live-preview"
                onAuthElementsChange={(next) => onChange(syncAuthElementsToInvoice(invoice, next))}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
