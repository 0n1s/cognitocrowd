
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, BrainCircuit, Code, Feather, FlaskConical, Globe, Palette, PencilRuler, Quote, Shield, ScrollText, Sigma, Stethoscope, Bot, Briefcase } from 'lucide-react';
import Image from 'next/image';
import { ThemeToggle } from '@/components/theme-toggle';
import { getEnabledExpertiseAreas } from '@/lib/database';

const LandingHeader = () => (
  <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div className="container flex h-16 items-center">
      <Link href="/" className="mr-6 flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
        <span className="font-bold font-headline text-lg">Trainly</span>
      </Link>
      <nav className="hidden flex-1 items-center space-x-6 text-sm font-medium md:flex">
        <Link href="#platform" className="text-muted-foreground transition-colors hover:text-foreground">Platform</Link>
        <Link href="#process" className="text-muted-foreground transition-colors hover:text-foreground">Process</Link>
        <Link href="#testimonials" className="text-muted-foreground transition-colors hover:text-foreground">Testimonials</Link>
        <Link href="#hiring" className="text-muted-foreground transition-colors hover:text-foreground">Opportunities</Link>
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

const featureItems = [
    { icon: PencilRuler, title: "Creative & Writing Tasks", description: "Edit, proofread, and generate creative text to enhance language models' fluency and style." },
    { icon: Code, title: "Technical & Code Reviews", description: "Review and write code, debug algorithms, and test for vulnerabilities to improve AI's logical reasoning." },
    { icon: Shield, title: "Safety & Ethics Evaluation", description: "Identify and flag biased, harmful, or unethical responses to build safer and more responsible AI." },
    { icon: Bot, title: "AI Model Interaction", description: "Engage in conversations with AI, testing its capabilities and providing feedback on its performance and helpfulness." }
];

const testimonials = [
    { name: "Aisha Khan", role: "Software Engineer", quote: "Trainly provides the most interesting and challenging code-related tasks. It's rewarding to know my work directly improves the models I use daily." },
    { name: "Dr. Ben Carter", role: "Medical Researcher", quote: "The platform's focus on quality and accuracy is impressive. It's a fantastic way to contribute specialized knowledge and stay at the cutting edge of AI." },
    { name: "Maria Garcia", role: "Creative Writer & Editor", quote: "I get to use my writing skills to shape how AI communicates. The tasks are engaging, and the platform is incredibly intuitive and fair." }
];

export default async function Home() {
  const enabledExpertise = await getEnabledExpertiseAreas();

  const expertiseIcons: { [key: string]: React.ElementType } = {
    "General Knowledge": Globe,
    "Mathematics": Sigma,
    "Science (Physics, Chemistry, Biology)": FlaskConical,
    "Software Development & Code": Code,
    "History & Humanities": ScrollText,
    "Creative Writing & Literature": Feather,
    "Art & Design": Palette,
    "Business & Finance": Briefcase,
    "Health & Medicine": Stethoscope,
  };

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
                    Join an elite network of human experts training the next generation of artificial intelligence. Your knowledge fuels the future.
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

        {/* Platform Section */}
        <section id="platform" className="py-20 bg-muted/20 dark:bg-card/40 border-y border-border/30">
          <div className="container">
            <div className="text-center max-w-2xl mx-auto mb-12">
                <h2 className="font-headline text-4xl font-bold">The World's Most Advanced AI Training Platform</h2>
                <p className="text-muted-foreground mt-4 text-lg">We connect human intelligence with machine learning to solve complex reasoning problems at scale.</p>
            </div>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {featureItems.map(item => (
                <div key={item.title} className="text-center">
                   <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4 border border-primary/20">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="text-muted-foreground mt-2">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        
        {/* Process Section */}
        <section id="process" className="py-20">
           <div className="container">
              <div className="text-center max-w-2xl mx-auto mb-16">
                  <h2 className="font-headline text-4xl font-bold tracking-tight">Simple Process, Powerful Impact</h2>
                  <p className="mt-4 text-lg text-muted-foreground">From sign-up to earning, our streamlined process makes it easy to make a difference.</p>
              </div>
              <div className="grid md:grid-cols-2 gap-16 items-center">
                  <div>
                      <h3 className="text-2xl font-bold font-headline">1. Qualify Your Expertise</h3>
                      <p className="mt-4 text-muted-foreground">Create an account and tell us about your skills. You'll take a short, one-time qualification test in your chosen domains to unlock relevant, high-paying tasks. This ensures we maintain the highest quality standards.</p>
                  </div>
                   <div className="w-full h-80 rounded-lg overflow-hidden">
                       <Image src="https://placehold.co/800x600.png" alt="Person taking a test online" width={800} height={600} className="object-cover w-full h-full" data-ai-hint="person computer" />
                  </div>
              </div>
               <div className="grid md:grid-cols-2 gap-16 items-center mt-16">
                  <div className="w-full h-80 rounded-lg overflow-hidden md:order-last">
                       <Image src="https://placehold.co/800x600.png" alt="Dashboard showing tasks" width={800} height={600} className="object-cover w-full h-full" data-ai-hint="dashboard screen" />
                  </div>
                  <div className="md:order-first">
                      <h3 className="text-2xl font-bold font-headline">2. Complete Paid Tasks</h3>
                      <p className="mt-4 text-muted-foreground">Once approved, you'll gain access to a personalized dashboard with a stream of contributions. Choose tasks that match your skills, from simple data labeling to complex problem-solving, and earn rewards for every quality submission.</p>
                  </div>
              </div>
              <div className="grid md:grid-cols-2 gap-16 items-center mt-16">
                  <div>
                      <h3 className="text-2xl font-bold font-headline">3. Withdraw Your Earnings</h3>
                      <p className="mt-4 text-muted-foreground">Your work has real value. Track your earnings in your wallet and easily cash out your balance through multiple secure payment methods. We believe in rewarding expertise, fairly and transparently.</p>
                  </div>
                   <div className="w-full h-80 rounded-lg overflow-hidden">
                       <Image src="https://placehold.co/800x600.png" alt="Wallet showing earnings" width={800} height={600} className="object-cover w-full h-full" data-ai-hint="payment success" />
                  </div>
              </div>
           </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="py-20 bg-muted/20 dark:bg-card/40 border-y border-border/30">
            <div className="container">
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <h2 className="font-headline text-4xl font-bold">Trusted by Experts Worldwide</h2>
                    <p className="text-muted-foreground mt-4 text-lg">Our contributors are the backbone of the next AI revolution. Here's what they have to say.</p>
                </div>
                <div className="grid gap-8 md:grid-cols-3">
                    {testimonials.map((testimonial, index) => (
                        <Card key={index} className="bg-card/50 border-border/30 backdrop-blur-sm">
                            <CardContent className="pt-6">
                                <Quote className="w-8 h-8 text-primary mb-4" />
                                <p className="text-card-foreground">"{testimonial.quote}"</p>
                            </CardContent>
                            <CardHeader>
                                <div className="font-semibold">{testimonial.name}</div>
                                <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            </div>
        </section>

        {/* Hiring Section */}
        <section id="hiring" className="py-20 relative overflow-hidden">
            <div className="absolute inset-0 z-0 opacity-10">
                <Image src="https://placehold.co/1920x1080.png" alt="Abstract network background" layout="fill" objectFit="cover" data-ai-hint="abstract network" />
                <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background/80"></div>
            </div>
            <div className="container relative z-10 text-center">
                <h2 className="font-headline text-4xl font-bold tracking-tighter">Now hiring: researchers, innovators, and trainers</h2>
                <p className="mx-auto max-w-[600px] text-lg text-muted-foreground mt-4">
                    Whether you have expertise in organic chemistry or creative writing, there’s a place for you.
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-4xl mx-auto mt-12">
                    {enabledExpertise.map(expertise => {
                        const Icon = expertiseIcons[expertise] || BrainCircuit;
                        return (
                            <div key={expertise} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/50">
                                <Icon className="h-5 w-5 text-primary" />
                                <span className="text-sm font-medium">{expertise}</span>
                            </div>
                        )
                    })}
                </div>
                
                <div className="mt-12">
                    <Button size="lg" asChild>
                        <Link href="/signup">Explore available freelance roles and sign up today!</Link>
                    </Button>
                </div>
            </div>
        </section>

        {/* CTA Section */}
        <section className="container py-24 text-center border-t border-border/30">
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
