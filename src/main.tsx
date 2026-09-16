import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// Registered only in a production build; the dev server has no service worker
// to serve and a stale one would shadow live edits.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* Offline support is a bonus — the app works fine without it. */
    });
  });
}

/*
 * Browsers evict ordinary site storage under pressure, and this app's entire
 * library lives there. Asking to persist is best-effort — it is granted on
 * engagement or once the app is installed — so the export in Settings is still
 * the real backup.
 */
if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {
    /* Denied or unsupported; nothing to do. */
  });
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
