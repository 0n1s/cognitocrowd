"use client";

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Loader2, ArrowLeft, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      toast({ title: "Configuration Error", description: "Firebase is not configured.", variant: "destructive" });
      return;
    }
    if (!email.trim()) {
      toast({ title: "Email required", description: "Please enter your email address.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
      toast({ title: "Reset email sent", description: "Check your inbox and spam folder for the password reset link." });
    } catch (error: any) {
      let description = "Could not send password reset email.";
      if (error.code === 'auth/user-not-found') {
        description = "No account found with this email address.";
      } else if (error.code === 'auth/too-many-requests') {
        description = "Too many requests. Please wait a moment before trying again.";
      } else if (error instanceof Error) {
        description = error.message;
      }
      toast({ title: "Failed to send", description, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="grid gap-2 text-center">
        <h1 className="text-3xl font-bold font-headline">Reset your password</h1>
        <p className="text-balance text-muted-foreground">
          {sent
            ? "Check your email for the password reset link."
            : "Enter your email address and we'll send you a reset link."}
        </p>
      </div>
      {sent ? (
        <div className="grid gap-4">
          <div className="rounded-md bg-primary/5 p-4 text-center border border-primary/10">
            <Mail className="mx-auto h-8 w-8 text-primary mb-2" />
            <p className="text-sm text-muted-foreground">
              If an account exists with <strong>{email}</strong>, you will receive a password reset email shortly.
            </p>
          </div>
          <Button type="button" variant="outline" className="w-full" asChild>
            <Link href="/login">Back to Login</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Reset Link
          </Button>
          <Button type="button" variant="outline" className="w-full" asChild>
            <Link href="/login"><ArrowLeft className="mr-2 h-4 w-4" />Back to Login</Link>
          </Button>
        </form>
      )}
    </>
  );
}