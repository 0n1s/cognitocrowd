import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Zap, Award } from 'lucide-react';
import Image from 'next/image';

const LandingHeader = () => (
  <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div className="container flex h-14 items-center">
      <Link href="/" className="mr-6 flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
        <span className="font-bold font-headline">CognitoCrowd</span>
      </Link>
      <nav className="flex flex-1 items-center space-x-4">
        {/* Future nav links can go here */}
      </nav>
      <div className="flex items-center space-x-2">
        <Button variant="ghost" asChild>
          <Link href="/login">Login</Link>
        </Button>
        <Button asChild>
          <Link href="/signup">Sign Up</Link>
        </Button>
      </div>
    </div>
  </header>
);

const LandingFooter = () => (
  <footer className="border-t">
    <div className="container py-8 flex items-center justify-between">
      <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} CognitoCrowd. All rights reserved.</p>
      <div className="flex items-center gap-4">
        <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">Privacy Policy</Link>
        <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">Terms of Service</Link>
      </div>
    </div>
  </footer>
);

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingHeader />
      <main className="flex-1">
        <section className="container py-20 text-center">
          <h1 className="font-headline text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
            Shape the Future of AI
          </h1>
          <p className="mx-auto max-w-[700px] text-lg text-muted-foreground md:text-xl mt-4">
            Join CognitoCrowd and help train intelligent models by completing simple, gamified tasks. Earn points, climb the leaderboard, and get real rewards for your contributions.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/signup">Get Started for Free</Link>
            </Button>
            <Button size="lg" variant="outline">
              Learn More
            </Button>
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="container grid gap-8 md:grid-cols-3">
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="font-headline mt-4">Engaging Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Complete a variety of fun and simple tasks, from image classification to text feedback, designed to be engaging and rewarding.
                </p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Award className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="font-headline mt-4">Earn Rewards</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Your contributions are valuable. Earn points for every task you complete and redeem them for gift cards, merchandise, and more.
                </p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="font-headline mt-4">Make an Impact</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Play a crucial role in the development of next-generation AI. Your work directly improves the models of tomorrow.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
        
        <section className="container py-20">
           <div className="grid md:grid-cols-2 gap-12 items-center">
                <div>
                    <h2 className="font-headline text-3xl font-bold tracking-tight">How It Works</h2>
                    <p className="mt-4 text-lg text-muted-foreground">Joining CognitoCrowd is easy. Start contributing and earning in just a few simple steps.</p>
                    <ul className="mt-8 space-y-6">
                        <li className="flex items-start">
                            <div className="flex-shrink-0"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">1</div></div>
                            <div className="ml-4">
                                <h3 className="text-lg font-semibold">Create Your Account</h3>
                                <p className="text-muted-foreground">Sign up in seconds with your email and password to get started.</p>
                            </div>
                        </li>
                         <li className="flex items-start">
                            <div className="flex-shrink-0"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">2</div></div>
                            <div className="ml-4">
                                <h3 className="text-lg font-semibold">Complete Tasks</h3>
                                <p className="text-muted-foreground">Browse the dashboard for available tasks and complete them at your own pace.</p>
                            </div>
                        </li>
                         <li className="flex items-start">
                            <div className="flex-shrink-0"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">3</div></div>
                            <div className="ml-4">
                                <h3 className="text-lg font-semibold">Earn Points & Redeem</h3>
                                <p className="text-muted-foreground">Watch your points grow and redeem them for exciting rewards in our store.</p>
                            </div>
                        </li>
                    </ul>
                </div>
                <div className="w-full h-full rounded-lg overflow-hidden shadow-2xl">
                     <Image src="https://placehold.co/600x600.png" alt="How it works" width={600} height={600} className="object-cover w-full h-full" data-ai-hint="teamwork collaboration" />
                </div>
           </div>
        </section>

      </main>
      <LandingFooter />
    </div>
  );
}
