import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import './gainz-tokens.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { seedIfEmpty } from './gainz-db';
import { initPwa } from './pwa';
import App from './App';

// Seed exercise library on first run
seedIfEmpty();

// Register service worker for offline support
initPwa(({ update }) => {
  // Show a small in-app update prompt
  const bar = document.createElement('div');
  bar.style.cssText = `
    position: fixed; bottom: 72px; left: 50%; transform: translateX(-50%);
    max-width: 440px; width: calc(100% - 24px); z-index: 1000;
    padding: 12px 16px; border-radius: var(--radius); font-size: 13px; font-weight: 600;
    background: var(--accent); color: var(--on-accent);
    display: flex; justify-content: space-between; align-items: center;
    box-shadow: 0 4px 16px var(--shadow);
  `;
  bar.innerHTML = `
    <span>New version ready</span>
    <button style="padding:6px 14px;border-radius:var(--radius-sm);background:var(--on-accent);color:var(--accent);font-weight:600;font-size:12px;border:none;cursor:pointer">Reload</button>
  `;
  bar.querySelector('button')!.onclick = () => {
    bar.remove();
    update();
  };
  document.body.appendChild(bar);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
