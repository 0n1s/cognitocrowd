
"use client";

import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { getUserData } from "@/lib/database";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'authorized' | 'unauthorized'>('loading');
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      setStatus('unauthorized');
      return;
    }

    async function checkStatus() {
        const userData = await getUserData(user!.uid);
        if (userData?.onboardingStatus === 'approved') {
            router.push('/dashboard');
        } else {
            setStatus('authorized');
        }
    }
    checkStatus();
  }, [user, authLoading, router]);

  if (status === 'loading' || status === 'unauthorized') {
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
