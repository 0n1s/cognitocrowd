
"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { createUserWithEmailAndPassword, deleteUser, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import { setupNewUser } from '@/lib/user-api';
import { LocalCaptcha } from '@/components/security/local-captcha';
import { GoogleAuthButton } from '@/components/google-auth-button';


export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('ref');
    if (code) setReferralCode(code.trim().toUpperCase());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
        toast({
            title: "Configuration Error",
            description: "Firebase is not configured. Please check your environment variables.",
            variant: "destructive",
        });
        return;
    }

    if (!captchaToken || !captchaAnswer.trim()) {
      toast({
        title: 'Captcha Required',
        description: 'Please complete the captcha before creating your account.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const captchaResponse = await fetch('/api/security/captcha/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: captchaToken, answer: captchaAnswer, action: 'signup' }),
      });
      const captchaResult = await captchaResponse.json().catch(() => ({ success: false }));
      if (!captchaResponse.ok || !captchaResult.success) {
        throw new Error(captchaResult.message || 'Captcha verification failed.');
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        await updateProfile(userCredential.user, { 
            displayName: name,
            photoURL: `https://placehold.co/128x128.png?text=${name.charAt(0)}`
        });
        const setupResult = await setupNewUser(userCredential.user.uid, name, email, referralCode);
        if (!setupResult.success) {
          await deleteUser(userCredential.user).catch(() => undefined);
          throw new Error(setupResult.message || 'Could not finish account setup.');
        }
        if (referralCode.trim() && !setupResult.referredBy) {
          throw new Error('The account was created, but the referral was not linked. Please contact support before making a deposit.');
        }
      }
      toast({
        title: "Account Created!",
        description: "You have been successfully signed up.",
      });
      // The (auth) layout will now handle the redirect to the correct page.
      // No router.push() needed here.
    } catch (error: any) {
      console.error('Signup error:', error);
      let description = error instanceof Error ? error.message : "An unexpected error occurred. Please try again.";
      if (error.code === 'auth/email-already-in-use') {
        description = "This email is already in use. Please try another one or log in.";
      } else if (error.code === 'auth/weak-password') {
        description = "The password is too weak. Please use at least 6 characters.";
      }
      toast({
        title: "Signup Failed",
        description,
        variant: "destructive",
      });
      setCaptchaToken('');
      setCaptchaAnswer('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="grid gap-2 text-center">
        <h1 className="text-3xl font-bold font-headline">Create an account</h1>
        <p className="text-balance text-muted-foreground">
          Enter your information to get started
        </p>
      </div>
      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            placeholder="Max Robinson"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
          />
        </div>
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
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="referral-code">Referral Code (Optional)</Label>
          <Input
            id="referral-code"
            placeholder="ABC123DE"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <LocalCaptcha
          disabled={isLoading}
          onChange={({ token, answer }) => {
            setCaptchaToken(token);
            setCaptchaAnswer(answer);
          }}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create account
        </Button>
        <GoogleAuthButton mode="signup" disabled={isLoading} />
      </form>
      <div className="mt-4 text-center text-sm">
        Already have an account?{' '}
        <Link href="/login" className="underline">
          Login
        </Link>
      </div>
    </>
  );
}
