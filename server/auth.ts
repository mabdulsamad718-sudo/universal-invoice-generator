import crypto from 'node:crypto';
import type express from 'express';
import type { OwnerSessionStatus } from '../src/types/invoice.ts';

export interface AuthConfig {
  isProd: boolean;
  sessionSecret: string;
  ownerEmail: string;
  ownerPasswordHash?: string;
  ownerPasswordPlain?: string;
  cronSecret?: string;
  devBootstrapPasswordNotice?: string;
}

interface SessionPayload {
  sub: string;
  csrf: string;
  iat: number;
  exp: number;
}

const SESSION_COOKIE_NAME = 'uig_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function hashPasswordScrypt(password: string, salt?: string): string {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, usedSalt, 64).toString('hex');
  return `scrypt$${usedSalt}$${derived}`;
}

export function verifyPasswordScrypt(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function safeTimingEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function buildAuthConfigFromEnv(overrides: Partial<AuthConfig> = {}): AuthConfig {
  const isProd = overrides.isProd ?? process.env.NODE_ENV === 'production';
  const envSessionSecret = (overrides.sessionSecret ?? process.env.SESSION_SECRET ?? '').trim();

  let sessionSecret = envSessionSecret;
  if (!sessionSecret) {
    if (isProd) {
      // Ephemeral fallback avoids predictable static secrets even if misconfigured,
      // while warning loudly in production logs.
      console.warn(
        '[SECURITY WARNING] SESSION_SECRET is not set in production. Sessions will invalidate across restarts.'
      );
    }
    sessionSecret = crypto.randomBytes(32).toString('hex');
  }

  const ownerEmail = (
    overrides.ownerEmail ??
    process.env.OWNER_EMAIL ??
    'owner@universal-invoice.local'
  )
    .trim()
    .toLowerCase();

  const ownerPasswordHash = (
    overrides.ownerPasswordHash ??
    process.env.OWNER_PASSWORD_HASH ??
    ''
  ).trim() || undefined;

  let ownerPasswordPlain = (
    overrides.ownerPasswordPlain ??
    process.env.OWNER_PASSWORD ??
    ''
  ).trim() || undefined;

  let devBootstrapPasswordNotice: string | undefined;

  if (!isProd && !ownerPasswordHash && !ownerPasswordPlain) {
    ownerPasswordPlain = crypto.randomBytes(12).toString('base64url');
    devBootstrapPasswordNotice = `Dev-only session credentials generated for this boot: ${ownerEmail} / ${ownerPasswordPlain}`;
    console.info(`[DEV AUTH] ${devBootstrapPasswordNotice}`);
  }

  const cronSecret = (overrides.cronSecret ?? process.env.CRON_SECRET ?? '').trim() || undefined;

  return {
    isProd,
    sessionSecret,
    ownerEmail,
    ownerPasswordHash,
    ownerPasswordPlain,
    cronSecret,
    devBootstrapPasswordNotice,
  };
}

function signToken(payload: SessionPayload, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string, secret: string): SessionPayload | null {
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!encoded || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  if (!safeTimingEqual(sig, expectedSig)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.sub || !parsed.csrf || !parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

export function createAuthHelpers(config: AuthConfig) {
  function isLoginConfigured(): boolean {
    return Boolean(config.ownerPasswordHash || config.ownerPasswordPlain);
  }

  function verifyOwnerCredentials(email: string, password: string): boolean {
    if (!isLoginConfigured()) return false;
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!safeTimingEqual(normalizedEmail, config.ownerEmail)) {
      return false;
    }
    if (config.ownerPasswordHash) {
      return verifyPasswordScrypt(password, config.ownerPasswordHash);
    }
    if (config.ownerPasswordPlain) {
      // Compare hashes of both to normalize comparison length
      const salt = crypto.randomBytes(16).toString('hex');
      const expectedHash = hashPasswordScrypt(config.ownerPasswordPlain, salt);
      return verifyPasswordScrypt(password, expectedHash);
    }
    return false;
  }

  function getSessionFromRequest(req: express.Request): SessionPayload | null {
    const cookies = parseCookies(req.headers.cookie);
    const rawToken = cookies[SESSION_COOKIE_NAME];
    if (!rawToken) return null;
    return verifyToken(rawToken, config.sessionSecret);
  }

  function issueSessionCookie(req: express.Request, res: express.Response): SessionPayload {
    const now = Date.now();
    const payload: SessionPayload = {
      sub: config.ownerEmail,
      csrf: crypto.randomBytes(24).toString('base64url'),
      iat: now,
      exp: now + SESSION_TTL_MS,
    };
    const token = signToken(payload, config.sessionSecret);
    const isHttps =
      req.secure || String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';

    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProd && isHttps,
      maxAge: SESSION_TTL_MS,
      path: '/',
    });
    return payload;
  }

  function clearSessionCookie(res: express.Response) {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  }

  function getSessionStatus(req: express.Request): OwnerSessionStatus {
    const session = getSessionFromRequest(req);
    if (session) {
      return {
        authenticated: true,
        ownerEmail: session.sub,
        csrfToken: session.csrf,
        authMode: 'single_owner_session',
      };
    }
    return {
      authenticated: false,
      authMode: 'single_owner_session',
      devBootstrapPasswordNotice: !config.isProd ? config.devBootstrapPasswordNotice : undefined,
    };
  }

  function requireOwnerAuth(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.status(401).json({
        error: 'Owner authentication required. Please sign in to your workspace session.',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    const method = req.method.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      const csrfHeader = String(req.headers['x-csrf-token'] || '');
      if (!csrfHeader || !safeTimingEqual(csrfHeader, session.csrf)) {
        res.status(403).json({
          error: 'Missing or invalid CSRF token for authenticated state-changing request.',
          code: 'CSRF_INVALID',
        });
        return;
      }
    }

    (req as express.Request & { ownerSession?: SessionPayload }).ownerSession = session;
    next();
  }

  function hasValidCronBearer(req: express.Request): boolean {
    if (!config.cronSecret) return false;
    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ')) return false;
    const provided = authHeader.slice('Bearer '.length).trim();
    if (!provided) return false;
    return safeTimingEqual(provided, config.cronSecret);
  }

  function requireOwnerOrCronAuth(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    if (hasValidCronBearer(req)) {
      next();
      return;
    }
    requireOwnerAuth(req, res, next);
  }

  return {
    config,
    isLoginConfigured,
    verifyOwnerCredentials,
    getSessionFromRequest,
    issueSessionCookie,
    clearSessionCookie,
    getSessionStatus,
    requireOwnerAuth,
    requireOwnerOrCronAuth,
  };
}
