
"use client";

import Link from "next/link";
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { getUserData } from "@/lib/database";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.push('/login');
      return;
    }

    getUserData(user.uid).then(userData => {
      if (!userData) {
          // This case should be handled by the main app layout which creates the user doc.
          // If we are here, something is wrong. Log out to be safe.
          router.push('/logout?reason=user_data_not_found');
          return;
      }
      
      if (userData.onboardingStatus === 'approved') {
        router.push('/dashboard');
        return;
      }

      // If the user has submitted their test, they should only be on the pending page.
      if (pathname !== '/onboarding/pending' && userData.qualificationTestSubmittedAt) {
          router.push('/onboarding/pending');
          return;
      }
    });

  }, [user, authLoading, router, pathname]);

  if (authLoading || !user) {
     return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="absolute top-4 left-4">
            <Link href="/" className="flex items-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                <span className="font-bold font-headline text-lg">Trainly</span>
            </Link>
        </div>
        <div className="w-full max-w-2xl">
          {children}
        </div>
    </div>
  );
}
