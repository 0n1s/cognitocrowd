

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ArrowRight, BrainCircuit, Code, Feather, FlaskConical, Globe, Palette, PencilRuler, Quote, Shield, ScrollText, Sigma, Stethoscope, Bot, Briefcase, MessageCircle, Image as ImageIcon, Video, Check, TrendingUp, Award, Clock, ShieldCheck, Sparkles, X, Music2, WandSparkles } from 'lucide-react';
import NextImage from 'next/image';
import { ThemeToggle } from '@/components/theme-toggle';
import { getEnabledExpertiseAreas, getPackages, getAppSettings } from '@/lib/database';
import { Package } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getAiWorkspaceFeatures } from '@/lib/package-workspace';
import { LandingAuthButtons } from '@/components/landing-auth-buttons';


const LandingHeader = () => (
  <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div className="container flex h-16 items-center">
      <Link href="/" className="mr-6 flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
        <span className="font-bold font-headline text-lg">Trainly</span>
      </Link>
      <nav className="hidden flex-1 items-center space-x-6 text-sm font-medium md:flex">
        <Link href="#why-trainly" className="text-muted-foreground transition-colors hover:text-foreground">Why Us</Link>
        <Link href="#tools" className="text-muted-foreground transition-colors hover:text-foreground">AI Tools</Link>
        <Link href="#pricing" className="text-muted-foreground transition-colors hover:text-foreground">Pricing</Link>
        <Link href="#testimonials" className="text-muted-foreground transition-colors hover:text-foreground">Testimonials</Link>
      </nav>
      <div className="flex flex-1 items-center justify-end space-x-2">
        <ThemeToggle />
        <LandingAuthButtons />
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

const featureIcons = [PencilRuler, Code, Shield, Bot];
const whyUsIcons = [TrendingUp, Award, Clock, ShieldCheck];

function parsePackagePrice(priceText: string): number {
  const normalized = (priceText || '').trim().toLowerCase();
  if (!normalized || normalized === 'free') return 0;
  const match = normalized.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  const numeric = match ? Number(match[0]) : Number.NaN;
  return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
}

const ALL_EXPERTISE_AREAS = [
  "General Knowledge",
  "Mathematics",
  "Science (Physics, Chemistry, Biology)",
  "Software Development & Code",
  "History & Humanities",
  "Creative Writing & Literature",
  "Art & Design",
  "Business & Finance",
  "Health & Medicine",
];

export default async function Home() {
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
  
  const settings = await getAppSettings();
  const enabledExpertise = await getEnabledExpertiseAreas();
  const packages = await getPackages();
  const sortedPackages = [...packages].sort((a, b) => {
    const priceDifference = parsePackagePrice(a.price) - parsePackagePrice(b.price);
    return priceDifference || a.name.localeCompare(b.name);
  });
  const packageWorkspaceFeatures = packages.flatMap(getAiWorkspaceFeatures);
  const workspaceFeatureIsAvailable = (labelPrefix: string) =>
    packageWorkspaceFeatures.some((feature) => feature.enabled && feature.label.startsWith(labelPrefix));
  const workspaceFeatureMeta = [
    {
      icon: MessageCircle,
      available: workspaceFeatureIsAvailable('AI Chat'),
    },
    {
      icon: ImageIcon,
      available: workspaceFeatureIsAvailable('Image Generation'),
    },
    {
      icon: Video,
      available: workspaceFeatureIsAvailable('Video Generation'),
    },
    {
      icon: Music2,
      available: workspaceFeatureIsAvailable('Music Generation'),
    },
    {
      icon: WandSparkles,
      available: workspaceFeatureIsAvailable('Music Lyrics & Caption AI Assist'),
    },
  ];

  const { landingPageContent } = settings;
  
  if (!landingPageContent) {
    return <div>Landing page content not configured.</div>;
  }
  
  const { 
    heroTitle, heroSubtitle, heroCtaButton,
    platformTitle, platformSubtitle, featureItems,
    whyUsTitle, whyUsSubtitle, whyUsItems,
    workspaceTitle, workspaceSubtitle, workspaceItems,
    processTitle, processSubtitle, processSteps,
    pricingTitle, pricingSubtitle,
    testimonialsTitle, testimonialsSubtitle, testimonials,
    hiringTitle, hiringSubtitle,
    ctaTitle, ctaSubtitle, ctaButton,
    processImage1, processImage2, processImage3, hiringBackgroundImage
  } = landingPageContent;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative w-full h-[80vh] flex items-center justify-center text-center overflow-hidden">
            <div className="absolute inset-0 z-0 bg-background overflow-hidden bg-[linear-gradient(to_right,rgba(var(--primary-rgb),0.2)_1px,transparent_1px),linear-gradient(to_bottom,rgba(var(--primary-rgb),0.2)_1px,transparent_1px)] bg-[size:3rem_3rem]">
              <div className="absolute bottom-0 left-[-20%] right-0 top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(var(--primary-rgb),0.15),rgba(255,255,255,0))]"></div>
              <div className="absolute bottom-0 right-[-20%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(var(--accent-rgb),0.15),rgba(255,255,255,0))]"></div>
              <Bot className="absolute h-8 w-8 text-primary/50 top-1/4 left-1/3 animate-float-1" />
              <Bot className="absolute h-12 w-12 text-accent/40 bottom-1/4 right-1/3 animate-float-2 [animation-delay:1s]" />
              <Bot className="absolute h-6 w-6 text-primary/30 bottom-1/2 left-1/2 animate-float-3 [animation-delay:2s]" />
            </div>
            <div className="container relative z-10">
                <h1 className="font-headline text-5xl font-extrabold tracking-tighter sm:text-6xl md:text-7xl lg:text-8xl bg-clip-text text-transparent bg-gradient-to-b from-foreground to-muted-foreground">
                    {heroTitle}
                </h1>
                <p className="mx-auto max-w-[700px] text-lg text-muted-foreground md:text-xl mt-6">
                    {heroSubtitle}
                </p>
                <div className="mt-8 flex justify-center gap-4">
                    <Button size="lg" asChild className="shadow-lg shadow-primary/30">
                        <Link href="/signup">
                            {heroCtaButton} <ArrowRight className="ml-2 h-5 w-5" />
                        </Link>
                    </Button>
                </div>
            </div>
        </section>

        {/* Platform Section */}
        <section id="platform" className="py-20 bg-muted/20 dark:bg-card/40 border-y border-border/30">
          <div className="container">
            <div className="text-center max-w-2xl mx-auto mb-12">
                <h2 className="font-headline text-4xl font-bold">{platformTitle}</h2>
                <p className="text-muted-foreground mt-4 text-lg">{platformSubtitle}</p>
            </div>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {featureItems.map((item, index) => {
                const Icon = featureIcons[index] || BrainCircuit;
                return (
                  <div key={item.title} className="text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4 border border-primary/20">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                    <p className="text-muted-foreground mt-2">{item.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Why Us Section */}
        <section id="why-trainly" className="py-20">
          <div className="container">
            <div className="text-center max-w-2xl mx-auto mb-12">
                <h2 className="font-headline text-4xl font-bold">{whyUsTitle}</h2>
                <p className="text-muted-foreground mt-4 text-lg">{whyUsSubtitle}</p>
            </div>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
                {whyUsItems.map((item, index) => {
                  const Icon = whyUsIcons[index] || Check;
                  return (
                    <Card key={item.title} className="bg-card/50 border-border/30 backdrop-blur-sm text-center">
                      <CardHeader className="items-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4 border border-primary/20">
                            <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <CardTitle>{item.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground">{item.description}</p>
                      </CardContent>
                    </Card>
                  )
                })}
            </div>
          </div>
        </section>

        {/* AI Tools Section */}
        <section id="tools" className="py-20 bg-muted/20 dark:bg-card/40 border-y border-border/30">
          <div className="container">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h2 className="font-headline text-3xl font-bold">{workspaceTitle}</h2>
              <p className="mt-3 text-muted-foreground">
                {workspaceSubtitle}
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {workspaceItems.map((feature, index) => {
                const meta = workspaceFeatureMeta[index] || workspaceFeatureMeta[0];
                const Icon = meta.icon;
                return (
                  <Card key={feature.title} className="border-border/40 bg-background/70 transition-transform hover:-translate-y-1 hover:shadow-md">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className={cn(
                          'rounded-full px-2.5 py-1 text-xs font-medium',
                          meta.available ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-muted text-muted-foreground'
                        )}>
                          {meta.available ? 'Available on select plans' : 'Coming soon'}
                        </span>
                      </div>
                      <CardTitle className="pt-2 text-lg">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
        
        {/* Process Section */}
        <section id="process" className="py-20">
           <div className="container">
              <div className="text-center max-w-2xl mx-auto mb-16">
                  <h2 className="font-headline text-4xl font-bold tracking-tight">{processTitle}</h2>
                  <p className="mt-4 text-lg text-muted-foreground">{processSubtitle}</p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-16 items-center">
                  <div>
                      <h3 className="text-2xl font-bold font-headline">{processSteps[0].title}</h3>
                      <p className="mt-4 text-muted-foreground">{processSteps[0].description}</p>
                  </div>
                   <div className="w-full h-80 rounded-lg overflow-hidden">
                       <NextImage src={processImage1} alt="Person taking a test online" width={800} height={600} className="object-cover w-full h-full" data-ai-hint="person computer" />
                  </div>
              </div>
               <div className="grid md:grid-cols-2 gap-16 items-center mt-16">
                  <div className="w-full h-80 rounded-lg overflow-hidden md:order-last">
                       <NextImage src={processImage2} alt="Dashboard showing tasks" width={800} height={600} className="object-cover w-full h-full" data-ai-hint="dashboard screen" />
                  </div>
                  <div className="md:order-first">
                      <h3 className="text-2xl font-bold font-headline">{processSteps[1].title}</h3>
                      <p className="mt-4 text-muted-foreground">{processSteps[1].description}</p>
                  </div>
              </div>
              <div className="grid md:grid-cols-2 gap-16 items-center mt-16">
                  <div>
                      <h3 className="text-2xl font-bold font-headline">{processSteps[2].title}</h3>
                      <p className="mt-4 text-muted-foreground">{processSteps[2].description}</p>
                  </div>
                   <div className="w-full h-80 rounded-lg overflow-hidden">
                       <NextImage src={processImage3} alt="Wallet showing earnings" width={800} height={600} className="object-cover w-full h-full" data-ai-hint="payment success" />
                  </div>
              </div>
           </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 bg-muted/20 dark:bg-card/40 border-y border-border/30">
          <div className="container">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="font-headline text-4xl font-bold">{pricingTitle}</h2>
              <p className="text-muted-foreground mt-4 text-lg">{pricingSubtitle}</p>
            </div>
            {packages.length > 0 ? (
              <div className="grid gap-8 md:grid-cols-3 items-stretch max-w-5xl mx-auto">
                {sortedPackages.map((pkg) => {
                  const workspaceFeatures = getAiWorkspaceFeatures(pkg);
                  return (
                  <Card key={pkg.id} className={cn("flex h-full flex-col", pkg.isPrimary && "border-2 border-primary shadow-lg shadow-primary/20")}>
                    <CardHeader className="items-center text-center">
                      <CardTitle className="text-2xl font-headline">{pkg.name}</CardTitle>
                      <div className="text-4xl font-bold">
                        {pkg.price.startsWith('$') ? (
                          <>
                            {pkg.price.split('/')[0]}
                            <span className="text-sm font-normal text-muted-foreground">/{pkg.price.split('/')[1]}</span>
                          </>
                        ) : (
                          pkg.price
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <p className="mb-3 text-sm font-semibold">Package features</p>
                      <ul className="space-y-3">
                        <li className="flex items-center gap-3">
                          <Check className="h-5 w-5 text-green-500" />
                          <span className="text-muted-foreground">{`${pkg.taskLimit} tasks / ${pkg.expiryPeriod.replace('1 ', '')}`}</span>
                        </li>
                        {(pkg.features || []).map((feature, i) => (
                          <li key={i} className="flex items-center gap-3">
                            <Check className="h-5 w-5 text-green-500" />
                            <span className="text-muted-foreground">{feature}</span>
                          </li>
                        ))}
                        {(pkg.features || []).length === 0 && (
                          <li className="text-sm text-muted-foreground">No additional features listed.</li>
                        )}
                      </ul>
                      <div className="my-5 border-t" />
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                        <Sparkles className="h-4 w-4 text-primary" />
                        AI Workspace
                      </div>
                      <ul className="space-y-2.5">
                        {workspaceFeatures.map((feature) => (
                          <li key={feature.label} className="flex items-start gap-2 text-sm">
                            {feature.enabled ? (
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                            ) : (
                              <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                            )}
                            <span className={cn(
                              feature.enabled ? 'text-muted-foreground' : 'text-muted-foreground/60 line-through'
                            )}>
                              {feature.label}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <Button className="w-full" asChild>
                        <Link href="/signup">Get Started</Link>
                      </Button>
                    </CardFooter>
                  </Card>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground">Pricing plans will be available soon.</p>
            )}
          </div>
        </section>


        {/* Testimonials Section */}
        <section id="testimonials" className="py-20">
            <div className="container">
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <h2 className="font-headline text-4xl font-bold">{testimonialsTitle}</h2>
                    <p className="text-muted-foreground mt-4 text-lg">{testimonialsSubtitle}</p>
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
        <section id="hiring" className="py-20 bg-muted/20 dark:bg-card/40 border-y border-border/30 relative overflow-hidden">
            <div className="absolute inset-0 z-0 opacity-10">
                <NextImage src={hiringBackgroundImage} alt="Abstract network background" fill className="object-cover" data-ai-hint="abstract network" />
                <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background/80"></div>
            </div>
            <div className="container relative z-10 text-center">
                <h2 className="font-headline text-4xl font-bold tracking-tighter">{hiringTitle}</h2>
                <p className="mx-auto max-w-[600px] text-lg text-muted-foreground mt-4">{hiringSubtitle}</p>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-4xl mx-auto mt-12">
                    {ALL_EXPERTISE_AREAS.map(expertise => {
                        const Icon = expertiseIcons[expertise] || BrainCircuit;
                        return (
                            <div key={expertise} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/50 backdrop-blur-sm">
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
        <section className="container py-24 text-center">
          <h2 className="font-headline text-4xl font-bold tracking-tighter">{ctaTitle}</h2>
          <p className="mx-auto max-w-[600px] text-lg text-muted-foreground md:text-xl mt-4">{ctaSubtitle}</p>
          <div className="mt-8">
            <Button size="lg" asChild className="shadow-lg shadow-primary/30">
              <Link href="/signup">{ctaButton}</Link>
            </Button>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
