import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import type { PublicPageContent } from '@/lib/types';
import { plainTextToTrustPageHtml, sanitizeTrustPageHtml } from '@/lib/trust-page-html';
import { BrandLogo } from '@/components/brand-logo';

const trustPageLinks = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/terms-of-service', label: 'Terms of Service' },
  { href: '/refund-policy', label: 'Refund Policy' },
  { href: '/contributor-guidelines', label: 'Contributor Guidelines' },
];

export function PublicPageShell({ page }: { page?: PublicPageContent }) {
  if (!page || page.enabled === false) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <PublicPageHeader />
        <main className="container flex flex-1 items-center justify-center py-24 text-center">
          <div className="max-w-lg">
            <h1 className="font-headline text-3xl font-bold">Page unavailable</h1>
            <p className="mt-3 text-muted-foreground">This page has not been configured yet.</p>
            <Button asChild className="mt-6">
              <Link href="/">Back Home</Link>
            </Button>
          </div>
        </main>
        <PublicPageFooter />
      </div>
    );
  }

  const rawContent = page.contentHtml || page.content || '';
  const startsWithTag = /^\s*</.test(rawContent) || /^\s*&lt;/.test(rawContent);
  const contentHtml = sanitizeTrustPageHtml(startsWithTag ? rawContent : plainTextToTrustPageHtml(rawContent));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicPageHeader />
      <main className="flex-1">
        <section className="border-b border-border/40 bg-gradient-to-b from-primary/5 via-muted/20 to-background py-16">
          <div className="container max-w-4xl">
            <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Link href="/" className="font-medium text-primary hover:underline underline-offset-4">Home</Link>
              <span>/</span>
              <span>Trust Center</span>
            </div>
            <h1 className="font-headline text-4xl font-bold tracking-tight md:text-5xl">{page.title}</h1>
            {page.subtitle ? (
              <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{page.subtitle}</p>
            ) : null}
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/signup">Get Started</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Back to Homepage</Link>
              </Button>
            </div>
          </div>
        </section>
        <section className="container max-w-4xl py-12">
          <div
            className="trust-content rounded-lg border bg-card p-6 shadow-sm"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        </section>
        <section className="border-t border-border/40 bg-muted/20">
          <div className="container max-w-4xl py-10">
            <div className="mb-4">
              <h2 className="font-headline text-2xl font-bold">Trust Center</h2>
              <p className="mt-2 text-sm text-muted-foreground">Review the pages that explain how TrainlyLabs works, protects users, and handles platform policies.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {trustPageLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg border bg-background p-4 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <PublicPageFooter />
    </div>
  );
}

function PublicPageHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <BrandLogo />
        </Link>
        <nav className="hidden flex-1 items-center gap-6 text-sm font-medium md:flex">
          <Link href="/" className="text-muted-foreground transition-colors hover:text-foreground">Home</Link>
          <Link href="/about" className="text-muted-foreground transition-colors hover:text-foreground">About</Link>
          <Link href="/contact" className="text-muted-foreground transition-colors hover:text-foreground">Contact</Link>
          <Link href="/#pricing" className="text-muted-foreground transition-colors hover:text-foreground">Pricing</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="/login">Log In</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Get Started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function PublicPageFooter() {
  return (
    <footer className="border-t border-border/40 bg-background">
      <div className="container flex flex-col gap-6 py-8 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Link href="/" className="flex items-center space-x-2">
            <BrandLogo />
          </Link>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Human expertise, AI workspace tools, and transparent platform policies for contributors.</p>
          <p className="mt-4 text-xs text-muted-foreground">&copy; {new Date().getFullYear()} TrainlyLabs. All rights reserved.</p>
        </div>
        <div className="grid gap-6 text-sm sm:grid-cols-2">
          <div className="space-y-2">
            <p className="font-semibold">Platform</p>
            <Link href="/" className="block text-muted-foreground hover:text-foreground">Homepage</Link>
            <Link href="/signup" className="block text-muted-foreground hover:text-foreground">Get Started</Link>
            <Link href="/login" className="block text-muted-foreground hover:text-foreground">Log In</Link>
          </div>
          <div className="space-y-2">
            <p className="font-semibold">Trust</p>
            {trustPageLinks.map((link) => (
              <Link key={link.href} href={link.href} className="block text-muted-foreground hover:text-foreground">{link.label}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
