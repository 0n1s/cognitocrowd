"use client";

import { useEffect, useRef } from "react";
import { getMessagingInstance } from "@/lib/firebase";
import { getToken, onMessage } from "firebase/messaging";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export function AutoPromptPushNotification() {
  const { user } = useAuth();
  const { toast } = useToast();
  const promptedRef = useRef(false);

  useEffect(() => {
    // Only prompt once per session
    if (promptedRef.current) return;
    // Only if user is logged in
    if (!user) return;
    // Only if VAPID key is configured
    if (!VAPID_KEY) return;
    // Only if the browser supports notifications
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    // Only if permission hasn't been decided yet (default state)
    if (Notification.permission !== 'default') return;

    promptedRef.current = true;

    const requestPermission = async () => {
      try {
        const messaging = await getMessagingInstance();
        if (!messaging) return;

        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (token) {
          // Save the token to the user's document
          await fetch('/api/user/fcm-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          });

          // Listen for foreground messages
          onMessage(messaging, (payload) => {
            if (payload.notification) {
              toast({
                title: payload.notification.title || 'Notification',
                description: payload.notification.body || '',
              });
            }
          });
        }
      } catch {
        // User denied permission or an error occurred — silently ignore
      }
    };

    // Small delay so it doesn't fire immediately on page load
    const timeout = setTimeout(requestPermission, 2000);
    return () => clearTimeout(timeout);
  }, [user, toast]);

  return null;
}