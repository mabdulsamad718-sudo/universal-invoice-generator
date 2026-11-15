import { useEffect, useState, type FormEvent } from 'react';
import { Lock, LogOut, ShieldCheck, X, KeyRound } from 'lucide-react';
import type { OwnerSessionStatus } from '../types/invoice';
import { loginOwner, logoutOwner } from '../utils/apiClient';

interface OwnerAuthModalProps {
  open: boolean;
  session: OwnerSessionStatus | null;
  promptReason?: string | null;
  onClose: () => void;
  onSessionChange: (session: OwnerSessionStatus) => void;
}

function parseDevCredentials(notice?: string): { email: string; password: string } | null {
  if (!notice) return null;
  const idx = notice.indexOf(':');
  if (idx < 0) return null;
  const tail = notice.slice(idx + 1).trim();
  const parts = tail.split(' / ');
  if (parts.length !== 2) return null;
  return { email: parts[0].trim(), password: parts[1].trim() };
}

export function OwnerAuthModal({
  open,
  session,
  promptReason,
  onClose,
  onSessionChange,
}: OwnerAuthModalProps) {
  const [email, setEmail] = useState(session?.ownerEmail || 'owner@universal-invoice.local');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      if (session?.ownerEmail) {
        setEmail(session.ownerEmail);
      } else {
        const parsed = parseDevCredentials(session?.devBootstrapPasswordNotice);
        if (parsed) {
          setEmail(parsed.email);
        }
      }
    }
  }, [open, session]);

  if (!open) return null;

  const devCreds = parseDevCredentials(session?.devBootstrapPasswordNotice);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const next = await loginOwner(email.trim(), password);
      setPassword('');
      onSessionChange(next);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logoutOwner();
      onSessionChange({
        authenticated: false,
        authMode: 'single_owner_session',
        devBootstrapPasswordNotice: session?.devBootstrapPasswordNotice,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Workspace Owner Session"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-blue-700">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Workspace Owner Session
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Cookie + CSRF protection for server actions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close workspace session dialog"
            className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {promptReason && !session?.authenticated && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200">
              {promptReason}
            </div>
          )}

          {session?.authenticated ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-800 dark:bg-emerald-950/40">
                <ShieldCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="font-semibold text-emerald-900 dark:text-emerald-200">
                    Signed in as Workspace Owner
                  </div>
                  <div className="font-mono text-[11px] text-emerald-800 dark:text-emerald-300">
                    {session.ownerEmail}
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    Protected actions (publishing/revoking share links, live gateway verification,
                    manual payment confirmation, and recurring dispatch) are authorized.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>{loading ? 'Signing out...' : 'Sign Out'}</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Local invoice drafting and PDF export work directly in your browser. Signing in
                unlocks server-protected operations: publishing or revoking cross-device share
                links, verifying live payment gateways, confirming manual settlements, and dispatching
                recurring invoice emails.
              </p>

              {devCreds && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-900 space-y-2 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5" />
                      <span>Development Ephemeral Credentials</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail(devCreds.email);
                        setPassword(devCreds.password);
                      }}
                      className="rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-200"
                    >
                      Auto-fill
                    </button>
                  </div>
                  <div className="font-mono text-[11px] break-all">
                    {devCreds.email} / {devCreds.password}
                  </div>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
                >
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="owner-auth-email"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Owner Email
                </label>
                <input
                  id="owner-auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="owner-auth-password"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Owner Password
                </label>
                <input
                  id="owner-auth-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Configured OWNER_PASSWORD"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
