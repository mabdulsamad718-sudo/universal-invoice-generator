import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceRecurringDate,
  createInvoiceFromSchedule,
  parseIsoDate,
  processDueRecurringSchedules,
} from './recurring.ts';
import type { RecurringInvoiceSchedule, SavedBusinessProfile } from '../types/invoice.ts';

const MOCK_PROFILE: SavedBusinessProfile = {
  name: 'Test Studio',
  logoDataUrl: '',
  address: '100 Main St',
  phone: '+1 555 0100',
  email: 'billing@test.studio',
  website: '',
  taxNumber: '',
  defaultCurrency: 'USD',
  savedSignatureDataUrl: '',
  savedSignatureLabel: 'Authorized Signature',
  savedStampDataUrl: '',
  savedStampLabel: 'Company Stamp',
};

const BASE_SCHEDULE: RecurringInvoiceSchedule = {
  id: 'rec-test-1',
  name: 'Quarterly Advisory',
  frequency: 'quarterly',
  startDate: '2026-01-31',
  endDate: '2026-12-31',
  nextRunDate: '2026-01-31',
  status: 'active',
  autoSend: true,
  dueDaysAfterIssue: 14,
  generatedCount: 0,
  templateSnapshot: {
    title: 'INVOICE',
    currency: 'USD',
    customer: {
      name: 'Client One',
      company: 'Acme Co',
      address: '200 Elm',
      email: 'ap@acme.test',
      phone: '',
    },
    items: [{ id: 'i1', description: 'Advisory', quantity: 1, unitPrice: 1000, taxRate: 10 }],
    discountType: 'percent',
    discountValue: 0,
    additional: {
      paymentInstructions: '',
      bankDetails: '',
      notes: '',
      terms: '',
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
    enabledPaymentIds: [],
  },
  createdAt: '2026-01-01T00:00:00Z',
};

describe('Recurring Invoice Engine & Honesty Rules', () => {
  it('supports quarterly recurrence, clamps end-of-month dates, and preserves anchorDay', () => {
    assert.equal(advanceRecurringDate('2026-01-31', 'quarterly'), '2026-04-30');
    const febRun = advanceRecurringDate('2026-01-31', 'monthly', 31);
    assert.equal(febRun, '2026-02-28');
    // Passing anchorDay=31 restores the 31st in March instead of getting stuck on the 28th
    assert.equal(advanceRecurringDate(febRun, 'monthly', 31), '2026-03-31');
    assert.equal(advanceRecurringDate('2026-01-31', 'yearly', 31), '2027-01-31');
  });

  it('rejects impossible calendar dates like 2026-02-30 or 2025-02-29', () => {
    assert.equal(parseIsoDate('2026-02-30'), null);
    assert.equal(parseIsoDate('2025-02-29'), null);
    assert.deepEqual(parseIsoDate('2024-02-29'), { year: 2024, month: 2, day: 29 });
  });

  it('never marks generated invoice as sent without real email dispatch', () => {
    const autoSendInv = createInvoiceFromSchedule(
      { ...BASE_SCHEDULE, autoSend: true },
      '2026-01-31',
      MOCK_PROFILE,
      []
    );
    assert.equal(autoSendInv.status, 'unpaid');
    assert.equal(autoSendInv.deliveryStatus, 'queued');

    const draftInv = createInvoiceFromSchedule(
      { ...BASE_SCHEDULE, autoSend: false },
      '2026-01-31',
      MOCK_PROFILE,
      []
    );
    assert.equal(draftInv.status, 'draft');
    assert.equal(draftInv.deliveryStatus, 'generated');
  });

  it('prevents duplicate invoice generation for same schedule and scheduled date', () => {
    const first = processDueRecurringSchedules(
      [BASE_SCHEDULE],
      [],
      MOCK_PROFILE,
      '2026-02-15'
    );
    assert.equal(first.generatedInvoices.length, 1);
    assert.equal(first.generatedInvoices[0].issueDate, '2026-01-31');

    // Re-running with stale schedule pointer but existing generated invoice must NOT create duplicate
    const second = processDueRecurringSchedules(
      [BASE_SCHEDULE],
      first.generatedInvoices,
      MOCK_PROFILE,
      '2026-02-15'
    );
    assert.equal(second.generatedInvoices.length, 0);
  });

  it('marks monthly schedule completed after reaching endDate while preserving anchorDay', () => {
    const monthlyEndSchedule: RecurringInvoiceSchedule = {
      ...BASE_SCHEDULE,
      id: 'rec-monthly-end',
      frequency: 'monthly',
      startDate: '2026-01-31',
      nextRunDate: '2026-01-31',
      endDate: '2026-03-31',
    };
    const res = processDueRecurringSchedules(
      [monthlyEndSchedule],
      [],
      MOCK_PROFILE,
      '2026-04-10'
    );
    assert.equal(res.generatedInvoices.length, 3);
    assert.deepEqual(
      res.generatedInvoices.map((i) => i.issueDate),
      ['2026-01-31', '2026-02-28', '2026-03-31']
    );
    assert.equal(res.updatedSchedules[0].status, 'completed');
  });
});
