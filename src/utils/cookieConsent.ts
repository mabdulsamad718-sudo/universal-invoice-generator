import type {
  CookieConsentCategory,
  CookieConsentPreferences,
  CookieConsentRecord,
} from '../types/invoice';

export const COOKIE_CONSENT_STORAGE_KEY = 'uig_cookie_consent_v1';
export const COOKIE_POLICY_VERSION = '2026-11-v1';

export const DEFAULT_COOKIE_PREFERENCES: CookieConsentPreferences = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
};

export const ALL_ACCEPTED_PREFERENCES: CookieConsentPreferences = {
  necessary: true,
  functional: true,
  analytics: true,
  marketing: true,
};

export interface CookieCategoryMeta {
  id: CookieConsentCategory;
  name: string;
  locked: boolean;
  description: string;
  examples: string;
}

export const COOKIE_CATEGORIES: CookieCategoryMeta[] = [
  {
    id: 'necessary',
    name: 'Strictly Necessary',
    locked: true,
    description:
      'Essential for core application operation, saving your consent choice, session navigation, and local invoice workspace persistence.',
    examples: 'Consent record, active theme toggle, owner CSRF/session cookie.',
  },
  {
    id: 'functional',
    name: 'Functional Preferences',
    locked: false,
    description:
      'Remembers optional workspace ergonomics such as compact preview mode and last-used studio section preferences. Disabled unless you opt in.',
    examples: 'Compact preview density, preferred studio UI toggle.',
  },
  {
    id: 'analytics',
    name: 'Analytics & Diagnostics',
    locked: false,
    description:
      'Reserved gate for optional aggregated usage metrics. No third-party analytics SDKs are loaded in this build.',
    examples: 'Zero third-party trackers active in current release.',
  },
  {
    id: 'marketing',
    name: 'Marketing & Outreach',
    locked: false,
    description:
      'Reserved gate for optional referral attribution tags. No advertising or marketing pixels are loaded in this build.',
    examples: 'Zero advertising or marketing scripts active in current release.',
  },
];

export function loadCookieConsent(): CookieConsentRecord | null {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsentRecord;
    if (!parsed || !parsed.preferences) return null;
    return {
      version: parsed.version || '',
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      preferences: {
        necessary: true,
        functional: Boolean(parsed.preferences.functional),
        analytics: Boolean(parsed.preferences.analytics),
        marketing: Boolean(parsed.preferences.marketing),
      },
    };
  } catch {
    return null;
  }
}

export function isConsentRequired(record: CookieConsentRecord | null): boolean {
  if (!record) return true;
  return record.version !== COOKIE_POLICY_VERSION;
}

export function saveCookieConsent(preferences: Partial<CookieConsentPreferences>): CookieConsentRecord {
  const record: CookieConsentRecord = {
    version: COOKIE_POLICY_VERSION,
    updatedAt: new Date().toISOString(),
    preferences: {
      necessary: true,
      functional: Boolean(preferences.functional),
      analytics: Boolean(preferences.analytics),
      marketing: Boolean(preferences.marketing),
    },
  };
  try {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage errors gracefully
  }
  return record;
}

export function isCategoryConsented(
  record: CookieConsentRecord | null,
  category: CookieConsentCategory
): boolean {
  if (category === 'necessary') return true;
  if (!record || record.version !== COOKIE_POLICY_VERSION) return false;
  return Boolean(record.preferences[category]);
}

/**
 * Script-gating helper: optional analytics/marketing/functional hooks only execute
 * when the visitor has explicitly consented to that category under the current policy version.
 */
export function runWithCookieConsent(
  record: CookieConsentRecord | null,
  category: CookieConsentCategory,
  callback: () => void
): boolean {
  if (!isCategoryConsented(record, category)) {
    return false;
  }
  callback();
  return true;
}

const FUNCTIONAL_PREFS_STORAGE_KEY = 'uig_functional_prefs_v1';

export function loadFunctionalPreference<T>(
  record: CookieConsentRecord | null,
  key: string,
  fallback: T
): T {
  if (!isCategoryConsented(record, 'functional')) {
    return fallback;
  }
  try {
    const raw = localStorage.getItem(FUNCTIONAL_PREFS_STORAGE_KEY);
    if (!raw) return fallback;
    const map = JSON.parse(raw) as Record<string, unknown>;
    return key in map ? (map[key] as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveFunctionalPreference(
  record: CookieConsentRecord | null,
  key: string,
  value: unknown
): boolean {
  if (!isCategoryConsented(record, 'functional')) {
    return false;
  }
  try {
    const raw = localStorage.getItem(FUNCTIONAL_PREFS_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    map[key] = value;
    localStorage.setItem(FUNCTIONAL_PREFS_STORAGE_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

export function clearFunctionalPreferences(): void {
  try {
    localStorage.removeItem(FUNCTIONAL_PREFS_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
