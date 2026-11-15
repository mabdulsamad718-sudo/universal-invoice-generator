import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createApp } from './server/app.ts';
import { runDueRecurringPass } from './server/recurringWorker.ts';

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = createApp();

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Universal Invoice Generator server listening on http://0.0.0.0:${PORT}`);
  });

  // Optional background recurring invoice check loop (can also be triggered externally via cron -> POST /api/recurring/process-due)
  if (process.env.ENABLE_RECURRING_WORKER === 'true') {
    const intervalMs = Math.max(60_000, Number(process.env.RECURRING_CHECK_INTERVAL_MS || 900_000));
    const baseOrigin = (process.env.APP_BASE_URL || process.env.APP_URL || `http://localhost:${PORT}`).replace(
      /\/+$/,
      ''
    );

    const timer = setInterval(() => {
      runDueRecurringPass(baseOrigin).catch((err) => {
        console.error('[RECURRING WORKER ERROR]', err);
      });
    }, intervalMs);
    timer.unref();
  }

  return server;
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
