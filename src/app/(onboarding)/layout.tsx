"use client";

import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { auth } from '@/lib/firebase';
import { getAppSettings, getUserData } from "@/lib/database";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait for the authentication state to be determined.
    if (authLoading) {
      return;
    }

    // If there is no user, they must log in.
    if (!user) {
      router.push('/login');
      return;
    }

    const checkStatus = async () => {
      const userData = await getUserData(user.uid);

      // 1. Admins bypass email verification and onboarding entirely
      if (userData?.role === 'super_user_alpha_7') {
        router.push('/dashboard');
        return;
      }

      // 2. Check email verification first (before any onboarding, skip for admins)
      if (!user.emailVerified) {
        const settings = await getAppSettings().catch(() => null);
        if (settings?.requireEmailVerification) {
          router.replace('/verify-email');
          return;
        }
      }

      // 3. Email verified (or not required), check onboarding status
      if (userData?.onboardingStatus === 'approved') {
        router.push('/dashboard');
      }
      // Otherwise, stay on onboarding
    };

    checkStatus();

  }, [user, authLoading, router]);

  // While authentication is loading or we're waiting for the redirect to happen,
  // show a loading spinner.
  if (authLoading || !user) {
     return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Once we've confirmed the user is logged in and not yet approved, show the onboarding content.
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="absolute top-4 left-4">
            <Link href="/" className="flex items-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                <span className="font-bold font-headline text-lg">TrainlyLabs</span>
            </Link>
        </div>
        <div className="w-full max-w-2xl">
          {children}
        </div>
    </div>
  );
}
