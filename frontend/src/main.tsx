import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Disable service worker during dev to avoid cached 404s
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <App />
);
