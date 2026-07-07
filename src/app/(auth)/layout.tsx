
"use client";

import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { getUserData } from "@/lib/database";

const AuthLayoutSkeleton = () => (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
       <Loader2 className="h-8 w-8 animate-spin" />
    </div>
);

// A simple component for the stars
const Stars = () => (
    <>
        <div 
            className="absolute top-1/2 left-1/2 h-0.5 w-[30rem] animate-shooting-star rounded-full bg-gradient-to-r from-primary to-transparent"
            style={{ animationDelay: '1s' }}
        />
        <div 
            className="absolute top-1/4 left-1/3 h-0.5 w-[40rem] animate-shooting-star rounded-full bg-gradient-to-r from-primary to-transparent"
            style={{ animationDelay: '2.5s', animationDuration: '4s' }}
        />
        <div 
            className="absolute top-2/3 left-3/4 h-0.5 w-[25rem] animate-shooting-star rounded-full bg-gradient-to-r from-primary to-transparent"
            style={{ animationDelay: '4s', animationDuration: '2s' }}
        />
    </>
);

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) return;

    const checkOnboarding = async () => {
      let userData = await getUserData(user.uid);
      // Auth becomes ready before the signup API has persisted the profile.
      // Waiting here prevents /dashboard from creating a referral-less fallback profile.
      for (let attempt = 0; !userData && attempt < 20; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        userData = await getUserData(user.uid);
      }
      if (!userData) return;
      if (userData?.onboardingStatus === 'pending') {
        router.push('/onboarding/welcome');
      } else {
        router.push('/dashboard');
      }
    };
    
    checkOnboarding();
  }, [user, loading, router]);

  if (loading || user) {
     return <AuthLayoutSkeleton />;
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background">
      {/* Background container for grid and stars */}
      <div className="absolute inset-0 z-0">
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-background bg-[linear-gradient(to_right,rgba(var(--primary-rgb),0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(var(--primary-rgb),0.1)_1px,transparent_1px)] bg-[size:3rem_3rem]" />
        {/* Stars */}
        <Stars />
        {/* Gradient overlay */}
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-transparent via-background/80 to-background" />
      </div>

      {/* Content container */}
      <div className="z-20 flex w-full items-center justify-center p-6 lg:p-12">
        <div className="mx-auto grid w-full max-w-sm gap-6">
            <Link href="/" className="flex items-center justify-center lg:justify-start space-x-2 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                <span className="font-bold font-headline text-lg">Trainly</span>
            </Link>
            {!loading && !user && children}
        </div>
      </div>
    </div>
  );
}
