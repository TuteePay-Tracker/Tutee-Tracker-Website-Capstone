import { createRoot } from "react-dom/client";
import App from "@/app/App";
import "@/styles/index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register the PWA service worker only in production builds so it never
// hijacks assets/modules during local development (which caused stale
// bundles and uncaught fetch errors on the dev server).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("[SW] Registration failed:", err));
  });
}