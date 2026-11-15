import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  FilePlus2,
  Files,
  Repeat,
  Users,
  CreditCard,
  LayoutTemplate,
  Building2,
  Settings,
  Info,
  Search,
  Bell,
  Menu,
  X,
  User,
  Lock,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import type {
  AppSettings,
  Invoice,
  NavSection,
  OwnerSessionStatus,
  SavedBusinessProfile,
} from '../types/invoice';

interface LayoutShellProps {
  activeNav: NavSection;
  onNavigate: (section: NavSection) => void;
  onOpenCookieSettings?: () => void;
  ownerSession?: OwnerSessionStatus | null;
  onOpenOwnerAuth?: () => void;
  storageWarning?: string | null;
  onDismissStorageWarning?: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  businessProfile: SavedBusinessProfile;
  settings: AppSettings;
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  children: ReactNode;
}

const NAV_ITEMS: { id: NavSection; label: string; Icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'create', label: 'Create Invoice', Icon: FilePlus2 },
  { id: 'invoices', label: 'All Invoices', Icon: Files },
  { id: 'recurring', label: 'Recurring', Icon: Repeat },
  { id: 'clients', label: 'Clients', Icon: Users },
  { id: 'gateways', label: 'Payment Gateways', Icon: CreditCard },
  { id: 'templates', label: 'Templates', Icon: LayoutTemplate },
  { id: 'profile', label: 'Business Profile', Icon: Building2 },
  { id: 'settings', label: 'Settings', Icon: Settings },
  { id: 'about', label: 'About Us', Icon: Info },
];

const VIEW_TITLES: Record<NavSection, string> = {
  dashboard: 'Dashboard',
  create: 'Create Invoice Studio',
  invoices: 'All Invoices',
  recurring: 'Recurring Invoices',
  clients: 'Client Directory',
  gateways: 'Payment Gateways & Banking',
  templates: 'Invoice Templates',
  profile: 'Business Profile',
  settings: 'Settings',
  about: 'About Us',
  license: 'Software License & IP',
  privacy: 'Privacy Policy',
  terms: 'Terms & Conditions',
};

export function LayoutShell({
  activeNav,
  onNavigate,
  onOpenCookieSettings,
  ownerSession,
  onOpenOwnerAuth,
  storageWarning,
  onDismissStorageWarning,
  searchQuery,
  onSearchChange,
  businessProfile,
  settings,
  invoices,
  onSelectInvoice,
  children,
}: LayoutShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const attentionInvoices = invoices.filter(
    (inv) => inv.status === 'overdue' || inv.status === 'unpaid'
  );

  const handleNavClick = (section: NavSection) => {
    onNavigate(section);
    setMobileMenuOpen(false);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200 dark:bg-slate-900 dark:border-slate-800">
      <div>
        {/* Brand Lockup */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-blue-700">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M8 13h8" />
              <path d="M8 17h5" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
              Universal Invoice
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
              Create. Customize. Invoice.
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav aria-label="Primary Navigation" className="px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const isActive = activeNav === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleNavClick(id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? 'text-blue-700 dark:text-blue-300' : 'text-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Active Business Identity Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => handleNavClick('profile')}
          className="flex w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-left hover:bg-slate-100/70 transition-colors dark:border-slate-800 dark:bg-slate-800/50 dark:hover:bg-slate-800"
        >
          {businessProfile.logoDataUrl ? (
            <img
              src={businessProfile.logoDataUrl}
              alt={businessProfile.name}
              className="h-8 w-8 rounded object-contain shrink-0 bg-white border border-slate-200"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-900 text-xs font-bold text-white">
              {(businessProfile.name || 'UI').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
              {businessProfile.name || 'Configure Business'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Default: {businessProfile.defaultCurrency}
            </div>
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:block lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="absolute right-3 top-4 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Bar */}
        <header className="no-print sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 backdrop-blur-sm px-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="inline-flex lg:hidden items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100 truncate">
              {VIEW_TITLES[activeNav]}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Search Input */}
            <div className="relative hidden md:block w-56 lg:w-64">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  if (activeNav !== 'invoices' && e.target.value.trim().length > 0) {
                    onNavigate('invoices');
                  }
                }}
                placeholder="Search invoices or clients..."
                aria-label="Search invoices"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/70 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
              />
            </div>

            {/* Notifications Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((prev) => !prev)}
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <Bell className="h-4 w-4" />
                {attentionInvoices.length > 0 && (
                  <span className="sr-only">{attentionInvoices.length} invoice reminders</span>
                )}
              </button>

              {notificationsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setNotificationsOpen(false)}
                  />
                  <div className="absolute right-0 z-20 mt-2 w-72 sm:w-80 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        Billing Reminders
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {attentionInvoices.length} open
                      </span>
                    </div>
                    <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                      {attentionInvoices.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-slate-500">
                          All invoices are settled or in draft.
                        </div>
                      ) : (
                        attentionInvoices.map((inv) => (
                          <button
                            key={inv.id}
                            type="button"
                            onClick={() => {
                              setNotificationsOpen(false);
                              onSelectInvoice(inv);
                            }}
                            className="flex w-full items-start justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {inv.invoiceNumber} · {inv.customer.company || inv.customer.name}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Due {inv.dueDate}
                              </div>
                            </div>
                            <span
                              className={`text-[11px] font-medium capitalize shrink-0 ${
                                inv.status === 'overdue'
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {inv.status}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Settings Shortcut */}
            <button
              type="button"
              onClick={() => handleNavClick('settings')}
              aria-label="Open Settings"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <Settings className="h-4 w-4" />
            </button>

            {/* Workspace Owner Session Button */}
            {onOpenOwnerAuth && (
              <button
                type="button"
                onClick={onOpenOwnerAuth}
                aria-label="Workspace Owner Session"
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  ownerSession?.authenticated
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                {ownerSession?.authenticated ? (
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-slate-500" />
                )}
                <span className="hidden xl:inline">
                  {ownerSession?.authenticated ? 'Owner Session' : 'Sign In'}
                </span>
              </button>
            )}

            {/* User Profile Button */}
            <button
              type="button"
              onClick={() => handleNavClick('profile')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white dark:bg-blue-700">
                <User className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="hidden sm:inline max-w-[120px] truncate">
                {settings.userName.split(' ')[0]}
              </span>
            </button>
          </div>
        </header>

        {/* Main Workspace Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {storageWarning && (
            <div
              role="alert"
              className="no-print mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>{storageWarning}</span>
              </div>
              {onDismissStorageWarning && (
                <button
                  type="button"
                  onClick={onDismissStorageWarning}
                  aria-label="Dismiss storage warning"
                  className="rounded p-1 text-amber-700 hover:bg-amber-100 dark:text-amber-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          {children}
        </main>

        {/* Refined Global Product Footer */}
        <footer className="no-print border-t border-slate-200 bg-white/80 px-4 sm:px-6 lg:px-8 py-4 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mx-auto flex max-w-[1440px] flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div>
              © 2026 Universal Invoice Generator ·{' '}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Muhammad Abdul Samad Tariq, CEO &amp; Founder
              </span>
            </div>
            <nav
              aria-label="Footer legal and product links"
              className="flex flex-wrap items-center gap-x-4 gap-y-1.5"
            >
              <button
                type="button"
                onClick={() => handleNavClick('about')}
                className="hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap"
              >
                About Us
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('license')}
                className="hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap"
              >
                License &amp; IP
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('privacy')}
                className="hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap"
              >
                Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('terms')}
                className="hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap"
              >
                Terms &amp; Conditions
              </button>
              {onOpenCookieSettings && (
                <button
                  type="button"
                  onClick={onOpenCookieSettings}
                  className="font-medium text-blue-700 hover:underline dark:text-blue-400 whitespace-nowrap"
                >
                  Cookie Settings
                </button>
              )}
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
