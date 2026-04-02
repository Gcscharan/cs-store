// Polyfill for Sentry/Bridgeless mode detection issues in some RN versions
// MUST be the very first thing to run before any other imports
const g = (globalThis as any);
if (typeof g.RN$Bridgeless === 'undefined') {
  g.RN$Bridgeless = false;
}
if (typeof g.global === 'undefined') {
  g.global = g;
}

export {};
