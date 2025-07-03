
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export default function LogoutPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      return; // Wait until auth state is confirmed
    }

    if (!user) {
      // If already logged out, just redirect
      router.push('/login');
      return;
    }

    const performLogout = async () => {
      if (auth) {
        try {
          await signOut(auth);
          // The onAuthStateChanged listener in useAuth will handle user state change.
          // We can push to /login immediately.
          router.push('/login');
        } catch (error) {
          console.error("Error signing out: ", error);
          // Even if there's an error, try to redirect to a safe page.
          router.push('/login');
        }
      } else {
        // If firebase is not configured, just redirect.
        router.push('/login');
      }
    };

    performLogout();
  }, [user, loading, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="flex items-center space-x-2">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-lg text-muted-foreground">Logging out...</p>
      </div>
    </div>
  );
}
