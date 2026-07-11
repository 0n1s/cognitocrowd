"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMessagingInstance } from "@/lib/firebase";
import { getToken, onMessage } from "firebase/messaging";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export function NotificationPermissionButton() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    } else {
      setPermission('unsupported');
    }
  }, []);

  const saveToken = async (token: string) => {
    if (!user) return;
    try {
      await fetch('/api/user/fcm-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
    } catch (error) {
      console.error('Failed to save FCM token:', error);
    }
  };

  const requestPermission = async () => {
    if (!VAPID_KEY) {
      toast({
        title: "Push Notifications Not Configured",
        description: "The VAPID key is missing. Contact the administrator.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const messaging = await getMessagingInstance();
      if (!messaging) {
        toast({
          title: "Not Supported",
          description: "Push notifications are not supported in this browser.",
          variant: "destructive",
        });
        return;
      }

      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      if (token) {
        await saveToken(token);
        setPermission('granted');
        toast({
          title: "Notifications Enabled",
          description: "You'll now receive push notifications even when the app is closed.",
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
    } catch (error) {
      console.error('Failed to get push token:', error);
      setPermission('denied');
      toast({
        title: "Permission Denied",
        description: "Please allow notifications in your browser settings to enable push notifications.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (permission === 'unsupported') return null;
  if (permission === 'granted') {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Bell className="h-3.5 w-3.5 text-primary" />
        Push notifications enabled
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={requestPermission}
      disabled={loading}
      className="gap-2"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <BellOff className="h-4 w-4" />
      )}
      {loading ? 'Enabling...' : 'Enable Push Notifications'}
    </Button>
  );
}