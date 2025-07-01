"use client";

import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading || user) {
     return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-[450px] w-full max-w-sm rounded-lg" />
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
        {!loading && !user && children}
    </div>
  );
}
