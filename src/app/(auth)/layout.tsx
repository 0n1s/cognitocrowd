
"use client";

import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { getUserData } from "@/lib/database";
import NextImage from 'next/image';

const AuthLayoutSkeleton = () => (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
       <Loader2 className="h-8 w-8 animate-spin" />
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
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="mx-auto grid w-full max-w-sm gap-6">
            <Link href="/" className="flex items-center justify-center lg:justify-start space-x-2 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                <span className="font-bold font-headline text-lg">Trainly</span>
            </Link>
            {!loading && !user && children}
        </div>
      </div>
      <div className="hidden bg-muted lg:block">
        <NextImage
            src="https://placehold.co/1080x1920.png"
            data-ai-hint="abstract technology"
            alt="An abstract technological background image"
            width={1080}
            height={1920}
            className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  );
}
