import * as Sentry from '@sentry/node';
import { config } from '../config/unifiedConfig';

let initialized = false;

export function initErrorTracking(): void {
  if (initialized) return;
  initialized = true;

  if (!config.sentry.dsn) return;

  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.sentry.environment,
    tracesSampleRate: 0.15,
  });
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (config.sentry.dsn) {
    Sentry.captureException(error, { extra: context });
    return;
  }

  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(
    JSON.stringify({
      level: 'error',
      at: new Date().toISOString(),
      context,
      message,
    }) + '\n'
  );
}
