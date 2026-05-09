import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { getApiOrigin } from "./config/runtime";
import { initializeSentry } from "./utils/sentry";

// Initialize Sentry error tracking
initializeSentry();

// Disable service worker during dev to avoid cached 404s
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    // Register service worker in production for PWA offline support
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed — app still works, just no offline support
    });
  } else {
    // Unregister any stale SW in development
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
  }
}

function injectLinkOnce(rel: string, href: string, extra?: (link: HTMLLinkElement) => void) {
  if (typeof document === "undefined") return;
  if (!href) return;

  const key = `${rel}:${href}`;
  const existing = document.head.querySelector(`link[data-perf-hint="${CSS.escape(key)}"]`);
  if (existing) return;

  const link = document.createElement("link");
  link.rel = rel;
  link.href = href;
  link.setAttribute("data-perf-hint", key);
  extra?.(link);
  document.head.appendChild(link);
}

try {
  const apiOrigin = getApiOrigin();
  const u = apiOrigin ? new URL(apiOrigin) : null;
  const origin = u ? u.origin : "";
  const dnsHref = u ? `//${u.hostname}` : "";
  if (origin) {
    if (dnsHref) injectLinkOnce("dns-prefetch", dnsHref);
    injectLinkOnce("preconnect", origin, (l) => {
      l.crossOrigin = "";
    });
  }
} catch {
  // ignore invalid VITE_API_URL format
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <App />
);
