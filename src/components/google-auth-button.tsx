"use client";

import { useState, useEffect } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { setupNewUser } from "@/lib/user-api";
import { getAppSettings } from "@/lib/database";

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
    <title>Google</title>
    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.62 1.9-5.63 1.9-4.73 0-8.58-3.87-8.58-8.58s3.85-8.58 8.58-8.58c2.62 0 4.34 1.02 5.46 2.02l2.62-2.62C18.62 1.32 15.86 0 12.48 0 5.6 0 0 5.6 0 12.48s5.6 12.48 12.48 12.48c7.1 0 12.24-4.82 12.24-12.72 0-.8-.08-1.52-.24-2.22h-12z" fill="currentColor"/>
  </svg>
);

type GoogleAuthButtonProps = {
  mode: "login" | "signup";
  disabled?: boolean;
};

export function GoogleAuthButton({ mode, disabled }: GoogleAuthButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    getAppSettings()
      .then((settings) => setGoogleEnabled(settings?.googleAuthEnabled === true))
      .catch(() => setGoogleEnabled(false));
  }, []);

  const handleGoogleAuth = async () => {
    if (!auth) {
      toast({ title: "Configuration Error", description: "Firebase is not configured.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (mode === "signup" && user) {
        const existingUserDoc = await fetch(`/api/user/check-user?uid=${user.uid}`).catch(() => null);
        const exists = existingUserDoc?.ok ? await existingUserDoc.json() : null;
        if (!exists?.exists) {
          await setupNewUser(
            user.uid,
            user.displayName || "User",
            user.email || "",
            new URLSearchParams(window.location.search).get('ref') || ''
          );
        }
      }

      toast({ title: mode === "login" ? "Signed in" : "Account created", description: `Welcome${user.displayName ? `, ${user.displayName}` : ''}!` });
    } catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user') return;
      console.error('Google auth error:', error);
      toast({
        title: mode === "login" ? "Sign in failed" : "Sign up failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (googleEnabled === false || googleEnabled === null) return null;

  return (
    <Button variant="outline" className="w-full" type="button" disabled={disabled || loading} onClick={handleGoogleAuth}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon className="mr-2 h-4 w-4" />}
      {mode === "login" ? "Continue with Google" : "Sign up with Google"}
    </Button>
  );
}