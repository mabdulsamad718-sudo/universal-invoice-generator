import type {
  AppSettings,
  Invoice,
  SavedBusinessProfile,
} from '../types/invoice';

// Crisp inline SVG data URLs so sample logo, signature, and seal work offline with zero broken external URLs
export const SAMPLE_LOGO_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" fill="none">
      <rect width="120" height="120" rx="20" fill="#0F172A"/>
      <path d="M32 84V36H46L60 60L74 36H88V84H76V55L63.5 76H56.5L44 55V84H32Z" fill="#FFFFFF"/>
      <rect x="32" y="92" width="56" height="4" rx="2" fill="#3B82F6"/>
    </svg>`
  );

export const SAMPLE_SIGNATURE_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="110" viewBox="0 0 320 110" fill="none">
      <path d="M24 76C38 42 52 20 60 22C68 24 54 68 62 72C70 76 92 38 102 40C112 42 98 70 112 68C126 66 136 44 148 48C160 52 146 72 162 68C178 64 198 30 208 26C218 22 192 74 206 72C220 70 234 52 248 54C262 56 268 66 296 60" stroke="#0F172A" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M36 86C96 78 214 76 286 80" stroke="#1D4ED8" stroke-width="1.8" stroke-linecap="round" opacity="0.65"/>
    </svg>`
  );

export const SAMPLE_STAMP_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200" fill="none">
      <circle cx="100" cy="100" r="90" stroke="#1D4ED8" stroke-width="4" opacity="0.88"/>
      <circle cx="100" cy="100" r="80" stroke="#1D4ED8" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.75"/>
      <circle cx="100" cy="100" r="54" stroke="#1D4ED8" stroke-width="2" opacity="0.85"/>
      <path id="topArc" d="M 32,100 A 68,68 0 1,1 168,100" fill="none"/>
      <path id="botArc" d="M 168,100 A 68,68 0 1,1 32,100" fill="none"/>
      <text fill="#1D4ED8" font-family="sans-serif" font-size="11.5" font-weight="700" letter-spacing="2.4">
        <textPath href="#topArc" startOffset="50%" text-anchor="middle">MERIDIAN STUDIO</textPath>
      </text>
      <text fill="#1D4ED8" font-family="sans-serif" font-size="10" font-weight="600" letter-spacing="2">
        <textPath href="#botArc" startOffset="50%" text-anchor="middle">AUTHORIZED SEAL</textPath>
      </text>
      <text x="100" y="96" text-anchor="middle" fill="#1D4ED8" font-family="sans-serif" font-size="12" font-weight="700" letter-spacing="1.5">APPROVED</text>
      <text x="100" y="114" text-anchor="middle" fill="#1D4ED8" font-family="monospace" font-size="9.5" font-weight="600">BILLING DEPT</text>
    </svg>`
  );

export const DEFAULT_BUSINESS_PROFILE: SavedBusinessProfile = {
  name: 'Meridian Digital Studio',
  logoDataUrl: SAMPLE_LOGO_DATA_URL,
  address: '420 Montgomery Street, Suite 600\nSan Francisco, CA 94104',
  phone: '+1 (415) 890-4420',
  email: 'billing@meridianstudio.co',
  website: 'https://meridianstudio.co',
  taxNumber: 'EIN 84-3910284',
  defaultCurrency: 'USD',
  savedSignatureDataUrl: SAMPLE_SIGNATURE_DATA_URL,
  savedSignatureLabel: 'Authorized Signature',
  savedStampDataUrl: SAMPLE_STAMP_DATA_URL,
  savedStampLabel: 'Company Stamp',
};

export const DEFAULT_SETTINGS: AppSettings = {
  userName: 'Muhammad Abdul Samad Tariq',
  userRole: 'CEO & Founder',
  userEmail: 'billing@meridianstudio.co',
  defaultCurrency: 'USD',
  dateFormat: 'DD MMM YYYY',
  theme: 'light',
  language: 'English (US)',
  numberingConfig: {
    prefix: 'INV-',
    resetYearly: true,
    padLength: 3,
  },
};

export const ACCENT_COLOR_PRESETS = [
  { name: 'Cobalt Blue', value: '#1D4ED8' },
  { name: 'Deep Navy', value: '#0F172A' },
  { name: 'Emerald', value: '#047857' },
  { name: 'Slate Indigo', value: '#4338CA' },
  { name: 'Burgundy', value: '#9F1239' },
  { name: 'Charcoal', value: '#334155' },
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'inv-1001',
    invoiceNumber: 'INV-2026-001',
    title: 'INVOICE',
    issueDate: '2026-06-14',
    dueDate: '2026-06-28',
    currency: 'USD',
    status: 'paid',
    business: { ...DEFAULT_BUSINESS_PROFILE },
    customer: {
      name: 'Elena Rostova',
      company: 'Northstar Logistics Group',
      address: '880 Harrison St, Floor 3\nSeattle, WA 98109',
      email: 'ap@northstarlogistics.io',
      phone: '+1 (206) 555-0148',
    },
    items: [
      {
        id: 'item-1',
        description: 'Product Design System & UI Component Library',
        quantity: 1,
        unitPrice: 3200,
        taxRate: 8,
      },
      {
        id: 'item-2',
        description: 'Responsive Web Prototyping & Interactive Handoff',
        quantity: 16,
        unitPrice: 125,
        taxRate: 8,
      },
    ],
    discountType: 'percent',
    discountValue: 5,
    additional: {
      paymentInstructions: 'Please remit payment within 14 days via ACH transfer or wire.',
      bankDetails: 'Bank: First Republic Commercial\nRouting: 321081669\nAccount: 8000492104',
      notes: 'Thank you for partnering with Meridian Digital Studio on your Q2 portal refresh.',
      terms: 'Late payments beyond 15 days from due date are subject to a 1.5% monthly administrative fee.',
      footerMessage: 'Meridian Digital Studio · Registered Design Consultancy',
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
      enabled: true,
      dataUrl: SAMPLE_SIGNATURE_DATA_URL,
      label: 'Authorized Signature',
      x: 12,
      y: 22,
      width: 156,
    },
    stamp: {
      enabled: true,
      dataUrl: SAMPLE_STAMP_DATA_URL,
      label: 'Company Stamp',
      x: 72,
      y: 12,
      size: 96,
      opacity: 0.85,
    },
    updatedAt: '2026-06-20T10:15:00Z',
  },
  {
    id: 'inv-1002',
    invoiceNumber: 'INV-2026-002',
    title: 'TAX INVOICE',
    issueDate: '2026-07-08',
    dueDate: '2026-07-22',
    currency: 'USD',
    status: 'paid',
    business: { ...DEFAULT_BUSINESS_PROFILE },
    customer: {
      name: 'David Chen',
      company: 'Kestrel Biomedical Labs',
      address: '145 Cambridge Park Dr\nCambridge, MA 02140',
      email: 'finance@kestrelbio.com',
      phone: '+1 (617) 555-0192',
    },
    items: [
      {
        id: 'item-201',
        description: 'Clinical Portal UX Audit & Accessibility Remediation',
        quantity: 1,
        unitPrice: 2400,
        taxRate: 6.25,
      },
      {
        id: 'item-202',
        description: 'Frontend Engineering Support (Sprint 4)',
        quantity: 12,
        unitPrice: 140,
        taxRate: 6.25,
      },
    ],
    discountType: 'fixed',
    discountValue: 0,
    additional: {
      paymentInstructions: 'ACH or corporate check payable to Meridian Digital Studio.',
      bankDetails: 'Bank: First Republic Commercial\nAccount: 8000492104',
      notes: 'All deliverables uploaded to shared repository.',
      terms: 'Net 14 days.',
      footerMessage: 'Meridian Digital Studio · San Francisco',
    },
    design: {
      template: 'classic',
      accentColor: '#0F172A',
      fontStyle: 'serif',
      logoPlacement: 'center',
      headerStyle: 'bordered',
      footerStyle: 'detailed',
    },
    signature: {
      enabled: true,
      dataUrl: SAMPLE_SIGNATURE_DATA_URL,
      label: 'Authorized Representative',
      x: 10,
      y: 25,
      width: 150,
    },
    stamp: {
      enabled: true,
      dataUrl: SAMPLE_STAMP_DATA_URL,
      label: 'Company Stamp',
      x: 74,
      y: 14,
      size: 92,
      opacity: 0.8,
    },
    updatedAt: '2026-07-19T14:30:00Z',
  },
  {
    id: 'inv-1003',
    invoiceNumber: 'INV-2026-003',
    title: 'INVOICE',
    issueDate: '2026-08-19',
    dueDate: '2026-09-02',
    currency: 'EUR',
    status: 'overdue',
    business: { ...DEFAULT_BUSINESS_PROFILE },
    customer: {
      name: 'Lukas Weber',
      company: 'Alpen Werk GmbH',
      address: 'Maximilianstrasse 35\n80539 München, Germany',
      email: 'buchhaltung@alpenwerk.de',
      phone: '+49 89 555 0174',
    },
    items: [
      {
        id: 'item-301',
        description: 'Brand Identity Refresh & Typography Specification',
        quantity: 1,
        unitPrice: 2800,
        taxRate: 0,
      },
      {
        id: 'item-302',
        description: 'Packaging Collateral Templates (Print-Ready)',
        quantity: 4,
        unitPrice: 350,
        taxRate: 0,
      },
    ],
    discountType: 'fixed',
    discountValue: 200,
    additional: {
      paymentInstructions: 'SEPA / SWIFT international transfer referencing INV-2026-003.',
      bankDetails: 'IBAN: DE89370400440532013000\nBIC: COBADEFFXXX',
      notes: 'Reverse-charge VAT applies for EU B2B services.',
      terms: 'Payment due within 14 days of invoice date.',
      footerMessage: 'Thank you for your business.',
    },
    design: {
      template: 'minimal',
      accentColor: '#334155',
      fontStyle: 'sans',
      logoPlacement: 'left',
      headerStyle: 'clean',
      footerStyle: 'minimal',
    },
    signature: {
      enabled: true,
      dataUrl: SAMPLE_SIGNATURE_DATA_URL,
      label: 'Authorized Signature',
      x: 12,
      y: 22,
      width: 145,
    },
    stamp: {
      enabled: false,
      dataUrl: SAMPLE_STAMP_DATA_URL,
      label: 'Company Stamp',
      x: 72,
      y: 14,
      size: 90,
      opacity: 0.85,
    },
    updatedAt: '2026-09-05T09:00:00Z',
  },
  {
    id: 'inv-1004',
    invoiceNumber: 'INV-2026-004',
    title: 'INVOICE',
    issueDate: '2026-09-25',
    dueDate: '2026-10-09',
    currency: 'GBP',
    status: 'paid',
    business: { ...DEFAULT_BUSINESS_PROFILE },
    customer: {
      name: 'Hannah Abbott',
      company: 'Thames Architectural Press',
      address: '22 Clerkenwell Green\nLondon EC1R 0NA, UK',
      email: 'accounts@thamespress.co.uk',
      phone: '+44 20 7946 0821',
    },
    items: [
      {
        id: 'item-401',
        description: 'Editorial Catalogue Web App Architecture',
        quantity: 1,
        unitPrice: 1950,
        taxRate: 20,
      },
    ],
    discountType: 'percent',
    discountValue: 0,
    additional: {
      paymentInstructions: 'Faster Payments or BACS transfer.',
      bankDetails: 'Sort Code: 04-00-75 · Account: 61820419',
      notes: 'Phase 1 milestone completed and signed off.',
      terms: 'Net 14 days.',
      footerMessage: 'Meridian Digital Studio',
    },
    design: {
      template: 'modern',
      accentColor: '#047857',
      fontStyle: 'sans',
      logoPlacement: 'left',
      headerStyle: 'tinted',
      footerStyle: 'detailed',
    },
    signature: {
      enabled: true,
      dataUrl: SAMPLE_SIGNATURE_DATA_URL,
      label: 'Authorized Signature',
      x: 14,
      y: 24,
      width: 152,
    },
    stamp: {
      enabled: true,
      dataUrl: SAMPLE_STAMP_DATA_URL,
      label: 'Company Stamp',
      x: 73,
      y: 12,
      size: 94,
      opacity: 0.85,
    },
    updatedAt: '2026-10-03T16:40:00Z',
  },
  {
    id: 'inv-1005',
    invoiceNumber: 'INV-2026-005',
    title: 'INVOICE',
    issueDate: '2026-10-28',
    dueDate: '2026-11-18',
    currency: 'USD',
    status: 'unpaid',
    business: { ...DEFAULT_BUSINESS_PROFILE },
    customer: {
      name: 'Tariq Mahmood',
      company: 'Apex Vocational Institute',
      address: '1400 Oakridge Blvd\nAustin, TX 78704',
      email: 'procurement@apexvocational.edu',
      phone: '+1 (512) 555-0163',
    },
    items: [
      {
        id: 'item-501',
        description: 'Student Enrollment & Fee Receipt Portal Design',
        quantity: 1,
        unitPrice: 2600,
        taxRate: 0,
      },
      {
        id: 'item-502',
        description: 'Custom Document Template Configuration',
        quantity: 3,
        unitPrice: 280,
        taxRate: 0,
      },
    ],
    discountType: 'percent',
    discountValue: 10,
    additional: {
      paymentInstructions: 'Payable by institutional ACH or purchase order settlement.',
      bankDetails: 'Bank: First Republic Commercial\nRouting: 321081669\nAccount: 8000492104',
      notes: 'Educational institution discount (10%) applied.',
      terms: 'Net 21 days from issue date.',
      footerMessage: 'Meridian Digital Studio · Universal Billing Partner',
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
      enabled: true,
      dataUrl: SAMPLE_SIGNATURE_DATA_URL,
      label: 'Authorized Signature',
      x: 12,
      y: 22,
      width: 156,
    },
    stamp: {
      enabled: true,
      dataUrl: SAMPLE_STAMP_DATA_URL,
      label: 'Company Stamp',
      x: 72,
      y: 12,
      size: 96,
      opacity: 0.85,
    },
    updatedAt: '2026-10-28T11:20:00Z',
  },
  {
    id: 'inv-1006',
    invoiceNumber: 'INV-2026-006',
    title: 'PROFORMA INVOICE',
    issueDate: '2026-11-12',
    dueDate: '2026-11-26',
    currency: 'USD',
    status: 'draft',
    business: { ...DEFAULT_BUSINESS_PROFILE },
    customer: {
      name: 'Sophia Martinez',
      company: 'Solstice Retail Co.',
      address: '510 Broadway, 4th Floor\nNew York, NY 10012',
      email: 'billing@solsticeretail.com',
      phone: '+1 (212) 555-0119',
    },
    items: [
      {
        id: 'item-601',
        description: 'E-Commerce Checkout Optimization Workshop',
        quantity: 2,
        unitPrice: 750,
        taxRate: 8.875,
      },
      {
        id: 'item-602',
        description: 'Conversion Analytics Audit Report',
        quantity: 1,
        unitPrice: 900,
        taxRate: 8.875,
      },
    ],
    discountType: 'fixed',
    discountValue: 0,
    additional: {
      paymentInstructions: 'Draft proforma for client review prior to final issuance.',
      bankDetails: 'Bank: First Republic Commercial\nAccount: 8000492104',
      notes: 'Schedule kickoff upon approval of this proforma.',
      terms: '50% upfront, 50% upon final workshop delivery.',
      footerMessage: 'Meridian Digital Studio',
    },
    design: {
      template: 'minimal',
      accentColor: '#4338CA',
      fontStyle: 'sans',
      logoPlacement: 'right',
      headerStyle: 'clean',
      footerStyle: 'minimal',
    },
    signature: {
      enabled: true,
      dataUrl: SAMPLE_SIGNATURE_DATA_URL,
      label: 'Authorized Signature',
      x: 12,
      y: 22,
      width: 148,
    },
    stamp: {
      enabled: true,
      dataUrl: SAMPLE_STAMP_DATA_URL,
      label: 'Company Stamp',
      x: 72,
      y: 12,
      size: 92,
      opacity: 0.85,
    },
    updatedAt: '2026-11-12T17:05:00Z',
  },
];

export function createBlankInvoice(
  business: SavedBusinessProfile,
  nextInvoiceNumber: string,
  template: 'modern' | 'classic' | 'minimal' = 'modern'
): Invoice {
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return {
    id: `inv-${Date.now()}`,
    invoiceNumber: nextInvoiceNumber,
    title: 'INVOICE',
    issueDate: today,
    dueDate: due,
    currency: business.defaultCurrency || 'USD',
    status: 'draft',
    business: {
      name: business.name,
      logoDataUrl: business.logoDataUrl,
      address: business.address,
      phone: business.phone,
      email: business.email,
      website: business.website,
      taxNumber: business.taxNumber,
    },
    customer: {
      name: '',
      company: '',
      address: '',
      email: '',
      phone: '',
    },
    items: [
      {
        id: `item-${Date.now()}-1`,
        description: 'Consulting & Professional Services',
        quantity: 1,
        unitPrice: 500,
        taxRate: 0,
      },
    ],
    discountType: 'percent',
    discountValue: 0,
    additional: {
      paymentInstructions: 'Please transfer payment before the due date referencing the invoice number.',
      bankDetails: '',
      notes: 'Thank you for your business.',
      terms: 'Payment due within 14 days.',
      footerMessage: business.name ? `${business.name} · Generated with Universal Invoice Generator` : '',
    },
    design: {
      template,
      accentColor: '#1D4ED8',
      fontStyle: template === 'classic' ? 'serif' : 'sans',
      logoPlacement: template === 'classic' ? 'center' : 'left',
      headerStyle: template === 'classic' ? 'bordered' : 'clean',
      footerStyle: template === 'minimal' ? 'minimal' : 'detailed',
    },
    signature: {
      enabled: Boolean(business.savedSignatureDataUrl),
      dataUrl: business.savedSignatureDataUrl || '',
      label: business.savedSignatureLabel || 'Authorized Signature',
      x: 10,
      y: 22,
      width: 152,
    },
    stamp: {
      enabled: Boolean(business.savedStampDataUrl),
      dataUrl: business.savedStampDataUrl || '',
      label: business.savedStampLabel || 'Company Stamp',
      x: 72,
      y: 12,
      size: 94,
      opacity: 0.85,
    },
    updatedAt: new Date().toISOString(),
  };
}
