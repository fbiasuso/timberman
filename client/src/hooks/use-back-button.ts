import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/**
 * Handles the Android hardware back button inside the Capacitor WebView (D7).
 *
 * Native-only: on the web the browser already owns back navigation, so nothing
 * is registered (keeps happy-dom tests and the Netlify deploy untouched). In
 * the app, back on the root route exits the app; on any inner route it
 * navigates the in-app history instead.
 */
export function useBackButton(): void {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const listener = App.addListener('backButton', () => {
      if (window.location.pathname === '/') {
        void App.exitApp();
        return;
      }
      window.history.back();
    });

    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, []);
}
