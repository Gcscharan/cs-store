import type { ComponentType } from 'react';

type SentryModule = typeof import('@sentry/react-native');

let cached: SentryModule | undefined | null = null;

function getSentry(): SentryModule | undefined {
  if (cached !== null) return cached || undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@sentry/react-native') as SentryModule;
    cached = mod;
    return mod;
  } catch {
    cached = undefined;
    return undefined;
  }
}

export const Sentry = {
  init: (options: Parameters<SentryModule['init']>[0]) => {
    const mod = getSentry();
    return mod?.init?.(options as any);
  },
  wrap: <P extends {}>(App: ComponentType<P>) => {
    const mod = getSentry();
    return (mod?.wrap ? mod.wrap(App as any) : App) as ComponentType<P>;
  },
  setUser: (user: Parameters<SentryModule['setUser']>[0]) => {
    const mod = getSentry();
    return mod?.setUser?.(user as any);
  },
  captureException: (
    exception: Parameters<SentryModule['captureException']>[0],
    captureContext?: Parameters<SentryModule['captureException']>[1]
  ) => {
    const mod = getSentry();
    return mod?.captureException?.(exception as any, captureContext as any);
  },
  addBreadcrumb: (breadcrumb: Parameters<SentryModule['addBreadcrumb']>[0]) => {
    const mod = getSentry();
    return mod?.addBreadcrumb?.(breadcrumb as any);
  },
};
