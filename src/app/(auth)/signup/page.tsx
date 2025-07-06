
"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import { setupNewUser } from '@/lib/actions';

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
        <title>Google</title>
        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.62 1.9-5.63 1.9-4.73 0-8.58-3.87-8.58-8.58s3.85-8.58 8.58-8.58c2.62 0 4.34 1.02 5.46 2.02l2.62-2.62C18.62 1.32 15.86 0 12.48 0 5.6 0 0 5.6 0 12.48s5.6 12.48 12.48 12.48c7.1 0 12.24-4.82 12.24-12.72 0-.8-.08-1.52-.24-2.22h-12z" fill="currentColor"/>
    </svg>
);


export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
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
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        await updateProfile(userCredential.user, { 
            displayName: name,
            photoURL: `https://placehold.co/128x128.png?text=${name.charAt(0)}`
        });
        await setupNewUser(userCredential.user.uid, name, email, referralCode);
      }
      toast({
        title: "Account Created!",
        description: "You have been successfully signed up.",
      });
      // The (auth) layout will now handle the redirect to the correct page.
      // No router.push() needed here.
    } catch (error: any) {
      console.error('Signup error:', error);
      let description = "An unexpected error occurred. Please try again.";
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
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create account
        </Button>
        <Button variant="outline" className="w-full" type="button" disabled={isLoading}>
            <GoogleIcon className="mr-2 h-4 w-4" />
            Sign up with Google
        </Button>
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
