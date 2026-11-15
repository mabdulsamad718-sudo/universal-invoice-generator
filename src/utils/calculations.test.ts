import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateInvoiceTotals,
  calculateLineItem,
  computeDashboardMetrics,
  formatCurrency,
  formatCurrencyForPdf,
  resolveEffectiveTaxRate,
  suggestNextInvoiceNumber,
  validateInvoiceMathInput,
} from './calculations.ts';

describe('Financial Calculation Engine (Minor-Unit Arithmetic)', () => {
  it('1. Simple single-item invoice without tax or discount', () => {
    const totals = calculateInvoiceTotals(
      [{ quantity: 2, unitPrice: 150, taxRate: 0 }],
      'percent',
      0
    );
    assert.equal(totals.subtotal, 300);
    assert.equal(totals.discountAmount, 0);
    assert.equal(totals.taxTotal, 0);
    assert.equal(totals.grandTotal, 300);
  });

  it('2. Multi-item invoice with mixed quantities and prices', () => {
    const totals = calculateInvoiceTotals(
      [
        { quantity: 3, unitPrice: 120.5, taxRate: 0 },
        { quantity: 1.5, unitPrice: 80, taxRate: 0 },
      ],
      'fixed',
      0
    );
    assert.equal(totals.subtotal, 481.5);
    assert.equal(totals.grandTotal, 481.5);
  });

  it('3. Percentage discount (after_discount tax treatment)', () => {
    const totals = calculateInvoiceTotals(
      [{ quantity: 1, unitPrice: 1000, taxRate: 10 }],
      'percent',
      10,
      { taxTreatment: 'after_discount' }
    );
    // 1000 - 10% = 900 taxable; 10% tax on 900 = 90; grandTotal = 990
    assert.equal(totals.subtotal, 1000);
    assert.equal(totals.discountAmount, 100);
    assert.equal(totals.netTaxableAmount, 900);
    assert.equal(totals.taxTotal, 90);
    assert.equal(totals.grandTotal, 990);
  });

  it('4. Fixed-amount discount capped cleanly at subtotal', () => {
    const totals = calculateInvoiceTotals(
      [{ quantity: 1, unitPrice: 250, taxRate: 0 }],
      'fixed',
      400
    );
    assert.equal(totals.subtotal, 250);
    assert.equal(totals.discountAmount, 250);
    assert.equal(totals.grandTotal, 0);
  });

  it('5. Tax applied before discount vs after discount yields distinct tax base', () => {
    const items = [{ quantity: 1, unitPrice: 500, taxRate: 20 }];
    const beforeDisc = calculateInvoiceTotals(items, 'fixed', 100, {
      taxTreatment: 'before_discount',
    });
    const afterDisc = calculateInvoiceTotals(items, 'fixed', 100, {
      taxTreatment: 'after_discount',
    });
    assert.equal(beforeDisc.taxTotal, 100); // 20% of 500
    assert.equal(beforeDisc.grandTotal, 500); // 500 - 100 + 100
    assert.equal(afterDisc.taxTotal, 80); // 20% of 400
    assert.equal(afterDisc.grandTotal, 480); // 400 + 80
  });

  it('6. Tax-inclusive pricing extracts embedded tax accurately', () => {
    const totals = calculateInvoiceTotals(
      [{ quantity: 1, unitPrice: 110, taxRate: 10 }],
      'percent',
      0,
      { taxTreatment: 'tax_inclusive' }
    );
    assert.equal(totals.netTaxableAmount, 100);
    assert.equal(totals.taxTotal, 10);
    assert.equal(totals.grandTotal, 110);
  });

  it('7. Multiple tax rates aggregate accurately in taxBreakdown', () => {
    const totals = calculateInvoiceTotals(
      [
        { quantity: 1, unitPrice: 200, taxRate: 5 },
        { quantity: 1, unitPrice: 300, taxRate: 15 },
      ],
      'fixed',
      0,
      { taxTreatment: 'after_discount' }
    );
    assert.equal(totals.subtotal, 500);
    assert.equal(totals.taxTotal, 55); // 10 + 45
    assert.equal(totals.grandTotal, 555);
    assert.equal(totals.taxBreakdown.length, 2);
    assert.deepEqual(totals.taxBreakdown[0], { rate: 5, taxableAmount: 200, taxAmount: 10 });
    assert.deepEqual(totals.taxBreakdown[1], { rate: 15, taxableAmount: 300, taxAmount: 45 });
  });

  it('8. Item-level discount combined with invoice-level discount', () => {
    const line = calculateLineItem(
      { quantity: 2, unitPrice: 100, taxRate: 10, discountType: 'percent', discountValue: 25 },
      'USD'
    );
    assert.equal(line.lineBaseSubtotal, 200);
    assert.equal(line.itemDiscountAmount, 50);
    assert.equal(line.lineSubtotal, 150);

    const totals = calculateInvoiceTotals(
      [{ quantity: 2, unitPrice: 100, taxRate: 10, discountType: 'percent', discountValue: 25 }],
      'fixed',
      50,
      { taxTreatment: 'after_discount' }
    );
    assert.equal(totals.itemDiscountTotal, 50);
    assert.equal(totals.subtotal, 150);
    assert.equal(totals.discountAmount, 50);
    assert.equal(totals.totalDiscountAmount, 100);
    assert.equal(totals.netTaxableAmount, 100);
    assert.equal(totals.taxTotal, 10);
    assert.equal(totals.grandTotal, 110);
  });

  it('9. Zero tax and zero discount case', () => {
    const totals = calculateInvoiceTotals([], 'percent', 0);
    assert.equal(totals.subtotal, 0);
    assert.equal(totals.taxTotal, 0);
    assert.equal(totals.grandTotal, 0);
  });

  it('10. Floating-point decimal precision (0.1 + 0.2 and 19.99 * 3)', () => {
    const totals = calculateInvoiceTotals(
      [
        { quantity: 1, unitPrice: 0.1, taxRate: 0 },
        { quantity: 1, unitPrice: 0.2, taxRate: 0 },
        { quantity: 3, unitPrice: 19.99, taxRate: 0 },
      ],
      'fixed',
      0
    );
    assert.equal(totals.subtotal, 60.27);
    assert.equal(totals.grandTotal, 60.27);
  });

  it('11. Currency-specific minor unit rounding edge cases (JPY / PKR 0 decimals vs USD 2 decimals)', () => {
    const jpy = calculateInvoiceTotals(
      [{ quantity: 1, unitPrice: 1005, taxRate: 10 }],
      'percent',
      0,
      { currency: 'JPY' }
    );
    assert.equal(jpy.taxTotal, 101); // 100.5 rounds half-up to 101 yen
    assert.equal(jpy.grandTotal, 1106);

    const usd = calculateInvoiceTotals(
      [{ quantity: 1, unitPrice: 10.05, taxRate: 10 }],
      'percent',
      0,
      { currency: 'USD' }
    );
    assert.equal(usd.taxTotal, 1.01);
    assert.equal(usd.grandTotal, 11.06);
  });

  it('12. Invalid values (negative quantities/prices/excessive discounts) are clamped and flagged', () => {
    const warnings = validateInvoiceMathInput(
      [{ description: 'Bad Item', quantity: -2, unitPrice: -50, taxRate: 150 }],
      'percent',
      140
    );
    assert.ok(warnings.length >= 4);

    const totals = calculateInvoiceTotals(
      [{ quantity: -2, unitPrice: -50, taxRate: 150 }],
      'percent',
      140
    );
    assert.equal(totals.subtotal, 0);
    assert.equal(totals.grandTotal, 0);
  });

  it('13. Formats currencies cleanly without NaN and provides WinAnsi PDF formatting', () => {
    assert.match(formatCurrency(1234.5, 'USD'), /1,234\.50/);
    assert.match(formatCurrency(Number.NaN, 'USD'), /0\.00/);
    assert.equal(formatCurrencyForPdf(1500.5, 'INR'), 'INR 1,500.50');
    assert.equal(formatCurrencyForPdf(25000, 'PKR'), 'PKR 25,000');
    assert.equal(formatCurrencyForPdf(-120, 'JPY'), '-JPY 120');
  });

  it('14. Distinguishes explicit 0% zero-rated items from undefined tax inheritance', () => {
    assert.equal(resolveEffectiveTaxRate(undefined, 15), 15);
    assert.equal(resolveEffectiveTaxRate(null, 15), 15);
    assert.equal(resolveEffectiveTaxRate(0, 15), 0);
    assert.equal(resolveEffectiveTaxRate(8, 15), 8);

    const totals = calculateInvoiceTotals(
      [
        { quantity: 1, unitPrice: 100, taxRate: undefined }, // inherits 10%
        { quantity: 1, unitPrice: 100, taxRate: 0 }, // stays strictly 0%
      ],
      'percent',
      0,
      { invoiceTaxRate: 10, currency: 'USD' }
    );
    assert.equal(totals.subtotal, 200);
    assert.equal(totals.taxTotal, 10);
    assert.equal(totals.grandTotal, 210);
  });

  it('15. Excludes cancelled invoices from unpaid metrics', () => {
    const metrics = computeDashboardMetrics([
      { status: 'paid' },
      { status: 'unpaid' },
      { status: 'cancelled' },
      { status: 'draft' },
    ]);
    assert.equal(metrics.totalCount, 4);
    assert.equal(metrics.paidCount, 1);
    assert.equal(metrics.unpaidCount, 1);
    assert.equal(metrics.draftCount, 1);
  });
});

describe('Invoice Numbering Sequence & Yearly Reset', () => {
  it('restarts sequence at 001 when year changes while ignoring prior year max', () => {
    const invoices = [
      { invoiceNumber: 'INV-2026-001' },
      { invoiceNumber: 'INV-2026-002' },
      { invoiceNumber: 'INV-2026-019' },
    ];
    assert.equal(suggestNextInvoiceNumber(invoices, 2026), 'INV-2026-020');
    assert.equal(suggestNextInvoiceNumber(invoices, 2027), 'INV-2027-001');
  });

  it('supports custom prefix and avoids collisions', () => {
    const invoices = [
      { invoiceNumber: 'BILL-2026-001' },
      { invoiceNumber: 'BILL-2026-002' },
    ];
    assert.equal(
      suggestNextInvoiceNumber(invoices, 2026, { prefix: 'BILL-', resetYearly: true, padLength: 4 }),
      'BILL-2026-0003'
    );
  });

  it('supports continuous sequence when resetYearly is false', () => {
    const invoices = [{ invoiceNumber: 'INV-007' }, { invoiceNumber: 'INV-009' }];
    assert.equal(
      suggestNextInvoiceNumber(invoices, 2026, { prefix: 'INV-', resetYearly: false, padLength: 3 }),
      'INV-010'
    );
  });
});
