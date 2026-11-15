import { useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  RotateCcw,
  Sun,
  Moon,
  Cookie,
  Scale,
  ShieldCheck,
  FileText,
  Hash,
} from 'lucide-react';
import type {
  AppSettings,
  CurrencyCode,
  DateFormatOption,
  InvoiceNumberConfig,
  NavSection,
} from '../types/invoice';

interface SettingsViewProps {
  settings: AppSettings;
  onSaveSettings: (updated: AppSettings) => void;
  onResetDemoData: () => void;
  onNavigate?: (section: NavSection) => void;
  onOpenCookieSettings?: () => void;
}

const CURRENCIES: CurrencyCode[] = [
  'USD',
  'EUR',
  'GBP',
  'PKR',
  'AED',
  'CAD',
  'AUD',
  'SAR',
  'INR',
  'JPY',
];

const DEFAULT_NUMBERING: InvoiceNumberConfig = {
  prefix: 'INV-',
  resetYearly: true,
  padLength: 3,
};

export function SettingsView({
  settings,
  onSaveSettings,
  onResetDemoData,
  onNavigate,
  onOpenCookieSettings,
}: SettingsViewProps) {
  const [form, setForm] = useState<AppSettings>({
    ...settings,
    numberingConfig: settings.numberingConfig ?? DEFAULT_NUMBERING,
  });
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const numbering = form.numberingConfig ?? DEFAULT_NUMBERING;
  const currentYear = new Date().getFullYear();
  const sampleNum = `${numbering.prefix}${numbering.resetYearly ? `${currentYear}-` : ''}${String(1).padStart(Math.max(2, Math.min(6, numbering.padLength)), '0')}`;

  const updateNumbering = (patch: Partial<InvoiceNumberConfig>) => {
    setForm((prev) => ({
      ...prev,
      numberingConfig: {
        ...(prev.numberingConfig ?? DEFAULT_NUMBERING),
        ...patch,
      },
    }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSaveSettings(form);
    setSavedNotice('Preferences saved.');
    setTimeout(() => setSavedNotice(null), 2600);
  };

  const handleThemeSwitch = (theme: 'light' | 'dark') => {
    const next = { ...form, theme };
    setForm(next);
    onSaveSettings(next);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Settings
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Configure your personal profile, invoice numbering rules, formatting defaults, and privacy preferences.
          </p>
        </div>

        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>Save Preferences</span>
        </button>
      </div>

      {savedNotice && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
        >
          {savedNotice}
        </div>
      )}

      {/* Personal Profile */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Personal Profile
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="set-name"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Full Name
            </label>
            <input
              id="set-name"
              type="text"
              value={form.userName}
              onChange={(e) => setForm({ ...form, userName: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="set-role"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Role / Title
            </label>
            <input
              id="set-role"
              type="text"
              value={form.userRole}
              onChange={(e) => setForm({ ...form, userRole: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="set-email"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Contact Email
            </label>
            <input
              id="set-email"
              type="email"
              value={form.userEmail}
              onChange={(e) => setForm({ ...form, userEmail: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
      </section>

      {/* Application Preferences */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Application Preferences
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="set-currency"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Default Currency
            </label>
            <select
              id="set-currency"
              value={form.defaultCurrency}
              onChange={(e) =>
                setForm({ ...form, defaultCurrency: e.target.value as CurrencyCode })
              }
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="set-datefmt"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Date Format
            </label>
            <select
              id="set-datefmt"
              value={form.dateFormat}
              onChange={(e) =>
                setForm({ ...form, dateFormat: e.target.value as DateFormatOption })
              }
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="DD MMM YYYY">14 Nov 2026</option>
              <option value="MM/DD/YYYY">11/14/2026</option>
              <option value="YYYY-MM-DD">2026-11-14</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="set-lang"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Language (UI Concept)
            </label>
            <select
              id="set-lang"
              value={form.language}
              onChange={(e) =>
                setForm({ ...form, language: e.target.value as AppSettings['language'] })
              }
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="English (US)">English (US)</option>
              <option value="English (UK)">English (UK)</option>
              <option value="Arabic (Concept)">Arabic (Concept)</option>
              <option value="French (Concept)">French (Concept)</option>
            </select>
          </div>
        </div>

        {/* Theme Preference */}
        <div className="pt-1">
          <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
            Theme Preference
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => handleThemeSwitch('light')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
                form.theme === 'light'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Sun className="h-3.5 w-3.5" />
              <span>Light (Primary)</span>
            </button>
            <button
              type="button"
              onClick={() => handleThemeSwitch('dark')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
                form.theme === 'dark'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Moon className="h-3.5 w-3.5" />
              <span>Dark</span>
            </button>
          </div>
        </div>
      </section>

      {/* Invoice Numbering Rules */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-blue-700 dark:text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Invoice Numbering Rules
            </h3>
          </div>
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            Format example: <strong className="text-slate-900 dark:text-slate-100">{sampleNum}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label
              htmlFor="set-num-prefix"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Number Prefix
            </label>
            <input
              id="set-num-prefix"
              type="text"
              maxLength={12}
              value={numbering.prefix}
              onChange={(e) => updateNumbering({ prefix: e.target.value })}
              placeholder="INV-"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="set-num-pad"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Sequence Digits
            </label>
            <select
              id="set-num-pad"
              value={numbering.padLength}
              onChange={(e) => updateNumbering({ padLength: Number(e.target.value) || 3 })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value={3}>3 digits (001)</option>
              <option value={4}>4 digits (0001)</option>
              <option value={5}>5 digits (00001)</option>
            </select>
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <input
              type="checkbox"
              checked={numbering.resetYearly}
              onChange={(e) => updateNumbering({ resetYearly: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-blue-700"
            />
            <span>Reset sequence yearly</span>
          </label>
        </div>
      </section>

      {/* Privacy, Legal Documents & Cookie Preferences */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Privacy, Legal Notices &amp; Cookies
          </h3>
          {onOpenCookieSettings && (
            <button
              type="button"
              onClick={onOpenCookieSettings}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Cookie className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" />
              <span>Cookie Settings</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              Data Storage Architecture
            </div>
            <p className="mt-1">
              Workspace drafts, clients, business defaults, signatures, and company stamps remain in
              your browser&apos;s localStorage unless you explicitly generate a shareable invoice link
              or dispatch a recurring invoice via configured backend SMTP.
            </p>
          </div>
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              Compliance &amp; E-Signature Notice
            </div>
            <p className="mt-1">
              Users remain responsible for verifying regional tax regulations and statutory
              invoicing compliance. Placed signatures and seals represent visual document
              endorsements, not cryptographic PKI certificates.
            </p>
          </div>
        </div>

        {onNavigate && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onNavigate('license')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Scale className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" />
              <span>License &amp; IP</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('privacy')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" />
              <span>Privacy Policy</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('terms')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <FileText className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" />
              <span>Terms &amp; Conditions</span>
            </button>
          </div>
        )}

        <div className="border-t border-slate-200 pt-4 flex flex-wrap items-center justify-between gap-3 dark:border-slate-800">
          <div className="text-xs text-slate-500">
            Restore initial sample invoices and default Meridian Studio profile.
          </div>

          {confirmReset ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onResetDemoData();
                  setConfirmReset(false);
                  setSavedNotice('Sample demo data restored.');
                }}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
              >
                Confirm Restore
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Restore Demo Data</span>
            </button>
          )}
        </div>
      </section>
    </form>
  );
}
