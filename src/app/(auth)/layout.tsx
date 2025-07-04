
"use client";

import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";
import { getUserData } from "@/lib/database";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

const AuthLayoutSkeleton = () => (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="absolute top-4 left-4">
            <div className="flex items-center space-x-2">
                <Skeleton className="h-6 w-6" />
                <Skeleton className="h-5 w-20" />
            </div>
        </div>
        <Card className="w-full max-w-sm">
            <CardHeader>
                <Skeleton className="h-7 w-24 mb-2" />
                <Skeleton className="h-4 w-4/5" />
            </CardHeader>
            <CardContent className="grid gap-4">
                <div className="grid gap-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="grid gap-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-10 w-full" />
            </CardContent>
            <CardFooter className="justify-center">
                <Skeleton className="h-5 w-40" />
            </CardFooter>
        </Card>
    </div>
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
      const userData = await getUserData(user.uid);
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
