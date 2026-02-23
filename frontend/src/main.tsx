import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { getApiOrigin } from "./config/runtime";

// Disable service worker during dev to avoid cached 404s
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
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
