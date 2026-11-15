import { useEffect, useState, type FormEvent } from 'react';
import {
  Search,
  CheckCircle2,
  Plus,
  Link2,
  Unlink,
  Building2,
  X,
  Globe,
  AlertTriangle,
  XCircle,
  RefreshCw,
  BookOpen,
} from 'lucide-react';
import type {
  ConnectedPaymentAccount,
  PaymentConnectionStatus,
  PaymentProviderCategory,
  PaymentProviderDef,
  PaymentProviderServerStatus,
} from '../types/invoice';
import { PAYMENT_PROVIDER_CATALOG } from '../data/paymentCatalog';
import { OwnerAuthError, ownerFetch } from '../utils/apiClient';

interface PaymentGatewaysViewProps {
  accounts: ConnectedPaymentAccount[];
  onUpsertAccount: (account: ConnectedPaymentAccount) => void;
  onRemoveAccount: (id: string) => void;
  onToggleDefault: (id: string) => void;
  onRequireOwnerAuth?: (reason: string) => void;
}

type CategoryTab = 'all' | PaymentProviderCategory | 'configured';

function StatusBadge({ status }: { status: PaymentConnectionStatus }) {
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>Live Verified</span>
      </span>
    );
  }
  if (status === 'credentials_configured') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-400 shrink-0">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>Credentials Set</span>
      </span>
    );
  }
  if (status === 'verification_pending') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 shrink-0">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>Verification Pending</span>
      </span>
    );
  }
  if (status === 'unavailable') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400 shrink-0">
        <XCircle className="h-3.5 w-3.5" />
        <span>Unavailable</span>
      </span>
    );
  }
  return <span className="text-[11px] text-slate-400 shrink-0">Not Configured</span>;
}

export function PaymentGatewaysView({
  accounts,
  onUpsertAccount,
  onRemoveAccount,
  onToggleDefault,
  onRequireOwnerAuth,
}: PaymentGatewaysViewProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryTab>('all');
  const [connectingProvider, setConnectingProvider] = useState<PaymentProviderDef | null>(null);
  const [guideProvider, setGuideProvider] = useState<{
    name: string;
    server?: PaymentProviderServerStatus;
  } | null>(null);
  const [customBankOpen, setCustomBankOpen] = useState(false);

  const [serverStatuses, setServerStatuses] = useState<
    Record<string, PaymentProviderServerStatus>
  >({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // Connect existing provider modal form
  const [accountTitle, setAccountTitle] = useState('');
  const [accountIdentifier, setAccountIdentifier] = useState('');
  const [secondaryDetail, setSecondaryDetail] = useState('');
  const [enabledByDefault, setEnabledByDefault] = useState(true);

  // Custom bank modal form
  const [customBankName, setCustomBankName] = useState('');
  const [customRegion, setCustomRegion] = useState('International / Local Bank');
  const [customTitle, setCustomTitle] = useState('');
  const [customIban, setCustomIban] = useState('');
  const [customSwift, setCustomSwift] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const refreshServerStatuses = async () => {
    const catalogIds = PAYMENT_PROVIDER_CATALOG.map((p) => p.id);
    const localIds = accounts.filter((a) => a.connected).map((a) => a.providerId);
    const qs = new URLSearchParams({
      catalogIds: catalogIds.join(','),
      localIds: localIds.join(','),
    });
    try {
      const res = await fetch(`/api/payment-providers?${qs.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        providers?: Record<string, PaymentProviderServerStatus>;
      };
      if (data.providers) {
        setServerStatuses(data.providers);
      }
    } catch {
      // Offline / dev check graceful fallback
    }
  };

  useEffect(() => {
    refreshServerStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length]);

  const handleVerifyProvider = async (providerId: string, hasLocal: boolean) => {
    setVerifyingId(providerId);
    try {
      const res = await ownerFetch(`/api/payment-providers/${encodeURIComponent(providerId)}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hasLocalIdentifier: hasLocal }),
      });
      if (!res.ok) throw new Error('Verification request failed.');
      const data = (await res.json()) as { provider?: PaymentProviderServerStatus };
      if (data.provider) {
        const verified = data.provider;
        setServerStatuses((prev) => ({ ...prev, [providerId]: verified }));
        flash(
          verified.status === 'verified'
            ? `${providerId.toUpperCase()} live API probe succeeded (${verified.mode}).`
            : verified.errorDetail || `${providerId.toUpperCase()} status: ${verified.status}.`
        );
      }
    } catch (err) {
      if (err instanceof OwnerAuthError) {
        if (onRequireOwnerAuth) {
          onRequireOwnerAuth('Sign in as workspace owner to run live server gateway verification.');
        } else {
          flash(err.message);
        }
      } else {
        flash('Unable to reach server adapter verification endpoint.');
      }
    } finally {
      setVerifyingId(null);
    }
  };

  const openConnectModal = (provider: PaymentProviderDef) => {
    const existing = accounts.find((a) => a.providerId === provider.id);
    setConnectingProvider(provider);
    setAccountTitle(existing?.accountTitle || 'Meridian Digital Studio');
    setAccountIdentifier(existing?.accountIdentifier || '');
    setSecondaryDetail(existing?.secondaryDetail || '');
    setEnabledByDefault(existing ? existing.enabledByDefault : true);
    setFormError(null);
  };

  const handleSaveProvider = (e: FormEvent) => {
    e.preventDefault();
    if (!connectingProvider) return;
    if (!accountIdentifier.trim()) {
      setFormError(`Please enter your ${connectingProvider.accountLabel}.`);
      return;
    }

    const existing = accounts.find((a) => a.providerId === connectingProvider.id);
    const serverStatus = serverStatuses[connectingProvider.id]?.status;
    onUpsertAccount({
      id: existing?.id ?? `acc-${connectingProvider.id}-${Date.now()}`,
      providerId: connectingProvider.id,
      providerName: connectingProvider.name,
      shortCode: connectingProvider.shortCode,
      category: connectingProvider.category,
      supportsOnlineCheckout: connectingProvider.supportsOnlineCheckout,
      connected: true,
      connectionStatus: serverStatus ?? 'verification_pending',
      enabledByDefault,
      accountTitle: accountTitle.trim() || 'Business Account',
      accountIdentifier: accountIdentifier.trim(),
      secondaryDetail: secondaryDetail.trim() || undefined,
      region: connectingProvider.region,
      accentHex: connectingProvider.accentHex,
    });
    flash(
      `${connectingProvider.name} account identifier saved for invoices. Check server adapter status to verify live webhook settlement.`
    );
    setConnectingProvider(null);
    refreshServerStatuses();
  };

  const handleSaveCustomBank = (e: FormEvent) => {
    e.preventDefault();
    if (!customBankName.trim() || !customIban.trim()) {
      setFormError('Please enter both Bank Name and Account / IBAN Number.');
      return;
    }

    const code = customBankName
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 4)
      .toUpperCase();

    onUpsertAccount({
      id: `acc-custom-${Date.now()}`,
      providerId: `custom-${Date.now()}`,
      providerName: customBankName.trim(),
      shortCode: code || 'BANK',
      category: 'custom_bank',
      supportsOnlineCheckout: false,
      connected: true,
      connectionStatus: 'not_configured',
      enabledByDefault: true,
      accountTitle: customTitle.trim() || 'Business Account',
      accountIdentifier: customIban.trim(),
      secondaryDetail: customSwift.trim() ? `SWIFT/BIC: ${customSwift.trim()}` : undefined,
      region: customRegion.trim() || 'National / International Bank',
      accentHex: '#0F172A',
    });

    flash(`${customBankName.trim()} added for invoice remittance instructions.`);
    setCustomBankOpen(false);
    setCustomBankName('');
    setCustomTitle('');
    setCustomIban('');
    setCustomSwift('');
  };

  const customBanks = accounts.filter((a) => a.category === 'custom_bank');
  const configuredCount = accounts.filter((a) => a.connected).length;

  const filteredProviders = PAYMENT_PROVIDER_CATALOG.filter((p) => {
    const acc = accounts.find((a) => a.providerId === p.id);
    if (category === 'configured' && !acc?.connected) return false;
    if (
      category !== 'all' &&
      category !== 'configured' &&
      p.category !== category
    ) {
      return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return `${p.name} ${p.shortCode} ${p.region}`.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Payment Gateways &amp; Banking
          </h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Configure payment methods for invoices. Automated online checkout status reflects actual
            server credentials &amp; webhook verification—never fake-connected local labels.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refreshServerStatuses}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Check Server Adapters</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setCustomBankOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Add Any National / International Bank</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200"
        >
          {notice}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(
              [
                { id: 'all', label: 'All Providers' },
                { id: 'configured', label: `Enabled on Invoices (${configuredCount})` },
                { id: 'global', label: 'Global Gateways' },
                { id: 'wallet', label: 'Wallets & Fintechs' },
                { id: 'bank', label: 'National & Commercial Banks' },
              ] as { id: CategoryTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategory(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  category === tab.id
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Stripe, Meezan, UBL..."
              aria-label="Search payment gateways and banks"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/70 py-1.5 pl-9 pr-3 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Custom Added Banks Section */}
      {customBanks.length > 0 &&
        (category === 'all' || category === 'configured' || category === 'custom_bank') && (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Custom National &amp; International Banks (Manual Remittance)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {customBanks.map((acc) => (
                <article
                  key={acc.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                        style={{ backgroundColor: acc.accentHex }}
                      >
                        {acc.shortCode}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {acc.providerName}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">{acc.region}</div>
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 shrink-0">
                      Manual Transfer
                    </span>
                  </div>

                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs space-y-0.5 dark:bg-slate-800/50">
                    <div className="font-medium text-slate-800 dark:text-slate-200">
                      {acc.accountTitle}
                    </div>
                    <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 break-all">
                      {acc.accountIdentifier}
                    </div>
                    {acc.secondaryDetail && (
                      <div className="text-[11px] text-slate-500">{acc.secondaryDetail}</div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={acc.enabledByDefault}
                        onChange={() => onToggleDefault(acc.id)}
                        className="rounded accent-blue-700"
                      />
                      <span>Default on invoices</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => onRemoveAccount(acc.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline"
                    >
                      <Unlink className="h-3 w-3" />
                      <span>Remove</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

      {/* Provider Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredProviders.map((provider) => {
          const savedAcc = accounts.find((a) => a.providerId === provider.id && a.connected);
          const srv = serverStatuses[provider.id];
          const computedStatus: PaymentConnectionStatus =
            srv?.status ?? (savedAcc ? 'verification_pending' : 'not_configured');

          return (
            <article
              key={provider.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 space-y-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                      style={{ backgroundColor: provider.accentHex }}
                    >
                      {provider.shortCode}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {provider.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {provider.region}
                        {srv?.checkoutSupported ? ' · Live Checkout' : ''}
                      </p>
                    </div>
                  </div>

                  <StatusBadge status={computedStatus} />
                </div>

                {savedAcc ? (
                  <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs space-y-0.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {savedAcc.accountTitle}
                    </div>
                    <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate">
                      {savedAcc.accountIdentifier}
                    </div>
                    {savedAcc.secondaryDetail && (
                      <div className="text-[11px] text-slate-500 truncate">
                        {savedAcc.secondaryDetail}
                      </div>
                    )}
                    {srv?.errorDetail && (
                      <div className="pt-1 text-[10px] text-amber-700 dark:text-amber-400">
                        {srv.errorDetail}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {provider.supportsOnlineCheckout
                      ? 'Supports server-verified checkout & webhooks when API credentials are configured.'
                      : 'Displays IBAN & bank transfer remittance details on generated invoices.'}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  {savedAcc && (
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={savedAcc.enabledByDefault}
                        onChange={() => onToggleDefault(savedAcc.id)}
                        className="rounded accent-blue-700"
                      />
                      <span>Default</span>
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => setGuideProvider({ name: provider.name, server: srv })}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-blue-700 dark:text-slate-400"
                  >
                    <BookOpen className="h-3 w-3" />
                    <span>Setup Guide</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {savedAcc ? (
                    <>
                      <button
                        type="button"
                        disabled={verifyingId === provider.id}
                        onClick={() => handleVerifyProvider(provider.id, true)}
                        className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                      >
                        {verifyingId === provider.id ? 'Checking...' : 'Verify'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openConnectModal(provider)}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onRemoveAccount(savedAcc.id);
                          flash(`${provider.name} removed from invoice accounts.`);
                        }}
                        className="text-xs font-medium text-rose-600 hover:underline"
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openConnectModal(provider)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-blue-600 hover:text-blue-700 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      <span>Configure {provider.shortCode}</span>
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Setup Guide Modal */}
      {guideProvider && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Setup Guide for ${guideProvider.name}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {guideProvider.name} — Integration &amp; Security Guide
              </h3>
              <button
                type="button"
                onClick={() => setGuideProvider(null)}
                aria-label="Close setup guide"
                className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>{guideProvider.server?.setupSummary}</p>

              {guideProvider.server && guideProvider.server.requiredEnvVars.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5 dark:border-slate-700 dark:bg-slate-800/50">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    Required Server Environment Variables (.env)
                  </div>
                  {guideProvider.server.requiredEnvVars.map((envVar) => {
                    const isSet = guideProvider.server?.configuredEnvVars.includes(envVar);
                    return (
                      <div key={envVar} className="flex items-center justify-between font-mono text-[11px]">
                        <span>{envVar}</span>
                        <span className={isSet ? 'text-emerald-600' : 'text-amber-600'}>
                          {isSet ? 'Configured on Server' : 'Not Set'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {guideProvider.server?.webhookSupported && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    Webhook Endpoint (HMAC Verified)
                  </div>
                  <div className="mt-1 font-mono text-[11px] break-all text-blue-700 dark:text-blue-400">
                    {guideProvider.server.webhookEndpoint}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-slate-500">
                Security rule: Secret keys belong exclusively in server environment variables (never
                stored in browser localStorage).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Connect Provider Modal */}
      {connectingProvider && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Configure ${connectingProvider.name}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded text-[10px] font-bold text-white"
                  style={{ backgroundColor: connectingProvider.accentHex }}
                >
                  {connectingProvider.shortCode}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Configure {connectingProvider.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConnectingProvider(null)}
                aria-label="Close configure gateway dialog"
                className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProvider} className="p-5 space-y-4">
              {formError && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {formError}
                </div>
              )}

              <div>
                <label
                  htmlFor="gw-title"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Account Title / Display Label
                </label>
                <input
                  id="gw-title"
                  type="text"
                  value={accountTitle}
                  onChange={(e) => setAccountTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="gw-identifier"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  {connectingProvider.accountLabel} *
                </label>
                <input
                  id="gw-identifier"
                  type="text"
                  value={accountIdentifier}
                  onChange={(e) => setAccountIdentifier(e.target.value)}
                  placeholder={connectingProvider.accountPlaceholder}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              {connectingProvider.secondaryLabel && (
                <div>
                  <label
                    htmlFor="gw-secondary"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    {connectingProvider.secondaryLabel}
                  </label>
                  <input
                    id="gw-secondary"
                    type="text"
                    value={secondaryDetail}
                    onChange={(e) => setSecondaryDetail(e.target.value)}
                    placeholder={connectingProvider.secondaryPlaceholder}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={enabledByDefault}
                  onChange={(e) => setEnabledByDefault(e.target.checked)}
                  className="rounded accent-blue-700"
                />
                <span>Offer this payment method by default on new invoices</span>
              </label>

              <p className="text-[11px] text-slate-500">
                Public remittance identifiers are stored here to display on invoices. Never paste
                secret API keys here—add secret keys to server environment variables instead.
              </p>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setConnectingProvider(null)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
                >
                  Save Payment Method
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom National / International Bank Modal */}
      {customBankOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add Custom National or International Bank"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-700" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Add National / International Bank
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCustomBankOpen(false)}
                aria-label="Close custom bank dialog"
                className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomBank} className="p-5 space-y-3">
              {formError && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {formError}
                </div>
              )}

              <div>
                <label
                  htmlFor="cb-name"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Bank Name *
                </label>
                <input
                  id="cb-name"
                  type="text"
                  value={customBankName}
                  onChange={(e) => setCustomBankName(e.target.value)}
                  placeholder="e.g. HSBC UK, Emirates NBD, Chase, Bank Islami"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="cb-region"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Country / Network
                </label>
                <input
                  id="cb-region"
                  type="text"
                  value={customRegion}
                  onChange={(e) => setCustomRegion(e.target.value)}
                  placeholder="e.g. UAE · IBAN / SWIFT"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="cb-title"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Account Title
                </label>
                <input
                  id="cb-title"
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Meridian Digital Studio"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="cb-iban"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  IBAN / Account Number *
                </label>
                <input
                  id="cb-iban"
                  type="text"
                  value={customIban}
                  onChange={(e) => setCustomIban(e.target.value)}
                  placeholder="GB29 NWBK 6016 1331 9268 19"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="cb-swift"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  SWIFT / BIC / Routing Code
                </label>
                <input
                  id="cb-swift"
                  type="text"
                  value={customSwift}
                  onChange={(e) => setCustomSwift(e.target.value)}
                  placeholder="NWBKGB2L"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCustomBankOpen(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span>Add Bank Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
