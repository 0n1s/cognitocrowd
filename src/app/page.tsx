import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cpu, Coins, Scaling, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { ThemeToggle } from '@/components/theme-toggle';

const LandingHeader = () => (
  <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div className="container flex h-16 items-center">
      <Link href="/" className="mr-6 flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
        <span className="font-bold font-headline text-lg">Trainly</span>
      </Link>
      <nav className="hidden flex-1 items-center space-x-6 text-sm font-medium md:flex">
        <Link href="#features" className="text-muted-foreground transition-colors hover:text-foreground">Features</Link>
        <Link href="#how-it-works" className="text-muted-foreground transition-colors hover:text-foreground">Process</Link>
      </nav>
      <div className="flex flex-1 items-center justify-end space-x-2">
        <ThemeToggle />
        <Button variant="ghost" asChild>
          <Link href="/login">Log In</Link>
        </Button>
        <Button asChild className="shadow-lg shadow-primary/20">
          <Link href="/signup">Start Earning</Link>
        </Button>
      </div>
    </div>
  </header>
);

const LandingFooter = () => (
  <footer className="border-t border-border/40">
    <div className="container py-8 flex flex-col md:flex-row items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground text-center md:text-left">&copy; {new Date().getFullYear()} Trainly. All rights reserved.</p>
      <div className="flex items-center gap-4">
        <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">Privacy Policy</Link>
        <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">Terms of Service</Link>
      </div>
    </div>
  </footer>
);

const FeatureCard = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
  <Card className="bg-card/50 border-border/30 backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-card/80 hover:scale-105">
    <CardHeader>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4 border border-primary/20">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <CardTitle className="font-headline text-center text-xl">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground text-center">
        {description}
      </p>
    </CardContent>
  </Card>
);

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative w-full h-[80vh] flex items-center justify-center text-center overflow-hidden">
            <div className="absolute inset-0 z-0 bg-background">
              <div className="absolute bottom-0 left-[-20%] right-0 top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(var(--primary-rgb),0.15),rgba(255,255,255,0))]"></div>
              <div className="absolute bottom-0 right-[-20%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(var(--accent-rgb),0.15),rgba(255,255,255,0))]"></div>
            </div>
            <div className="container relative z-10">
                <h1 className="font-headline text-5xl font-extrabold tracking-tighter sm:text-6xl md:text-7xl lg:text-8xl bg-clip-text text-transparent bg-gradient-to-b from-foreground to-muted-foreground">
                    Build Superhuman AI
                </h1>
                <p className="mx-auto max-w-[700px] text-lg text-muted-foreground md:text-xl mt-6">
                    Trainly is a superintelligence platform that allows you to contribute your human expertise to train the world's most advanced AI models, with superhuman accuracy.
                </p>
                <div className="mt-8 flex justify-center gap-4">
                    <Button size="lg" asChild className="shadow-lg shadow-primary/30">
                        <Link href="/signup">
                            Start Earning Today <ArrowRight className="ml-2 h-5 w-5" />
                        </Link>
                    </Button>
                </div>
            </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20">
           <div className="container grid md:grid-cols-2 gap-16 items-center">
                <div className="w-full h-full rounded-lg overflow-hidden">
                     <Image src="https://placehold.co/800x800.png" alt="Process diagram" width={800} height={800} className="object-cover w-full h-full" data-ai-hint="network diagram" />
                </div>
                <div>
                    <h2 className="font-headline text-4xl font-bold tracking-tight">Simple Process, Powerful Impact</h2>
                    <p className="mt-4 text-lg text-muted-foreground">From sign-up to earning, our streamlined process makes it easy to make a difference.</p>
                    <ul className="mt-8 space-y-6">
                        <li className="flex items-start">
                            <div className="flex-shrink-0"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary font-bold">1</div></div>
                            <div className="ml-4">
                                <h3 className="text-lg font-semibold">Qualify Your Expertise</h3>
                                <p className="text-muted-foreground">Take a short test to verify your skills in your chosen domains.</p>
                            </div>
                        </li>
                         <li className="flex items-start">
                           <div className="flex-shrink-0"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary font-bold">2</div></div>
                            <div className="ml-4">
                                <h3 className="text-lg font-semibold">Complete Paid Tasks</h3>
                                <p className="text-muted-foreground">Access a stream of paid tasks and start contributing your unique insights.</p>
                            </div>
                        </li>
                         <li className="flex items-start">
                           <div className="flex-shrink-0"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary font-bold">3</div></div>
                            <div className="ml-4">
                                <h3 className="text-lg font-semibold">Withdraw Your Earnings</h3>
                                <p className="text-muted-foreground">Easily cash out your earnings through multiple payment methods.</p>
                            </div>
                        </li>
                    </ul>
                </div>
           </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-muted/20 dark:bg-card/40 border-y border-border/30">
          <div className="container">
            <div className="text-center max-w-2xl mx-auto mb-12">
                <h2 className="font-headline text-4xl font-bold">The Future of AI Training</h2>
                <p className="text-muted-foreground mt-4 text-lg">We provide the tools and opportunities for you to make a real impact on artificial intelligence.</p>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
                <FeatureCard 
                    icon={Cpu}
                    title="High-Impact Tasks"
                    description="Engage in a variety of tasks from simple labeling to complex reasoning, all designed to create smarter, safer AI."
                />
                <FeatureCard 
                    icon={Coins}
                    title="Get Paid for Your Skills"
                    description="Your expertise is valuable. We offer competitive rewards for quality contributions, paid out in real cash."
                />
                <FeatureCard 
                    icon={Scaling}
                    title="Grow and Compete"
                    description="Climb the leaderboards, unlock higher-paying tasks, and establish yourself as a top-tier AI trainer."
                />
            </div>
          </div>
        </section>
        
        {/* CTA Section */}
        <section className="container py-24 text-center">
          <h2 className="font-headline text-4xl font-bold tracking-tighter">Ready to Shape the Future?</h2>
          <p className="mx-auto max-w-[600px] text-lg text-muted-foreground md:text-xl mt-4">
            Join a global community of experts and enthusiasts building the next generation of intelligence.
          </p>
          <div className="mt-8">
            <Button size="lg" asChild className="shadow-lg shadow-primary/30">
              <Link href="/signup">Sign Up & Start Earning</Link>
            </Button>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
