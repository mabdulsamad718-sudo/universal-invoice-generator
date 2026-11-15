import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CookieConsentRecord, Invoice } from '../types/invoice.ts';
import {
  COOKIE_POLICY_VERSION,
  clearFunctionalPreferences,
  isCategoryConsented,
  isConsentRequired,
  loadFunctionalPreference,
  runWithCookieConsent,
  saveCookieConsent,
  saveFunctionalPreference,
} from './cookieConsent.ts';
import {
  getInvoiceAuthElements,
  MAX_IMAGE_FILE_BYTES,
  syncAuthElementsToInvoice,
  validateUploadedAssetFile,
} from './authElements.ts';
import { buildInvoicePdfDocument } from './pdfGenerator.ts';

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    configurable: true,
    writable: true,
  });
  return mockStorage;
}

function makeSampleInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-pdf-1',
    invoiceNumber: 'INV-2026-099',
    title: 'INVOICE',
    issueDate: '2026-11-14',
    dueDate: '2026-11-28',
    currency: 'INR',
    status: 'unpaid',
    business: {
      name: 'Apex Studio',
      logoDataUrl: '',
      address: '100 Main St',
      phone: '+1 555 0100',
      email: 'billing@apex.test',
      website: 'https://apex.test',
      taxNumber: 'TAX-99',
    },
    customer: {
      name: 'Aria Khan',
      company: 'Nova Systems',
      address: '400 Market St',
      email: 'aria@nova.test',
      phone: '+1 555 0200',
    },
    items: [
      { id: '1', description: 'Architecture Review', quantity: 2, unitPrice: 1250 },
      { id: '2', description: 'Exempt Advisory Fee', quantity: 1, unitPrice: 500, taxRate: 0 },
    ],
    discountType: 'percent',
    discountValue: 10,
    taxTreatment: 'after_discount',
    invoiceTaxRate: 18,
    additional: {
      paymentInstructions: 'Bank or Stripe settlement within 14 days.',
      bankDetails: 'IBAN PK00MEZN000123456',
      notes: 'Thank you for your business.',
      internalNotes: 'CONFIDENTIAL CREATOR MARGIN NOTE - NEVER IN PDF',
      terms: 'Net 14 days.',
      footerMessage: 'Universal Invoice Generator',
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
      rotation: 0,
    },
    stamp: {
      enabled: false,
      dataUrl: '',
      label: 'Company Seal',
      x: 72,
      y: 78,
      size: 90,
      opacity: 0.85,
      rotation: 0,
    },
    updatedAt: '2026-11-14T00:00:00Z',
    ...overrides,
  };
}

describe('Cookie Consent & Functional Preference Gating', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  it('re-prompts whenever consent is null or policy version changes', () => {
    assert.equal(isConsentRequired(null), true);

    const stale: CookieConsentRecord = {
      version: '2025-01-old',
      updatedAt: '2025-01-01T00:00:00Z',
      preferences: { necessary: true, functional: true, analytics: true, marketing: true },
    };
    assert.equal(isConsentRequired(stale), true);
    assert.equal(isCategoryConsented(stale, 'functional'), false);
    assert.equal(isCategoryConsented(stale, 'necessary'), true);

    const saved = saveCookieConsent({ functional: true, analytics: false, marketing: false });
    assert.equal(saved.version, COOKIE_POLICY_VERSION);
    assert.equal(isConsentRequired(saved), false);
    assert.equal(isCategoryConsented(saved, 'functional'), true);
    assert.equal(isCategoryConsented(saved, 'analytics'), false);
  });

  it('gates runWithCookieConsent and functional preferences cleanly', () => {
    const essentialOnly = saveCookieConsent({ functional: false, analytics: false, marketing: false });

    let analyticsExecuted = false;
    const ran = runWithCookieConsent(essentialOnly, 'analytics', () => {
      analyticsExecuted = true;
    });
    assert.equal(ran, false);
    assert.equal(analyticsExecuted, false);

    // Functional preference writes must be refused without consent
    assert.equal(saveFunctionalPreference(essentialOnly, 'compactPreview', true), false);
    assert.equal(loadFunctionalPreference(essentialOnly, 'compactPreview', false), false);

    // After functional opt-in, preferences save and load cleanly
    const functionalYes = saveCookieConsent({ functional: true });
    assert.equal(saveFunctionalPreference(functionalYes, 'compactPreview', true), true);
    assert.equal(loadFunctionalPreference(functionalYes, 'compactPreview', false), true);

    clearFunctionalPreferences();
    assert.equal(loadFunctionalPreference(functionalYes, 'compactPreview', false), false);
  });
});

describe('Auth Elements & Asset Validation', () => {
  it('validates uploaded asset file types and 2 MB size cap', () => {
    const validPng = new File(['abc'], 'sig.png', { type: 'image/png' });
    assert.equal(validateUploadedAssetFile(validPng), null);

    const badFormat = new File(['abc'], 'doc.pdf', { type: 'application/pdf' });
    assert.match(validateUploadedAssetFile(badFormat) || '', /Unsupported file format/);

    const oversized = new File([new Uint8Array(MAX_IMAGE_FILE_BYTES + 1)], 'huge.png', {
      type: 'image/png',
    });
    assert.match(validateUploadedAssetFile(oversized) || '', /2 MB limit/);
  });

  it('migrates legacy signature/stamp and keeps legacy fields synced', () => {
    const inv = makeSampleInvoice({
      signature: {
        enabled: true,
        dataUrl: '',
        label: 'Director',
        x: 10,
        y: 20,
        width: 150,
        rotation: 0,
      },
      stamp: {
        enabled: true,
        dataUrl: '',
        label: 'Seal',
        x: 70,
        y: 20,
        size: 96,
        opacity: 0.9,
        rotation: 0,
      },
    });
    const elements = getInvoiceAuthElements(inv);
    assert.equal(elements.length, 2);
    assert.equal(elements[0].kind, 'signature');
    assert.equal(elements[1].kind, 'stamp');

    const updated = syncAuthElementsToInvoice(inv, [
      { ...elements[0], x: 25, y: 81 },
      elements[1],
    ]);
    assert.equal(updated.signature.x, 25);
    assert.equal(updated.signature.y, 81);
  });
});

describe('Vector Multi-Page PDF Export', () => {
  it('generates valid multi-page PDF with WinAnsi-safe currency strings and strips internalNotes', async () => {
    const manyItems = Array.from({ length: 42 }, (_, idx) => ({
      id: `item-${idx}`,
      description: `Deliverable Milestone #${idx + 1} — Full Technical Audit`,
      quantity: 1,
      unitPrice: 250 + idx,
    }));

    const inv = makeSampleInvoice({
      currency: 'INR',
      items: manyItems,
    });

    const { doc, filename } = await buildInvoicePdfDocument(inv, 'DD MMM YYYY', []);
    assert.equal(filename, 'INV-2026-099.pdf');
    assert.ok(doc.getNumberOfPages() >= 2, 'Expected 42 line items to span multiple A4 pages');

    // Inspect uncompressed jsPDF page streams before FlateDecode output
    const pageStreams = (doc.internal as unknown as { pages: (string[] | undefined)[] }).pages
      .filter(Boolean)
      .flat()
      .join('\n');
    assert.ok(pageStreams.includes('INR '), 'Expected WinAnsi-safe INR prefix instead of raw rupee glyph');
    assert.equal(
      pageStreams.includes('CONFIDENTIAL CREATOR MARGIN NOTE'),
      false,
      'Creator internalNotes must never appear in exported PDF'
    );

    const pdfBytes = doc.output('arraybuffer');
    const rawText = Buffer.from(pdfBytes).toString('latin1');
    assert.ok(rawText.startsWith('%PDF-'), 'Output should be a valid PDF header');
    assert.ok(rawText.includes('%%EOF'), 'Output should terminate cleanly with %%EOF');
  });
});
