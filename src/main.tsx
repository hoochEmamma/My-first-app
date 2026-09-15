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

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
