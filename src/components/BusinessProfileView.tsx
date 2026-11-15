import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Upload, CheckCircle2, Stamp, Trash2, AlertCircle } from 'lucide-react';
import type { CurrencyCode, SavedAssetItem, SavedBusinessProfile } from '../types/invoice';
import {
  SAMPLE_LOGO_DATA_URL,
  SAMPLE_SIGNATURE_DATA_URL,
  SAMPLE_STAMP_DATA_URL,
} from '../data/seedData';
import { validateUploadedAssetFile } from '../utils/authElements';
import { SignatureCanvas } from './SignatureCanvas';

interface BusinessProfileViewProps {
  profile: SavedBusinessProfile;
  onSaveProfile: (updated: SavedBusinessProfile) => void;
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

export function BusinessProfileView({ profile, onSaveProfile }: BusinessProfileViewProps) {
  const [form, setForm] = useState<SavedBusinessProfile>(profile);
  const [savedNotice, setSavedNotice] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showDrawPad, setShowDrawPad] = useState(false);
  const [confirmDeleteAssetId, setConfirmDeleteAssetId] = useState<string | null>(null);

  const handleFile = (e: ChangeEvent<HTMLInputElement>, onLoad: (url: string, name: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateUploadedAssetFile(file);
    if (err) {
      setUploadError(err);
      e.target.value = '';
      return;
    }
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onLoad(reader.result, file.name.replace(/\.[^.]+$/, ''));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const addSavedSignature = (dataUrl: string, label: string) => {
    const item: SavedAssetItem = {
      id: `sig-lib-${Date.now()}`,
      kind: 'signature',
      label: label || 'Saved Signature',
      dataUrl,
      createdAt: new Date().toISOString(),
    };
    setForm((prev) => ({
      ...prev,
      savedSignatureDataUrl: dataUrl,
      savedSignatureLabel: item.label,
      savedSignatures: [item, ...(prev.savedSignatures ?? []).filter((s) => s.dataUrl !== dataUrl)],
    }));
  };

  const addSavedStamp = (dataUrl: string, label: string) => {
    const item: SavedAssetItem = {
      id: `stamp-lib-${Date.now()}`,
      kind: 'stamp',
      label: label || 'Company Seal',
      dataUrl,
      createdAt: new Date().toISOString(),
    };
    setForm((prev) => ({
      ...prev,
      savedStampDataUrl: dataUrl,
      savedStampLabel: item.label,
      savedStamps: [item, ...(prev.savedStamps ?? []).filter((s) => s.dataUrl !== dataUrl)],
    }));
  };

  const removeSavedSignature = (id: string) => {
    setForm((prev) => {
      const target = (prev.savedSignatures ?? []).find((s) => s.id === id);
      const remaining = (prev.savedSignatures ?? []).filter((s) => s.id !== id);
      const nextDefault =
        target && prev.savedSignatureDataUrl === target.dataUrl
          ? remaining[0]?.dataUrl ?? ''
          : prev.savedSignatureDataUrl;
      return {
        ...prev,
        savedSignatureDataUrl: nextDefault,
        savedSignatures: remaining,
      };
    });
  };

  const removeSavedStamp = (id: string) => {
    setForm((prev) => {
      const target = (prev.savedStamps ?? []).find((s) => s.id === id);
      const remaining = (prev.savedStamps ?? []).filter((s) => s.id !== id);
      const nextDefault =
        target && prev.savedStampDataUrl === target.dataUrl
          ? remaining[0]?.dataUrl ?? ''
          : prev.savedStampDataUrl;
      return {
        ...prev,
        savedStampDataUrl: nextDefault,
        savedStamps: remaining,
      };
    });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSaveProfile(form);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2800);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Business Profile
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Manage your default company details, logo, signature library, and company seals for future invoices.
          </p>
        </div>

        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>Save Business Profile</span>
        </button>
      </div>

      {savedNotice && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
        >
          Business Profile updated. New invoices will automatically pre-fill these defaults.
        </div>
      )}

      {uploadError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Business Identity & Logo */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Organization Identity
        </h3>

        <div className="flex flex-wrap items-center gap-4">
          {form.logoDataUrl ? (
            <img
              src={form.logoDataUrl}
              alt="Business logo"
              className="h-16 w-16 rounded-lg border border-slate-200 bg-white object-contain p-1.5"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
              No Logo
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Upload className="h-3.5 w-3.5 text-blue-700" />
              <span>Upload Logo</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="sr-only"
                onChange={(e) => handleFile(e, (url) => setForm({ ...form, logoDataUrl: url }))}
              />
            </label>
            <button
              type="button"
              onClick={() => setForm({ ...form, logoDataUrl: SAMPLE_LOGO_DATA_URL })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Use Sample Logo
            </button>
            {form.logoDataUrl && (
              <button
                type="button"
                onClick={() => setForm({ ...form, logoDataUrl: '' })}
                className="inline-flex items-center gap-1 px-2 py-2 text-xs text-rose-600 hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Remove</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label
              htmlFor="prof-name"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Business / Company Name
            </label>
            <input
              id="prof-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="prof-email"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Email Address
            </label>
            <input
              id="prof-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="prof-phone"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Phone Number
            </label>
            <input
              id="prof-phone"
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="prof-website"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Website
            </label>
            <input
              id="prof-website"
              type="text"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="prof-tax"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Tax Registration Number
            </label>
            <input
              id="prof-tax"
              type="text"
              value={form.taxNumber}
              onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="prof-currency"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Default Currency
            </label>
            <select
              id="prof-currency"
              value={form.defaultCurrency}
              onChange={(e) =>
                setForm({ ...form, defaultCurrency: e.target.value as CurrencyCode })
              }
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="prof-address"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Business Address
            </label>
            <textarea
              id="prof-address"
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
      </section>

      {/* Saved Signatures & Company Seals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Saved Digital Signatures
            </h3>
            <button
              type="button"
              onClick={() => setShowDrawPad((prev) => !prev)}
              className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
            >
              {showDrawPad ? 'Close Draw Pad' : 'Draw New'}
            </button>
          </div>

          <div className="flex h-28 items-center justify-center rounded-lg border border-slate-200 bg-white p-3">
            {form.savedSignatureDataUrl ? (
              <img
                src={form.savedSignatureDataUrl}
                alt="Saved signature"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-xs text-slate-400">No default signature saved</span>
            )}
          </div>

          {showDrawPad && (
            <SignatureCanvas
              onApply={(dataUrl) => {
                addSavedSignature(dataUrl, form.savedSignatureLabel || 'Authorized Signature');
                setShowDrawPad(false);
              }}
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Signature</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="sr-only"
                onChange={(e) =>
                  handleFile(e, (url, name) => addSavedSignature(url, name || 'Uploaded Signature'))
                }
              />
            </label>
            <button
              type="button"
              onClick={() => addSavedSignature(SAMPLE_SIGNATURE_DATA_URL, 'Authorized Signature')}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              Sample
            </button>
            {form.savedSignatureDataUrl && (
              <button
                type="button"
                onClick={() => setForm({ ...form, savedSignatureDataUrl: '' })}
                className="text-xs text-rose-600 hover:underline px-2"
              >
                Clear Default
              </button>
            )}
          </div>

          {(form.savedSignatures?.length ?? 0) > 0 && (
            <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <div className="text-[11px] font-medium text-slate-500">
                Signature Library ({form.savedSignatures?.length})
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {form.savedSignatures!.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800/40"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          savedSignatureDataUrl: item.dataUrl,
                          savedSignatureLabel: item.label,
                        })
                      }
                      className="flex items-center gap-2 text-left min-w-0 flex-1"
                    >
                      <img
                        src={item.dataUrl}
                        alt={item.label}
                        className="h-6 w-12 rounded border border-slate-200 bg-white object-contain p-0.5"
                      />
                      <span className="truncate text-xs text-slate-700 dark:text-slate-200">
                        {item.label}
                      </span>
                    </button>
                    {confirmDeleteAssetId === item.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            removeSavedSignature(item.id);
                            setConfirmDeleteAssetId(null);
                          }}
                          className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-rose-700"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteAssetId(null)}
                          className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteAssetId(item.id)}
                        aria-label={`Delete saved signature ${item.label}`}
                        className="rounded p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Saved Company Stamps &amp; Seals
          </h3>

          <div className="flex h-28 items-center justify-center rounded-lg border border-slate-200 bg-white p-3">
            {form.savedStampDataUrl ? (
              <img
                src={form.savedStampDataUrl}
                alt="Saved company stamp"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-1 text-slate-400">
                <Stamp className="h-6 w-6" />
                <span className="text-xs">No default stamp saved</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Seal</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="sr-only"
                onChange={(e) =>
                  handleFile(e, (url, name) => addSavedStamp(url, name || 'Company Seal'))
                }
              />
            </label>
            <button
              type="button"
              onClick={() => addSavedStamp(SAMPLE_STAMP_DATA_URL, 'Official Seal')}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              Sample Seal
            </button>
            {form.savedStampDataUrl && (
              <button
                type="button"
                onClick={() => setForm({ ...form, savedStampDataUrl: '' })}
                className="text-xs text-rose-600 hover:underline px-2"
              >
                Clear Default
              </button>
            )}
          </div>

          {(form.savedStamps?.length ?? 0) > 0 && (
            <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <div className="text-[11px] font-medium text-slate-500">
                Seal Library ({form.savedStamps?.length})
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {form.savedStamps!.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800/40"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          savedStampDataUrl: item.dataUrl,
                          savedStampLabel: item.label,
                        })
                      }
                      className="flex items-center gap-2 text-left min-w-0 flex-1"
                    >
                      <img
                        src={item.dataUrl}
                        alt={item.label}
                        className="h-7 w-7 rounded border border-slate-200 bg-white object-contain p-0.5"
                      />
                      <span className="truncate text-xs text-slate-700 dark:text-slate-200">
                        {item.label}
                      </span>
                    </button>
                    {confirmDeleteAssetId === item.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            removeSavedStamp(item.id);
                            setConfirmDeleteAssetId(null);
                          }}
                          className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-rose-700"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteAssetId(null)}
                          className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteAssetId(item.id)}
                        aria-label={`Delete saved seal ${item.label}`}
                        className="rounded p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </form>
  );
}
