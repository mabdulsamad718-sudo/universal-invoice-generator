import { useState } from 'react';
import { Cookie, ShieldCheck, Lock, X, Check } from 'lucide-react';
import type { CookieConsentPreferences, CookieConsentRecord, NavSection } from '../types/invoice';
import {
  ALL_ACCEPTED_PREFERENCES,
  COOKIE_CATEGORIES,
  COOKIE_POLICY_VERSION,
  DEFAULT_COOKIE_PREFERENCES,
  isConsentRequired,
} from '../utils/cookieConsent';

interface CookieConsentBannerProps {
  consentRecord: CookieConsentRecord | null;
  preferencesOpen: boolean;
  onOpenPreferences: () => void;
  onClosePreferences: () => void;
  onSavePreferences: (prefs: Partial<CookieConsentPreferences>) => void;
  onNavigatePrivacy: (section: NavSection) => void;
}

export function CookieConsentBanner({
  consentRecord,
  preferencesOpen,
  onOpenPreferences,
  onClosePreferences,
  onSavePreferences,
  onNavigatePrivacy,
}: CookieConsentBannerProps) {
  const [draft, setDraft] = useState<CookieConsentPreferences>(
    consentRecord?.preferences ?? DEFAULT_COOKIE_PREFERENCES
  );

  const handleOpenCustomize = () => {
    setDraft(consentRecord?.preferences ?? DEFAULT_COOKIE_PREFERENCES);
    onOpenPreferences();
  };

  return (
    <>
      {/* First-Visit or Policy-Updated Unobtrusive Consent Banner */}
      {isConsentRequired(consentRecord) && !preferencesOpen && (
        <aside
          role="region"
          aria-label="Cookie and storage consent"
          data-testid="cookie-consent-banner"
          className="no-print fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white/95 p-4 sm:p-5 shadow-xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-blue-700">
                <Cookie className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Cookie &amp; Local Storage Preferences
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Universal Invoice Generator uses strictly necessary browser storage to run your
                  invoicing workspace. Optional Functional, Analytics, and Marketing categories
                  stay off unless you choose to enable them.{' '}
                  <button
                    type="button"
                    onClick={() => onNavigatePrivacy('privacy')}
                    className="font-medium text-blue-700 underline hover:text-blue-800 dark:text-blue-400"
                  >
                    Read Privacy Policy
                  </button>
                  .
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onSavePreferences(DEFAULT_COOKIE_PREFERENCES)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 whitespace-nowrap"
              >
                Reject All
              </button>
              <button
                type="button"
                onClick={handleOpenCustomize}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap"
              >
                Customize Cookies
              </button>
              <button
                type="button"
                onClick={() => onSavePreferences(ALL_ACCEPTED_PREFERENCES)}
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
              >
                Accept All
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Cookie Preference Center Modal */}
      {preferencesOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cookie Preference Center"
          data-testid="cookie-preference-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]"
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Cookie &amp; Consent Preferences
                </h3>
              </div>
              <button
                type="button"
                onClick={onClosePreferences}
                aria-label="Close cookie preferences"
                className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Manage how Universal Invoice Generator uses browser storage and optional script
                categories. You can revisit or withdraw consent at any time from the footer or
                Settings.{' '}
                <button
                  type="button"
                  onClick={() => {
                    onClosePreferences();
                    onNavigatePrivacy('privacy');
                  }}
                  className="font-medium text-blue-700 underline dark:text-blue-400"
                >
                  Privacy Policy
                </button>
              </p>

              <div className="space-y-3">
                {COOKIE_CATEGORIES.map((cat) => {
                  const enabled = cat.locked ? true : Boolean(draft[cat.id]);
                  return (
                    <div
                      key={cat.id}
                      className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-700 dark:bg-slate-800/40"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {cat.name}
                          </span>
                          {cat.locked && (
                            <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                              <Lock className="h-2.5 w-2.5" />
                              <span>Always Active</span>
                            </span>
                          )}
                        </div>

                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            aria-label={`Toggle ${cat.name} cookies`}
                            checked={enabled}
                            disabled={cat.locked}
                            onChange={(e) => {
                              if (cat.locked) return;
                              setDraft((prev) => ({
                                ...prev,
                                [cat.id]: e.target.checked,
                              }));
                            }}
                            className="h-4 w-4 rounded accent-blue-700 disabled:cursor-not-allowed"
                          />
                        </label>
                      </div>

                      <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                        {cat.description}
                      </p>
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Scope: {cat.examples}
                      </div>
                    </div>
                  );
                })}
              </div>

              {consentRecord && (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  Last saved: {new Date(consentRecord.updatedAt).toLocaleString()} &middot; Policy{' '}
                  <span className="font-mono">{consentRecord.version || COOKIE_POLICY_VERSION}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    onSavePreferences(DEFAULT_COOKIE_PREFERENCES);
                    onClosePreferences();
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Reject Optional Cookies
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onSavePreferences(ALL_ACCEPTED_PREFERENCES);
                      onClosePreferences();
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    Accept All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSavePreferences(draft);
                      onClosePreferences();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Save My Preferences</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
