import type { OwnerSessionStatus } from '../types/invoice';

let cachedCsrfToken: string | null = null;

export class OwnerAuthError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 401, code = 'AUTH_REQUIRED') {
    super(message);
    this.name = 'OwnerAuthError';
    this.status = status;
    this.code = code;
  }
}

export function getCachedCsrfToken(): string | null {
  return cachedCsrfToken;
}

export function setCachedCsrfToken(token: string | null): void {
  cachedCsrfToken = token;
}

export async function fetchOwnerSession(): Promise<OwnerSessionStatus> {
  const res = await fetch('/api/auth/session', {
    credentials: 'same-origin',
  });
  const body = (await res.json().catch(() => ({}))) as OwnerSessionStatus;
  if (body.authenticated && body.csrfToken) {
    cachedCsrfToken = body.csrfToken;
  } else {
    cachedCsrfToken = null;
  }
  return {
    authenticated: Boolean(body.authenticated),
    ownerEmail: body.ownerEmail,
    csrfToken: body.csrfToken,
    authMode: 'single_owner_session',
    devBootstrapPasswordNotice: body.devBootstrapPasswordNotice,
  };
}

export async function loginOwner(email: string, password: string): Promise<OwnerSessionStatus> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json().catch(() => ({}))) as OwnerSessionStatus & { error?: string };
  if (!res.ok) {
    throw new Error(body.error || `Sign-in failed (${res.status}).`);
  }
  if (body.csrfToken) {
    cachedCsrfToken = body.csrfToken;
  }
  return {
    authenticated: true,
    ownerEmail: body.ownerEmail,
    csrfToken: body.csrfToken,
    authMode: 'single_owner_session',
  };
}

export async function logoutOwner(): Promise<void> {
  const headers: Record<string, string> = {};
  if (cachedCsrfToken) {
    headers['X-CSRF-Token'] = cachedCsrfToken;
  }
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
  }).catch(() => {});
  cachedCsrfToken = null;
}

export async function ownerFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers || {});

  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    if (!cachedCsrfToken) {
      await fetchOwnerSession().catch(() => null);
    }
    if (cachedCsrfToken && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', cachedCsrfToken);
    }
  }

  const res = await fetch(input, {
    ...init,
    credentials: 'same-origin',
    headers,
  });

  if (res.status === 401) {
    const body = (await res.clone().json().catch(() => ({}))) as {
      error?: string;
      code?: string;
    };
    throw new OwnerAuthError(
      body.error || 'Owner authentication required. Please sign in to continue.',
      401,
      body.code || 'AUTH_REQUIRED'
    );
  }

  return res;
}
