"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

        // Wait for the service worker to be ready
        await navigator.serviceWorker.ready;

        // Pass Firebase config to the service worker via postMessage
        const config = {
          FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        };

        // Send config to the service worker
        if (registration.active) {
          registration.active.postMessage({ type: 'SET_FIREBASE_CONFIG', config });
        }
      } catch (error) {
        console.error('Service worker registration failed:', error);
      }
    };

    register();
  }, []);

  return null;
}