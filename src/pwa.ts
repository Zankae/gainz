// GAINZ — service worker registration and update prompt
//
// Behaviour mirrors Daily Guide's update bar: when a new version has been
// precached and is waiting, we surface a small "new version ready" prompt;
// accepting it activates the new worker and reloads. Nothing here touches
// IndexedDB — workout data is owned entirely by the Dexie layer (gainz-db.ts)
// and survives updates untouched.
//
// Usage in main.tsx:
//   import { initPwa } from './pwa';
//   initPwa(({ update }) => showUpdateToast(update));   // your UI
//
// `update()` is what the "Reload" button calls.

/// <reference types="vite-plugin-pwa/client" />
import { registerSW } from 'virtual:pwa-register';

export interface PwaUpdate {
  /** activate the waiting worker and reload the page */
  update: () => void;
}

/**
 * Register the service worker. `onNeedRefresh` fires when a new version is
 * waiting — wire it to a small in-app prompt. Avoid window.confirm and
 * the other blocking dialogs: their behavior and presentation are inconsistent
 * across installed PWAs and embedded webviews.
 */
export function initPwa(onNeedRefresh: (u: PwaUpdate) => void): void {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      onNeedRefresh({ update: () => updateSW(true) });
    },
    onOfflineReady() {
      // First install finished; the app now works offline. No prompt — this is
      // not an update, and announcing it on first run would be noise.
    },
  });
}
