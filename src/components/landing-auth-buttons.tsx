'use client';

import Link from 'next/link';
import { LayoutDashboard, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function LandingAuthButtons() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center gap-2" aria-label="Loading account actions">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-28" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" asChild>
          <Link href="/dashboard">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </Link>
        </Button>
        <Button asChild>
          <Link href="/chat">
            <Sparkles className="mr-2 h-4 w-4" />
            Open Workspace
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" asChild>
        <Link href="/login">Log In</Link>
      </Button>
      <Button asChild>
        <Link href="/signup">Sign Up</Link>
      </Button>
    </div>
  );
}
