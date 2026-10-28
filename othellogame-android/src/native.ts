/**
 * Native (Android) integration via Capacitor. Safe no-ops in a normal browser.
 */
import {App as CapApp} from '@capacitor/app';
import {Capacitor} from '@capacitor/core';
import {StatusBar} from '@capacitor/status-bar';
import {useEffect, useState} from 'react';

export const isNative = Capacitor.isNativePlatform();

/** Set by the game: true when Back on the main menu should close the app. */
let canExitOnBack = true;
export function setCanExitOnBack(value: boolean): void {
  canExitOnBack = value;
}

export function initNative(): void {
  if (!isNative) return;
  // Immersive-style: hide the status bar for a fullscreen board.
  StatusBar.hide().catch(() => {});
  // Android back button: close modals / leave match via the game's popstate
  // handler; exit the app from the main menu.
  CapApp.addListener('backButton', () => {
    if (canExitOnBack) {
      CapApp.exitApp();
    } else {
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  });
}

/** False while the app is in the background (Android home/recents/screen off). */
export function useAppActive(): boolean {
  const [active, setActive] = useState(true);
  useEffect(() => {
    const onVisibility = () => setActive(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    let remove: (() => void) | undefined;
    if (isNative) {
      CapApp.addListener('appStateChange', ({isActive}) => setActive(isActive)).then(
        (h) => (remove = () => h.remove()),
      );
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      remove?.();
    };
  }, []);
  return active;
}
