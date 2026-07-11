"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { sendEmailVerification } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, RefreshCw, CheckCircle } from "lucide-react";
import Link from "next/link";

const COOLDOWN_SECONDS = 60;

export function VerifyEmailContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Countdown timer for cooldown
  useEffect(() => {
    if (!cooldown || cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => {
        const next = prev - 1;
        return next <= 0 ? 0 : next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Check if email gets verified while on this page
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      await user.reload();
      if (user.emailVerified) {
        clearInterval(interval);
        toast({ title: "Email verified!", description: "Redirecting to dashboard..." });
        setTimeout(() => router.push('/dashboard'), 1000);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [user, router, toast]);

  // Check verification status immediately if user already verified
  useEffect(() => {
    if (user?.emailVerified) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleSendVerification = useCallback(async () => {
    if (!auth?.currentUser) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }

    // Rate limit check
    if (lastSentAt && Date.now() - lastSentAt < COOLDOWN_SECONDS * 1000) {
      const remaining = Math.ceil((COOLDOWN_SECONDS * 1000 - (Date.now() - lastSentAt)) / 1000);
      toast({
        title: "Please wait",
        description: `You can request another email in ${remaining} seconds.`,
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      await sendEmailVerification(auth.currentUser, {
        url: `${window.location.origin}/dashboard`,
      });
      setLastSentAt(Date.now());
      setCooldown(COOLDOWN_SECONDS);
      toast({ title: "Verification email sent", description: "Check your inbox and spam folder." });
    } catch (error: any) {
      const message = error?.code === 'auth/too-many-requests'
        ? 'Too many requests. Please try again later.'
        : error instanceof Error ? error.message : "Could not send verification email.";
      toast({
        title: "Failed to send",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }, [lastSentAt, toast]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Verify Your Email</CardTitle>
          <CardDescription>
            {user?.email
              ? `We need to verify ${user.email} before you can continue.`
              : 'Please verify your email address to continue.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground space-y-3">
          <p>Click the button below to receive a verification link. Once verified, this page will automatically redirect you.</p>
          {lastSentAt && (
            <p className="text-primary font-medium">
              {cooldown > 0
                ? `Verification email sent! Resend available in ${cooldown}s.`
                : 'Verification email sent! Check your inbox and spam folder.'}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            type="button"
            className="w-full"
            onClick={handleSendVerification}
            disabled={sending || cooldown > 0}
          >
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : lastSentAt ? (
              <RefreshCw className="mr-2 h-4 w-4" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            {sending ? 'Sending...' : lastSentAt ? 'Resend Verification Email' : 'Send Verification Email'}
          </Button>
          <Button type="button" variant="outline" className="w-full" asChild>
            <Link href="/logout">Back to Login</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}