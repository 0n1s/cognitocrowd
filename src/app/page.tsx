import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrainCircuit, Sparkles, TrendingUp, MoveRight } from 'lucide-react';
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
        <Link href="#how-it-works" className="text-muted-foreground transition-colors hover:text-foreground">How It Works</Link>
      </nav>
      <div className="flex flex-1 items-center justify-end space-x-2">
        <ThemeToggle />
        <Button variant="ghost" asChild>
          <Link href="/login">Login</Link>
        </Button>
        <Button asChild className="shadow-lg shadow-primary/20">
          <Link href="/signup">Begin Your Ascent</Link>
        </Button>
      </div>
    </div>
  </header>
);

const LandingFooter = () => (
  <footer className="border-t border-border/40">
    <div className="container py-8 flex flex-col md:flex-row items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground text-center md:text-left">&copy; {new Date().getFullYear()} Trainly. The Future of Intelligence is Collaborative.</p>
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
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4 border border-primary/20">
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
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]"></div>
            <div className="container relative z-10">
                <h1 className="font-headline text-5xl font-extrabold tracking-tighter sm:text-6xl md:text-7xl lg:text-8xl bg-clip-text text-transparent bg-gradient-to-b from-foreground to-muted-foreground">
                    The Nexus of Human & Machine
                </h1>
                <p className="mx-auto max-w-[700px] text-lg text-muted-foreground md:text-xl mt-6">
                    Become a vital node in the global neural network. Your insights forge the next generation of artificial intelligence. Earn rewards, prove your expertise, and build the future.
                </p>
                <div className="mt-8 flex justify-center gap-4">
                    <Button size="lg" asChild className="shadow-lg shadow-primary/30">
                        <Link href="/signup">
                            Join the Vanguard <MoveRight className="ml-2 h-5 w-5" />
                        </Link>
                    </Button>
                </div>
            </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20">
          <div className="container">
            <div className="text-center max-w-2xl mx-auto mb-12">
                <h2 className="font-headline text-4xl font-bold">The Core Protocol</h2>
                <p className="text-muted-foreground mt-4 text-lg">Our platform is built on three fundamental principles that empower both our contributors and the AI they help create.</p>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
                <FeatureCard 
                    icon={BrainCircuit}
                    title="Cognitive Synergy"
                    description="Engage in sophisticated tasks that challenge your intellect and directly influence AI's reasoning and creativity."
                />
                <FeatureCard 
                    icon={TrendingUp}
                    title="Quantifiable Merit"
                    description="Your contributions are valued and rewarded. Ascend the leaderboards and convert your expertise into tangible assets."
                />
                <FeatureCard 
                    icon={Sparkles}
                    title="Pioneering Impact"
                    description="You are not just training models; you are a co-architect of future intelligence, ensuring it is robust, safe, and aligned."
                />
            </div>
          </div>
        </section>
        
        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 bg-muted/20 dark:bg-card/40 border-y border-border/30">
           <div className="container grid md:grid-cols-2 gap-12 items-center">
                <div className="w-full h-full rounded-lg overflow-hidden shadow-2xl shadow-primary/10">
                     <Image src="https://placehold.co/800x800.png" alt="How it works" width={800} height={800} className="object-cover w-full h-full" data-ai-hint="futuristic interface" />
                </div>
                <div>
                    <h2 className="font-headline text-4xl font-bold tracking-tight">Onboarding Matrix</h2>
                    <p className="mt-4 text-lg text-muted-foreground">Integration into the Trainly collective is a streamlined, three-phase process.</p>
                    <ul className="mt-8 space-y-6">
                        <li className="flex items-start">
                            <div className="flex-shrink-0"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary font-bold">1</div></div>
                            <div className="ml-4">
                                <h3 className="text-lg font-semibold">Identity Sync</h3>
                                <p className="text-muted-foreground">Establish your node. Secure registration links you to our network.</p>
                            </div>
                        </li>
                         <li className="flex items-start">
                           <div className="flex-shrink-0"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary font-bold">2</div></div>
                            <div className="ml-4">
                                <h3 className="text-lg font-semibold">Contribution Cycle</h3>
                                <p className="text-muted-foreground">Access the contribution stream. Select tasks that align with your expertise and begin shaping AI.</p>
                            </div>
                        </li>
                         <li className="flex items-start">
                           <div className="flex-shrink-0"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary font-bold">3</div></div>
                            <div className="ml-4">
                                <h3 className="text-lg font-semibold">Value Realization</h3>
                                <p className="text-muted-foreground">As your influence grows, convert your earned points into real-world assets and rewards.</p>
                            </div>
                        </li>
                    </ul>
                </div>
           </div>
        </section>
        
        {/* CTA Section */}
        <section className="container py-24 text-center">
          <h2 className="font-headline text-4xl font-bold tracking-tighter">Your Evolution Awaits</h2>
          <p className="mx-auto max-w-[600px] text-lg text-muted-foreground md:text-xl mt-4">
            The future isn't built by spectators. It's forged by contributors. Are you ready to make your mark?
          </p>
          <div className="mt-8">
            <Button size="lg" asChild className="shadow-lg shadow-primary/30">
              <Link href="/signup">Begin Your Ascent</Link>
            </Button>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
