export type NavSection =
  | 'dashboard'
  | 'create'
  | 'invoices'
  | 'recurring'
  | 'clients'
  | 'gateways'
  | 'templates'
  | 'profile'
  | 'settings'
  | 'about'
  | 'license'
  | 'privacy'
  | 'terms';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'unpaid' | 'overdue' | 'cancelled';

export type TaxTreatment = 'after_discount' | 'before_discount' | 'tax_inclusive';

export type CurrencyCode =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'PKR'
  | 'AED'
  | 'CAD'
  | 'AUD'
  | 'SAR'
  | 'INR'
  | 'JPY';

export type TemplateId = 'modern' | 'classic' | 'minimal';

export type InvoiceFontStyle = 'sans' | 'serif' | 'mono';

export type LogoPlacement = 'left' | 'center' | 'right';

export type HeaderStyle = 'clean' | 'tinted' | 'bordered';

export type FooterStyle = 'minimal' | 'detailed' | 'hidden';

export type DateFormatOption = 'DD MMM YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type RecurringStatus = 'active' | 'paused' | 'cancelled' | 'completed';

export type RecurringDeliveryStatus =
  | 'generated'
  | 'queued'
  | 'sending'
  | 'accepted_by_smtp'
  | 'delivery_confirmation_unavailable'
  | 'failed'
  | 'cancelled'
  | 'setup_required'
  | 'sent';

export type PaymentProviderCategory = 'global' | 'wallet' | 'bank' | 'custom_bank';

export type PaymentConnectionStatus =
  | 'not_configured'
  | 'credentials_configured'
  | 'verification_pending'
  | 'verified'
  | 'unavailable';

export type CookieConsentCategory = 'necessary' | 'functional' | 'analytics' | 'marketing';

export interface CookieConsentPreferences {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

export interface CookieConsentRecord {
  version: string;
  updatedAt: string;
  preferences: CookieConsentPreferences;
}

export interface InvoiceNumberConfig {
  prefix: string;
  resetYearly: boolean;
  padLength: number;
}

export interface BusinessInfo {
  name: string;
  logoDataUrl: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  taxNumber: string;
}

export interface CustomerInfo {
  name: string;
  company: string;
  address: string;
  email: string;
  phone: string;
}

export interface ClientProfile extends CustomerInfo {
  id: string;
  notes?: string;
  createdAt: string;
}

export interface PaymentProviderDef {
  id: string;
  name: string;
  shortCode: string;
  category: PaymentProviderCategory;
  region: string;
  supportsOnlineCheckout: boolean;
  accountLabel: string;
  accountPlaceholder: string;
  secondaryLabel?: string;
  secondaryPlaceholder?: string;
  accentHex: string;
}

export interface PaymentProviderServerStatus {
  providerId: string;
  status: PaymentConnectionStatus;
  mode: 'live_api' | 'sandbox_api' | 'manual_instructions' | 'unconfigured';
  webhookSupported: boolean;
  checkoutSupported: boolean;
  requiredEnvVars: string[];
  configuredEnvVars: string[];
  setupSummary: string;
  webhookEndpoint: string;
  lastCheckedAt: string;
  errorDetail?: string;
}

export interface ConnectedPaymentAccount {
  id: string;
  providerId: string;
  providerName: string;
  shortCode: string;
  category: PaymentProviderCategory;
  supportsOnlineCheckout: boolean;
  connected: boolean;
  connectionStatus?: PaymentConnectionStatus;
  enabledByDefault: boolean;
  accountTitle: string;
  accountIdentifier: string;
  secondaryDetail?: string;
  region: string;
  accentHex: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** Undefined/null inherits invoice.invoiceTaxRate; explicit 0 means strictly 0% zero-rated. */
  taxRate?: number;
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
}

export interface SignatureConfig {
  enabled: boolean;
  dataUrl: string;
  label: string;
  x: number;
  y: number;
  width: number;
  rotation?: number;
}

export interface StampConfig {
  enabled: boolean;
  dataUrl: string;
  label: string;
  x: number;
  y: number;
  size: number;
  opacity: number;
  rotation?: number;
}

export interface AuthPlacementElement {
  id: string;
  kind: 'signature' | 'stamp';
  enabled: boolean;
  dataUrl: string;
  label: string;
  x: number;
  y: number;
  width: number;
  rotation: number;
  opacity: number;
  zIndex: number;
}

export interface InvoiceDesignConfig {
  template: TemplateId;
  accentColor: string;
  fontStyle: InvoiceFontStyle;
  logoPlacement: LogoPlacement;
  headerStyle: HeaderStyle;
  footerStyle: FooterStyle;
}

export interface InvoiceAdditionalInfo {
  paymentInstructions: string;
  bankDetails: string;
  notes: string;
  internalNotes?: string;
  terms: string;
  footerMessage: string;
}

export interface PaymentAuditEntry {
  id: string;
  action: 'claim_submitted' | 'manual_confirmed' | 'gateway_webhook_paid' | 'status_changed';
  actor: string;
  verificationMode: 'manual' | 'gateway_webhook' | 'client_claim';
  reference?: string;
  timestamp: string;
  amount?: number;
  currency?: CurrencyCode;
  note?: string;
}

export interface PaymentClaim {
  id: string;
  payerName: string;
  payerEmail?: string;
  methodName: string;
  reference: string;
  submittedAt: string;
  status: 'pending_verification' | 'confirmed' | 'rejected';
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  title: string;
  issueDate: string;
  dueDate: string;
  currency: CurrencyCode;
  status: InvoiceStatus;
  clientId?: string;
  business: BusinessInfo;
  customer: CustomerInfo;
  items: InvoiceItem[];
  discountType: 'percent' | 'fixed';
  discountValue: number;
  taxTreatment?: TaxTreatment;
  invoiceTaxRate?: number;
  additional: InvoiceAdditionalInfo;
  design: InvoiceDesignConfig;
  signature: SignatureConfig;
  stamp: StampConfig;
  authElements?: AuthPlacementElement[];
  enabledPaymentIds?: string[];
  paymentLink?: string;
  shareToken?: string;
  shareEnabled?: boolean;
  shareExpiresAt?: string;
  recurringScheduleId?: string;
  deliveryStatus?: RecurringDeliveryStatus;
  deliveryError?: string;
  paymentVerificationMode?: 'manual' | 'gateway_webhook';
  paidAt?: string;
  paymentTransactionId?: string;
  paymentHistory?: PaymentAuditEntry[];
  pendingClaims?: PaymentClaim[];
  updatedAt: string;
}

export interface RecurringDeliveryLog {
  id: string;
  scheduleId: string;
  invoiceId: string;
  invoiceNumber: string;
  scheduledDate: string;
  dispatchedAt: string;
  status: RecurringDeliveryStatus;
  detail: string;
  recipientEmail?: string;
  attempts?: number;
}

export interface RecurringInvoiceSchedule {
  id: string;
  name: string;
  frequency: RecurringFrequency;
  startDate: string;
  endDate: string;
  nextRunDate: string;
  lastGeneratedDate?: string;
  lastDeliveryStatus?: RecurringDeliveryStatus;
  lastDeliveryDetail?: string;
  status: RecurringStatus;
  autoSend: boolean;
  dueDaysAfterIssue: number;
  generatedCount: number;
  templateSnapshot: {
    title: string;
    currency: CurrencyCode;
    customer: CustomerInfo;
    clientId?: string;
    items: InvoiceItem[];
    discountType: 'percent' | 'fixed';
    discountValue: number;
    taxTreatment?: TaxTreatment;
    invoiceTaxRate?: number;
    additional: InvoiceAdditionalInfo;
    design: InvoiceDesignConfig;
    enabledPaymentIds: string[];
  };
  createdAt: string;
}

export interface SavedAssetItem {
  id: string;
  kind: 'signature' | 'stamp';
  label: string;
  dataUrl: string;
  createdAt: string;
}

export interface SavedBusinessProfile extends BusinessInfo {
  defaultCurrency: CurrencyCode;
  savedSignatureDataUrl: string;
  savedSignatureLabel: string;
  savedStampDataUrl: string;
  savedStampLabel: string;
  savedSignatures?: SavedAssetItem[];
  savedStamps?: SavedAssetItem[];
}

export interface AppSettings {
  userName: string;
  userRole: string;
  userEmail: string;
  defaultCurrency: CurrencyCode;
  dateFormat: DateFormatOption;
  theme: 'light' | 'dark';
  language: 'English (US)' | 'English (UK)' | 'Arabic (Concept)' | 'French (Concept)';
  numberingConfig?: InvoiceNumberConfig;
}

export interface OwnerSessionStatus {
  authenticated: boolean;
  ownerEmail?: string;
  csrfToken?: string;
  authMode: 'single_owner_session';
  devBootstrapPasswordNotice?: string;
}
