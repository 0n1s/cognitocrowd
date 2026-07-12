
"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { LocalCaptcha } from '@/components/security/local-captcha';
import { GoogleAuthButton } from '@/components/google-auth-button';


export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
        description: 'Please complete the captcha before signing in.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const captchaResponse = await fetch('/api/security/captcha/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: captchaToken, answer: captchaAnswer, action: 'login' }),
      });
      const captchaResult = await captchaResponse.json().catch(() => ({ success: false }));
      if (!captchaResponse.ok || !captchaResult.success) {
        throw new Error(captchaResult.message || 'Captcha verification failed.');
      }

      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Login Failed",
        description: error instanceof Error ? error.message : "Invalid email or password. Please try again.",
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
        <h1 className="text-3xl font-bold font-headline">Welcome Back</h1>
        <p className="text-balance text-muted-foreground">
          Enter your credentials to access your account
        </p>
      </div>
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
        <div className="grid gap-2">
          <div className="flex items-center">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="ml-auto inline-block text-sm underline"
            >
              Forgot your password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
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
          Login
        </Button>
        <GoogleAuthButton mode="login" disabled={isLoading} />
      </form>
      <div className="mt-4 text-center text-sm">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="underline">
          Sign up
        </Link>
      </div>
    </>
  );
}
