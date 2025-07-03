
"use client";

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

function LogoutLogic() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');

  let message = "Logging you out...";

  if (reason) {
      switch (reason) {
          case 'account_rejected':
              message = 'Your account application was not approved. You will be logged out.';
              break;
          case 'user_data_not_found':
              message = 'Your user data could not be found. For your security, you will be logged out.';
              break;
          default:
              message = 'You are being logged out.';
              break;
      }
  }

  useEffect(() => {
    const performLogout = async () => {
      // Give user time to read the message before redirecting
      await new Promise(resolve => setTimeout(resolve, 3500));
      
      if (auth && user) {
        try {
          await signOut(auth);
        } catch (error) {
          console.error("Error signing out: ", error);
        }
      }
      router.push('/login');
    };

    if (!loading) {
      performLogout();
    }
  }, [loading, router, user]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="flex flex-col items-center space-y-4 max-w-sm">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-lg text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}


export default function LogoutPage() {
  return (
    <Suspense>
      <LogoutLogic />
    </Suspense>
  )
}
