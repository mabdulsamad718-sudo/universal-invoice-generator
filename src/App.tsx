import { useEffect, useState } from 'react';
import type {
  AppSettings,
  ClientProfile,
  ConnectedPaymentAccount,
  CookieConsentPreferences,
  CookieConsentRecord,
  Invoice,
  InvoiceNumberConfig,
  InvoiceStatus,
  NavSection,
  OwnerSessionStatus,
  RecurringDeliveryStatus,
  RecurringInvoiceSchedule,
  RecurringStatus,
  SavedAssetItem,
  SavedBusinessProfile,
  TemplateId,
} from './types/invoice';
import {
  createBlankInvoice,
  DEFAULT_BUSINESS_PROFILE,
  DEFAULT_SETTINGS,
  INITIAL_INVOICES,
} from './data/seedData';
import {
  INITIAL_CLIENTS,
  INITIAL_PAYMENT_ACCOUNTS,
  INITIAL_RECURRING_SCHEDULES,
} from './data/paymentCatalog';
import { fetchOwnerSession, ownerFetch } from './utils/apiClient';
import { suggestNextInvoiceNumber } from './utils/calculations';
import {
  clearFunctionalPreferences,
  isCategoryConsented,
  loadCookieConsent,
  runWithCookieConsent,
  saveCookieConsent,
} from './utils/cookieConsent';
import {
  advanceRecurringDate,
  buildDirectPaymentUrl,
  createInvoiceFromSchedule,
  processDueRecurringSchedules,
} from './utils/recurring';
import { LayoutShell } from './components/LayoutShell';
import { DashboardView } from './components/DashboardView';
import { CreateInvoiceView } from './components/CreateInvoiceView';
import { AllInvoicesView } from './components/AllInvoicesView';
import { RecurringInvoicesView } from './components/RecurringInvoicesView';
import { ClientsView } from './components/ClientsView';
import { PaymentGatewaysView } from './components/PaymentGatewaysView';
import { TemplatesView } from './components/TemplatesView';
import { BusinessProfileView } from './components/BusinessProfileView';
import { SettingsView } from './components/SettingsView';
import { AboutUsView } from './components/AboutUsView';
import { LegalPagesView } from './components/LegalPagesView';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { SharedInvoiceView } from './components/SharedInvoiceView';
import { InvoicePreviewModal } from './components/InvoicePreviewModal';
import { ClientPaymentPortalModal } from './components/ClientPaymentPortalModal';
import { OwnerAuthModal } from './components/OwnerAuthModal';

const STORAGE_KEYS = {
  invoices: 'uig_invoices_v1',
  profile: 'uig_business_profile_v1',
  settings: 'uig_settings_v1',
  clients: 'uig_clients_v1',
  recurring: 'uig_recurring_v1',
  paymentAccounts: 'uig_payment_accounts_v1',
};

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getShareParamFromLocation(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const share = params.get('share');
    return share && share.trim().length > 0 ? share.trim() : null;
  } catch {
    return null;
  }
}

function buildInitialBlankDraft(
  profile: SavedBusinessProfile,
  allInvoices: Invoice[],
  accounts: ConnectedPaymentAccount[],
  template: TemplateId = 'modern',
  numberingConfig?: Partial<InvoiceNumberConfig>
): Invoice {
  const issueYear = new Date().getFullYear();
  const nextNum = suggestNextInvoiceNumber(allInvoices, issueYear, numberingConfig);
  const blank = createBlankInvoice(profile, nextNum, template);
  const defaultPaymentIds = accounts
    .filter((acc) => acc.connected && acc.enabledByDefault)
    .map((acc) => acc.id);
  const origin = typeof window !== 'undefined' ? window.location.origin : undefined;

  return {
    ...blank,
    enabledPaymentIds: defaultPaymentIds,
    paymentLink: buildDirectPaymentUrl(nextNum, origin),
  };
}

export default function App() {
  const [activeShareToken, setActiveShareToken] = useState<string | null>(() =>
    typeof window !== 'undefined' ? getShareParamFromLocation() : null
  );

  const [cookieConsent, setCookieConsent] = useState<CookieConsentRecord | null>(() =>
    typeof window !== 'undefined' ? loadCookieConsent() : null
  );
  const [cookiePrefsOpen, setCookiePrefsOpen] = useState(false);

  const [ownerSession, setOwnerSession] = useState<OwnerSessionStatus | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authPromptReason, setAuthPromptReason] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  const [businessProfile, setBusinessProfile] = useState<SavedBusinessProfile>(() =>
    loadStored<SavedBusinessProfile>(STORAGE_KEYS.profile, DEFAULT_BUSINESS_PROFILE)
  );
  const [settings, setSettings] = useState<AppSettings>(() =>
    loadStored<AppSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS)
  );
  const [clients, setClients] = useState<ClientProfile[]>(() =>
    loadStored<ClientProfile[]>(STORAGE_KEYS.clients, INITIAL_CLIENTS)
  );
  const [paymentAccounts, setPaymentAccounts] = useState<ConnectedPaymentAccount[]>(() =>
    loadStored<ConnectedPaymentAccount[]>(STORAGE_KEYS.paymentAccounts, INITIAL_PAYMENT_ACCOUNTS)
  );

  // Run any due recurring schedules deterministically once during initial state bootstrap
  const [initialAutomation] = useState(() => {
    const storedInvoices = loadStored<Invoice[]>(STORAGE_KEYS.invoices, INITIAL_INVOICES);
    const storedSchedules = loadStored<RecurringInvoiceSchedule[]>(
      STORAGE_KEYS.recurring,
      INITIAL_RECURRING_SCHEDULES
    );
    const storedProfile = loadStored<SavedBusinessProfile>(
      STORAGE_KEYS.profile,
      DEFAULT_BUSINESS_PROFILE
    );
    const storedSettings = loadStored<AppSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    const todayIso = new Date().toISOString().slice(0, 10);
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { updatedSchedules, generatedInvoices } = processDueRecurringSchedules(
      storedSchedules,
      storedInvoices,
      storedProfile,
      todayIso,
      6,
      origin,
      storedSettings.numberingConfig
    );
    return {
      invoices:
        generatedInvoices.length > 0
          ? [...generatedInvoices, ...storedInvoices]
          : storedInvoices,
      schedules: updatedSchedules,
    };
  });

  const [invoices, setInvoices] = useState<Invoice[]>(initialAutomation.invoices);
  const [recurringSchedules, setRecurringSchedules] = useState<RecurringInvoiceSchedule[]>(
    initialAutomation.schedules
  );

  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');

  const [draftInvoice, setDraftInvoice] = useState<Invoice>(() => {
    const storedSettings = loadStored<AppSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    return buildInitialBlankDraft(
      loadStored<SavedBusinessProfile>(STORAGE_KEYS.profile, DEFAULT_BUSINESS_PROFILE),
      initialAutomation.invoices,
      loadStored<ConnectedPaymentAccount[]>(STORAGE_KEYS.paymentAccounts, INITIAL_PAYMENT_ACCOUNTS),
      'modern',
      storedSettings.numberingConfig
    );
  });
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [adhocPreviewInvoice, setAdhocPreviewInvoice] = useState<Invoice | null>(null);
  const [paymentPortalInvoiceId, setPaymentPortalInvoiceId] = useState<string | null>(null);
  const [adhocPortalInvoice, setAdhocPortalInvoice] = useState<Invoice | null>(null);

  // Sync ?share= query param on popstate
  useEffect(() => {
    const onPop = () => {
      setActiveShareToken(getShareParamFromLocation());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Support direct ?pay=INV-XXXX deep links on mount
  useEffect(() => {
    if (activeShareToken) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const payParam = params.get('pay');
      if (!payParam) return;
      const match = invoices.find(
        (inv) => inv.id === payParam || inv.invoiceNumber.toLowerCase() === payParam.toLowerCase()
      );
      if (match) {
        setPaymentPortalInvoiceId(match.id);
      }
    } catch {
      // Ignore malformed query string
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch owner session status on mount
  useEffect(() => {
    if (activeShareToken) return;
    fetchOwnerSession()
      .then((session) => setOwnerSession(session))
      .catch(() => {});
  }, [activeShareToken]);

  const requestOwnerAuth = (reason: string) => {
    setAuthPromptReason(reason);
    setAuthModalOpen(true);
  };

  // Respect user's explicit Cookie Consent preferences for functional workspace storage
  useEffect(() => {
    const ran = runWithCookieConsent(cookieConsent, 'functional', () => {
      document.documentElement.dataset.functionalConsent = 'granted';
    });
    if (!ran || !isCategoryConsented(cookieConsent, 'functional')) {
      delete document.documentElement.dataset.functionalConsent;
      clearFunctionalPreferences();
    }
  }, [cookieConsent]);

  const persistStored = (key: string, value: unknown, label: string) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      setStorageWarning(
        `Browser storage quota reached while saving ${label}. Export critical invoices to PDF and remove large unused uploaded assets.`
      );
    }
  };

  useEffect(() => {
    persistStored(STORAGE_KEYS.invoices, invoices, 'invoices');
  }, [invoices]);

  useEffect(() => {
    persistStored(STORAGE_KEYS.profile, businessProfile, 'business profile');
  }, [businessProfile]);

  useEffect(() => {
    persistStored(STORAGE_KEYS.settings, settings, 'settings');
    const isDark = settings.theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
  }, [settings]);

  useEffect(() => {
    persistStored(STORAGE_KEYS.clients, clients, 'clients');
  }, [clients]);

  useEffect(() => {
    persistStored(STORAGE_KEYS.recurring, recurringSchedules, 'recurring schedules');
  }, [recurringSchedules]);

  useEffect(() => {
    persistStored(STORAGE_KEYS.paymentAccounts, paymentAccounts, 'payment accounts');
  }, [paymentAccounts]);

  // Sync recurring schedules & profile to backend store when signed in as workspace owner
  useEffect(() => {
    if (!ownerSession?.authenticated || activeShareToken) return;
    ownerFetch('/api/recurring/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schedules: recurringSchedules,
        businessProfile,
      }),
    }).catch(() => {});
  }, [ownerSession?.authenticated, recurringSchedules, businessProfile, activeShareToken]);

  const handleSaveCookiePreferences = (prefs: Partial<CookieConsentPreferences>) => {
    const saved = saveCookieConsent(prefs);
    setCookieConsent(saved);
  };

  const handleStartNewInvoice = (template: TemplateId = 'modern', accentColor?: string) => {
    const fresh = buildInitialBlankDraft(
      businessProfile,
      invoices,
      paymentAccounts,
      template,
      settings.numberingConfig
    );
    if (accentColor) {
      fresh.design.accentColor = accentColor;
    }
    setDraftInvoice(fresh);
    setEditingInvoiceId(null);
    setActiveNav('create');
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setDraftInvoice(structuredClone(invoice));
    setEditingInvoiceId(invoice.id);
    setPreviewInvoiceId(null);
    setAdhocPreviewInvoice(null);
    setActiveNav('create');
  };

  const handleSaveInvoice = (invoiceToSave: Invoice, statusOverride?: InvoiceStatus) => {
    const finalStatus = statusOverride ?? invoiceToSave.status;
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
    const updatedRecord: Invoice = {
      ...invoiceToSave,
      status: finalStatus,
      paymentLink:
        invoiceToSave.paymentLink ||
        buildDirectPaymentUrl(invoiceToSave.invoiceNumber, origin, invoiceToSave.shareToken),
      updatedAt: new Date().toISOString(),
    };

    setInvoices((prev) => {
      const exists = prev.some((inv) => inv.id === updatedRecord.id);
      if (exists) {
        return prev.map((inv) => (inv.id === updatedRecord.id ? updatedRecord : inv));
      }
      return [updatedRecord, ...prev];
    });

    setDraftInvoice(updatedRecord);
    setEditingInvoiceId(updatedRecord.id);
  };

  const handleDuplicateInvoice = (source: Invoice) => {
    const issueYear = new Date().getFullYear();
    const nextNum = suggestNextInvoiceNumber(invoices, issueYear, settings.numberingConfig);
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
    const clone: Invoice = {
      ...structuredClone(source),
      id: `inv-${Date.now()}`,
      invoiceNumber: nextNum,
      status: 'draft',
      issueDate: new Date().toISOString().slice(0, 10),
      shareToken: undefined,
      shareEnabled: false,
      shareExpiresAt: undefined,
      paymentLink: buildDirectPaymentUrl(nextNum, origin),
      updatedAt: new Date().toISOString(),
    };
    setInvoices((prev) => [clone, ...prev]);
  };

  const handleDeleteInvoice = (id: string) => {
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    if (editingInvoiceId === id) {
      setEditingInvoiceId(null);
    }
    if (previewInvoiceId === id) {
      setPreviewInvoiceId(null);
    }
    if (paymentPortalInvoiceId === id) {
      setPaymentPortalInvoiceId(null);
    }
  };

  const handleUpdateStatus = (
    id: string,
    status: InvoiceStatus,
    extraPatch?: Partial<Invoice>
  ) => {
    const updatedAt = new Date().toISOString();
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, status, ...extraPatch, updatedAt } : inv))
    );
    if (draftInvoice.id === id) {
      setDraftInvoice((prev) => ({ ...prev, status, ...extraPatch, updatedAt }));
    }
    if (adhocPreviewInvoice?.id === id) {
      setAdhocPreviewInvoice((prev) => (prev ? { ...prev, status, ...extraPatch, updatedAt } : null));
    }
    if (adhocPortalInvoice?.id === id) {
      setAdhocPortalInvoice((prev) => (prev ? { ...prev, status, ...extraPatch, updatedAt } : null));
    }
  };

  const handleUpdateInvoiceShare = (
    invoiceId: string,
    patch: Partial<Pick<Invoice, 'shareToken' | 'shareEnabled' | 'shareExpiresAt' | 'paymentLink'>>
  ) => {
    const updatedAt = new Date().toISOString();
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === invoiceId ? { ...inv, ...patch, updatedAt } : inv))
    );
    if (draftInvoice.id === invoiceId) {
      setDraftInvoice((prev) => ({ ...prev, ...patch, updatedAt }));
    }
    if (adhocPreviewInvoice?.id === invoiceId) {
      setAdhocPreviewInvoice((prev) => (prev ? { ...prev, ...patch, updatedAt } : null));
    }
  };

  const handleUpdateInvoiceDelivery = (
    invoiceId: string,
    deliveryStatus: RecurringDeliveryStatus,
    deliveryError?: string,
    scheduleId?: string
  ) => {
    const nextInvoiceStatus: InvoiceStatus | undefined =
      deliveryStatus === 'sent' || deliveryStatus === 'accepted_by_smtp' ? 'sent' : undefined;
    const updatedAt = new Date().toISOString();
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId
          ? {
              ...inv,
              deliveryStatus,
              deliveryError,
              status: nextInvoiceStatus ?? inv.status,
              updatedAt,
            }
          : inv
      )
    );
    if (scheduleId) {
      setRecurringSchedules((prev) =>
        prev.map((s) =>
          s.id === scheduleId
            ? {
                ...s,
                lastDeliveryStatus: deliveryStatus,
                lastDeliveryDetail: deliveryError,
              }
            : s
        )
      );
    }
  };

  const handleSaveBusinessProfilePatch = (patch: Partial<SavedBusinessProfile>) => {
    setBusinessProfile((prev) => ({ ...prev, ...patch }));
  };

  const handleSaveSignatureToProfile = (dataUrl: string, label: string) => {
    const asset: SavedAssetItem = {
      id: `sig-lib-${Date.now()}`,
      kind: 'signature',
      label: label || 'Authorized Signature',
      dataUrl,
      createdAt: new Date().toISOString(),
    };
    setBusinessProfile((prev) => ({
      ...prev,
      savedSignatureDataUrl: dataUrl,
      savedSignatureLabel: asset.label,
      savedSignatures: [
        asset,
        ...(prev.savedSignatures ?? []).filter((item) => item.dataUrl !== dataUrl),
      ],
    }));
  };

  const handleSaveStampToProfile = (dataUrl: string, label: string) => {
    const asset: SavedAssetItem = {
      id: `stamp-lib-${Date.now()}`,
      kind: 'stamp',
      label: label || 'Company Seal',
      dataUrl,
      createdAt: new Date().toISOString(),
    };
    setBusinessProfile((prev) => ({
      ...prev,
      savedStampDataUrl: dataUrl,
      savedStampLabel: asset.label,
      savedStamps: [
        asset,
        ...(prev.savedStamps ?? []).filter((item) => item.dataUrl !== dataUrl),
      ],
    }));
  };

  const handleRemoveSavedAsset = (kind: 'signature' | 'stamp', assetId: string) => {
    setBusinessProfile((prev) => {
      if (kind === 'signature') {
        const target = (prev.savedSignatures ?? []).find((s) => s.id === assetId);
        const remaining = (prev.savedSignatures ?? []).filter((s) => s.id !== assetId);
        return {
          ...prev,
          savedSignatures: remaining,
          savedSignatureDataUrl:
            target && prev.savedSignatureDataUrl === target.dataUrl
              ? remaining[0]?.dataUrl ?? ''
              : prev.savedSignatureDataUrl,
        };
      }
      const target = (prev.savedStamps ?? []).find((s) => s.id === assetId);
      const remaining = (prev.savedStamps ?? []).filter((s) => s.id !== assetId);
      return {
        ...prev,
        savedStamps: remaining,
        savedStampDataUrl:
          target && prev.savedStampDataUrl === target.dataUrl
            ? remaining[0]?.dataUrl ?? ''
            : prev.savedStampDataUrl,
      };
    });
  };

  // Client Management Handlers
  const handleAddClient = (clientData: Omit<ClientProfile, 'id' | 'createdAt'>) => {
    const created: ClientProfile = {
      ...clientData,
      id: `cli-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setClients((prev) => [created, ...prev]);
  };

  const handleUpdateClient = (updated: ClientProfile) => {
    setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleDeleteClient = (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
  };

  const handleCreateInvoiceForClient = (client: ClientProfile) => {
    const fresh = buildInitialBlankDraft(
      businessProfile,
      invoices,
      paymentAccounts,
      'modern',
      settings.numberingConfig
    );
    fresh.clientId = client.id;
    fresh.customer = {
      name: client.name,
      company: client.company,
      address: client.address,
      email: client.email,
      phone: client.phone,
    };
    setDraftInvoice(fresh);
    setEditingInvoiceId(null);
    setActiveNav('create');
  };

  const handleSaveClientFromInvoice = (customer: Invoice['customer']) => {
    const cleanName = customer.name.trim();
    const cleanEmail = customer.email.trim().toLowerCase();
    const existing = clients.find(
      (c) =>
        (cleanEmail && c.email.trim().toLowerCase() === cleanEmail) ||
        (cleanName &&
          c.name.trim().toLowerCase() === cleanName.toLowerCase() &&
          c.company.trim().toLowerCase() === customer.company.trim().toLowerCase())
    );

    if (existing) {
      const updated: ClientProfile = {
        ...existing,
        name: customer.name.trim() || existing.name,
        company: customer.company.trim(),
        address: customer.address.trim(),
        email: customer.email.trim(),
        phone: customer.phone.trim(),
      };
      setClients((prev) => prev.map((c) => (c.id === existing.id ? updated : c)));
      setDraftInvoice((prev) => ({ ...prev, clientId: existing.id }));
      return;
    }

    const newClient: ClientProfile = {
      id: `cli-${Date.now()}`,
      name: customer.name.trim() || customer.company.trim() || 'Unnamed Client',
      company: customer.company.trim(),
      address: customer.address.trim(),
      email: customer.email.trim(),
      phone: customer.phone.trim(),
      notes: '',
      createdAt: new Date().toISOString(),
    };
    setClients((prev) => [newClient, ...prev]);
    setDraftInvoice((prev) => ({ ...prev, clientId: newClient.id }));
  };

  // Recurring Schedules Handlers
  const handleSaveRecurringSchedule = (schedule: RecurringInvoiceSchedule) => {
    setRecurringSchedules((prev) => {
      const exists = prev.some((s) => s.id === schedule.id);
      if (exists) {
        return prev.map((s) => (s.id === schedule.id ? schedule : s));
      }
      return [schedule, ...prev];
    });
  };

  const handleUpdateRecurringStatus = (id: string, status: RecurringStatus) => {
    setRecurringSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s))
    );
  };

  const handleDeleteRecurringSchedule = (id: string) => {
    setRecurringSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  const handleGenerateScheduleNow = (schedule: RecurringInvoiceSchedule): Invoice => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
    const generated = createInvoiceFromSchedule(
      schedule,
      todayIso,
      businessProfile,
      invoices,
      origin,
      settings.numberingConfig
    );
    setInvoices((prev) => [generated, ...prev]);

    const nextDate = advanceRecurringDate(schedule.nextRunDate || todayIso, schedule.frequency);
    const completed = Boolean(schedule.endDate && nextDate > schedule.endDate);
    setRecurringSchedules((prev) =>
      prev.map((s) =>
        s.id === schedule.id
          ? {
              ...s,
              lastGeneratedDate: todayIso,
              lastDeliveryStatus: generated.deliveryStatus,
              lastDeliveryDetail: generated.deliveryError,
              nextRunDate: nextDate,
              generatedCount: s.generatedCount + 1,
              status: completed ? 'completed' : s.status,
            }
          : s
      )
    );
    return generated;
  };

  const handleRunDueSchedules = (): Invoice[] => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { updatedSchedules, generatedInvoices } = processDueRecurringSchedules(
      recurringSchedules,
      invoices,
      businessProfile,
      todayIso,
      6,
      origin,
      settings.numberingConfig
    );
    setRecurringSchedules(updatedSchedules);
    if (generatedInvoices.length > 0) {
      setInvoices((prev) => [...generatedInvoices, ...prev]);
    }
    return generatedInvoices;
  };

  const handlePreviewScheduleInvoice = (schedule: RecurringInvoiceSchedule) => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
    const preview = createInvoiceFromSchedule(
      schedule,
      schedule.nextRunDate || todayIso,
      businessProfile,
      invoices,
      origin,
      settings.numberingConfig
    );
    setAdhocPreviewInvoice(preview);
  };

  // Payment Gateways & Banking Handlers
  const handleUpsertPaymentAccount = (account: ConnectedPaymentAccount) => {
    setPaymentAccounts((prev) => {
      const exists = prev.some((a) => a.id === account.id);
      if (exists) {
        return prev.map((a) => (a.id === account.id ? account : a));
      }
      return [...prev, account];
    });
  };

  const handleRemovePaymentAccount = (id: string) => {
    setPaymentAccounts((prev) => prev.filter((a) => a.id !== id));
    setDraftInvoice((prev) => {
      if (!prev.enabledPaymentIds) return prev;
      return {
        ...prev,
        enabledPaymentIds: prev.enabledPaymentIds.filter((pid) => pid !== id),
      };
    });
  };

  const handleTogglePaymentDefault = (id: string) => {
    setPaymentAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabledByDefault: !a.enabledByDefault } : a))
    );
  };

  const handleOpenPaymentPortal = (invoice: Invoice) => {
    if (invoices.some((i) => i.id === invoice.id)) {
      setPaymentPortalInvoiceId(invoice.id);
      setAdhocPortalInvoice(null);
    } else {
      setAdhocPortalInvoice(invoice);
      setPaymentPortalInvoiceId(null);
    }
  };

  const handleResetDemoData = () => {
    setInvoices(INITIAL_INVOICES);
    setBusinessProfile(DEFAULT_BUSINESS_PROFILE);
    setSettings(DEFAULT_SETTINGS);
    setClients(INITIAL_CLIENTS);
    setRecurringSchedules(INITIAL_RECURRING_SCHEDULES);
    setPaymentAccounts(INITIAL_PAYMENT_ACCOUNTS);
    setDraftInvoice(
      buildInitialBlankDraft(
        DEFAULT_BUSINESS_PROFILE,
        INITIAL_INVOICES,
        INITIAL_PAYMENT_ACCOUNTS,
        'modern',
        DEFAULT_SETTINGS.numberingConfig
      )
    );
    setEditingInvoiceId(null);
    setPreviewInvoiceId(null);
    setAdhocPreviewInvoice(null);
    setPaymentPortalInvoiceId(null);
    setAdhocPortalInvoice(null);
  };

  const activePreviewInvoice =
    adhocPreviewInvoice ??
    (previewInvoiceId ? invoices.find((inv) => inv.id === previewInvoiceId) ?? null : null);

  const activePortalInvoice =
    adhocPortalInvoice ??
    (paymentPortalInvoiceId
      ? invoices.find((inv) => inv.id === paymentPortalInvoiceId) ?? null
      : null);

  // Public Cross-Device Shared Invoice Route (/?share=<token>)
  if (activeShareToken) {
    return (
      <>
        <SharedInvoiceView
          shareToken={activeShareToken}
          onExitToWorkspace={() => {
            const url = new URL(window.location.href);
            url.searchParams.delete('share');
            window.history.pushState({}, '', url.toString());
            setActiveShareToken(null);
          }}
        />
        <CookieConsentBanner
          consentRecord={cookieConsent}
          preferencesOpen={cookiePrefsOpen}
          onOpenPreferences={() => setCookiePrefsOpen(true)}
          onClosePreferences={() => setCookiePrefsOpen(false)}
          onSavePreferences={handleSaveCookiePreferences}
          onNavigatePrivacy={(section) => {
            const url = new URL(window.location.href);
            url.searchParams.delete('share');
            window.history.pushState({}, '', url.toString());
            setActiveShareToken(null);
            setActiveNav(section);
          }}
        />
      </>
    );
  }

  return (
    <>
      <LayoutShell
        activeNav={activeNav}
        onNavigate={(section) => {
          setActiveNav(section);
        }}
        onOpenCookieSettings={() => setCookiePrefsOpen(true)}
        ownerSession={ownerSession}
        onOpenOwnerAuth={() => {
          setAuthPromptReason(null);
          setAuthModalOpen(true);
        }}
        storageWarning={storageWarning}
        onDismissStorageWarning={() => setStorageWarning(null)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        businessProfile={businessProfile}
        settings={settings}
        invoices={invoices}
        onSelectInvoice={(inv) => setPreviewInvoiceId(inv.id)}
      >
        {activeNav === 'dashboard' && (
          <DashboardView
            invoices={invoices}
            dateFormat={settings.dateFormat}
            onCreateNew={() => handleStartNewInvoice()}
            onViewInvoice={(inv) => setPreviewInvoiceId(inv.id)}
            onEditInvoice={handleEditInvoice}
            onNavigateAll={(filter) => {
              setStatusFilter(filter ?? 'all');
              setActiveNav('invoices');
            }}
          />
        )}

        {activeNav === 'create' && (
          <CreateInvoiceView
            invoice={draftInvoice}
            isEditingExisting={Boolean(editingInvoiceId)}
            existingInvoices={invoices}
            clients={clients}
            paymentAccounts={paymentAccounts}
            businessProfile={businessProfile}
            dateFormat={settings.dateFormat}
            numberingConfig={settings.numberingConfig}
            cookieConsent={cookieConsent}
            onChange={setDraftInvoice}
            onSaveInvoice={handleSaveInvoice}
            onSaveBusinessProfile={handleSaveBusinessProfilePatch}
            onSaveSignatureToProfile={handleSaveSignatureToProfile}
            onSaveStampToProfile={handleSaveStampToProfile}
            onRemoveSavedAsset={handleRemoveSavedAsset}
            onSaveClientFromInvoice={handleSaveClientFromInvoice}
            onNavigateGateways={() => setActiveNav('gateways')}
            onOpenPreviewModal={(inv) => setAdhocPreviewInvoice(inv)}
            onResetNew={() => handleStartNewInvoice(draftInvoice.design.template)}
          />
        )}

        {activeNav === 'invoices' && (
          <AllInvoicesView
            invoices={invoices}
            dateFormat={settings.dateFormat}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onCreateNew={() => handleStartNewInvoice()}
            onViewInvoice={(inv) => setPreviewInvoiceId(inv.id)}
            onEditInvoice={handleEditInvoice}
            onDuplicateInvoice={handleDuplicateInvoice}
            onDeleteInvoice={handleDeleteInvoice}
            onMarkPaid={(id) => {
              handleUpdateStatus(id, 'paid', {
                paymentVerificationMode: 'manual',
                paidAt: new Date().toISOString(),
              });
              if (ownerSession?.authenticated) {
                ownerFetch(`/api/invoices/${encodeURIComponent(id)}/manual-payment`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({}),
                }).catch(() => {});
              }
            }}
          />
        )}

        {activeNav === 'recurring' && (
          <RecurringInvoicesView
            schedules={recurringSchedules}
            clients={clients}
            paymentAccounts={paymentAccounts}
            dateFormat={settings.dateFormat}
            defaultCurrency={settings.defaultCurrency}
            onSaveSchedule={handleSaveRecurringSchedule}
            onUpdateStatus={handleUpdateRecurringStatus}
            onDeleteSchedule={handleDeleteRecurringSchedule}
            onGenerateNow={handleGenerateScheduleNow}
            onRunDueSchedules={handleRunDueSchedules}
            onPreviewScheduleInvoice={handlePreviewScheduleInvoice}
            onUpdateInvoiceDelivery={handleUpdateInvoiceDelivery}
            onRequireOwnerAuth={requestOwnerAuth}
          />
        )}

        {activeNav === 'clients' && (
          <ClientsView
            clients={clients}
            invoices={invoices}
            onAddClient={handleAddClient}
            onUpdateClient={handleUpdateClient}
            onDeleteClient={handleDeleteClient}
            onCreateInvoiceForClient={handleCreateInvoiceForClient}
          />
        )}

        {activeNav === 'gateways' && (
          <PaymentGatewaysView
            accounts={paymentAccounts}
            onUpsertAccount={handleUpsertPaymentAccount}
            onRemoveAccount={handleRemovePaymentAccount}
            onToggleDefault={handleTogglePaymentDefault}
            onRequireOwnerAuth={requestOwnerAuth}
          />
        )}

        {activeNav === 'templates' && (
          <TemplatesView
            businessProfile={businessProfile}
            dateFormat={settings.dateFormat}
            activeTemplate={draftInvoice.design.template}
            onUseTemplate={(tpl, accent) => handleStartNewInvoice(tpl, accent)}
          />
        )}

        {activeNav === 'profile' && (
          <BusinessProfileView
            profile={businessProfile}
            onSaveProfile={(updated) => {
              setBusinessProfile(updated);
              if (!editingInvoiceId) {
                setDraftInvoice((prev) => ({
                  ...prev,
                  business: {
                    name: updated.name,
                    logoDataUrl: updated.logoDataUrl,
                    address: updated.address,
                    phone: updated.phone,
                    email: updated.email,
                    website: updated.website,
                    taxNumber: updated.taxNumber,
                  },
                  currency: updated.defaultCurrency,
                }));
              }
            }}
          />
        )}

        {activeNav === 'settings' && (
          <SettingsView
            settings={settings}
            onSaveSettings={(updated) => {
              setSettings(updated);
              setBusinessProfile((prev) => ({
                ...prev,
                defaultCurrency: updated.defaultCurrency,
              }));
            }}
            onResetDemoData={handleResetDemoData}
            onNavigate={setActiveNav}
            onOpenCookieSettings={() => setCookiePrefsOpen(true)}
          />
        )}

        {activeNav === 'about' && <AboutUsView onNavigate={setActiveNav} />}

        {(activeNav === 'license' || activeNav === 'privacy' || activeNav === 'terms') && (
          <LegalPagesView
            section={activeNav}
            onNavigate={setActiveNav}
            onOpenCookieSettings={() => setCookiePrefsOpen(true)}
          />
        )}
      </LayoutShell>

      {activePreviewInvoice && (
        <InvoicePreviewModal
          invoice={activePreviewInvoice}
          dateFormat={settings.dateFormat}
          paymentAccounts={paymentAccounts}
          onClose={() => {
            setPreviewInvoiceId(null);
            setAdhocPreviewInvoice(null);
          }}
          onMarkPaid={(id) => {
            const extra = {
              paymentVerificationMode: 'manual' as const,
              paidAt: new Date().toISOString(),
            };
            handleUpdateStatus(id, 'paid', extra);
            if (!invoices.some((i) => i.id === id)) {
              handleSaveInvoice({ ...activePreviewInvoice, ...extra }, 'paid');
            }
            if (ownerSession?.authenticated) {
              ownerFetch(`/api/invoices/${encodeURIComponent(id)}/manual-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
              }).catch(() => {});
            }
          }}
          onSaveDraft={(id) => {
            handleUpdateStatus(id, 'draft');
            if (!invoices.some((i) => i.id === id)) {
              handleSaveInvoice(activePreviewInvoice, 'draft');
            }
          }}
          onEdit={handleEditInvoice}
          onOpenPaymentPortal={handleOpenPaymentPortal}
          onUpdateInvoiceShare={handleUpdateInvoiceShare}
          onRequireOwnerAuth={requestOwnerAuth}
        />
      )}

      {activePortalInvoice && (
        <ClientPaymentPortalModal
          invoice={activePortalInvoice}
          paymentAccounts={paymentAccounts}
          onClose={() => {
            setPaymentPortalInvoiceId(null);
            setAdhocPortalInvoice(null);
          }}
          onConfirmManualPayment={(id, reference) => {
            const extra = {
              paymentVerificationMode: 'manual' as const,
              paidAt: new Date().toISOString(),
              paymentTransactionId: reference,
            };
            handleUpdateStatus(id, 'paid', extra);
            if (!invoices.some((i) => i.id === id)) {
              handleSaveInvoice({ ...activePortalInvoice, ...extra }, 'paid');
            }
          }}
          onRequireOwnerAuth={requestOwnerAuth}
        />
      )}

      <OwnerAuthModal
        open={authModalOpen}
        session={ownerSession}
        promptReason={authPromptReason}
        onClose={() => setAuthModalOpen(false)}
        onSessionChange={(next) => setOwnerSession(next)}
      />

      <CookieConsentBanner
        consentRecord={cookieConsent}
        preferencesOpen={cookiePrefsOpen}
        onOpenPreferences={() => setCookiePrefsOpen(true)}
        onClosePreferences={() => setCookiePrefsOpen(false)}
        onSavePreferences={handleSaveCookiePreferences}
        onNavigatePrivacy={(section) => setActiveNav(section)}
      />
    </>
  );
}
