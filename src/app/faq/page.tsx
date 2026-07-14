import { HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { getPublicPage } from '@/lib/database';

export default async function FaqPage() {
  const page = await getPublicPage('faq');
  const title = page?.title || 'Frequently Asked Questions';
  const subtitle = page?.subtitle || 'Answers to common questions about earning, qualifying, and using TrainlyLabs.';
  const contentHtml = page?.contentHtml || '';
  const hasContent = Boolean(contentHtml.trim());

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            <span className="font-bold font-headline text-lg">TrainlyLabs</span>
          </Link>
          <nav className="hidden flex-1 items-center space-x-6 text-sm font-medium md:flex">
            <Link href="/" className="text-muted-foreground transition-colors hover:text-foreground">Home</Link>
            <Link href="/about" className="text-muted-foreground transition-colors hover:text-foreground">About</Link>
            <Link href="/contact" className="text-muted-foreground transition-colors hover:text-foreground">Contact</Link>
            <Link href="/faq" className="text-foreground font-semibold">FAQ</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button asChild>
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="border-b border-border/40 bg-muted/20 py-16">
          <div className="container max-w-4xl text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
              <HelpCircle className="h-8 w-8 text-primary" />
            </div>
            <h1 className="font-headline text-4xl font-bold tracking-tight md:text-5xl">{title}</h1>
            {subtitle ? (
              <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </section>

        <section className="py-16">
          <div className="container max-w-3xl">
            {hasContent ? (
              <div
                className="trust-content"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />
            ) : (
              <div className="py-16 text-center">
                <p className="text-muted-foreground">This page has not been configured yet. The administrator can manage this page under Admin Panel → Settings → Public Trust Pages.</p>
                <Button asChild className="mt-4">
                  <Link href="/">Back to Home</Link>
                </Button>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40">
        <div className="container py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground text-center md:text-left">&copy; {new Date().getFullYear()} TrainlyLabs. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground">About</Link>
            <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground">Contact</Link>
            <Link href="/faq" className="text-sm text-muted-foreground hover:text-foreground">FAQ</Link>
            <Link href="/privacy-policy" className="text-sm text-muted-foreground hover:text-foreground">Privacy Policy</Link>
            <Link href="/terms-of-service" className="text-sm text-muted-foreground hover:text-foreground">Terms of Service</Link>
            <Link href="/refund-policy" className="text-sm text-muted-foreground hover:text-foreground">Refund Policy</Link>
            <Link href="/contributor-guidelines" className="text-sm text-muted-foreground hover:text-foreground">Contributor Guidelines</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
