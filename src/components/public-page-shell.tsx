import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import type { PublicPageContent } from '@/lib/types';
import { plainTextToTrustPageHtml, sanitizeTrustPageHtml } from '@/lib/trust-page-html';

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
      </div>
    );
  }

  const contentHtml = sanitizeTrustPageHtml(page.contentHtml || plainTextToTrustPageHtml(page.content || ''));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicPageHeader />
      <main className="flex-1">
        <section className="border-b border-border/40 bg-muted/20 py-16">
          <div className="container max-w-4xl">
            <h1 className="font-headline text-4xl font-bold tracking-tight md:text-5xl">{page.title}</h1>
            {page.subtitle ? (
              <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{page.subtitle}</p>
            ) : null}
          </div>
        </section>
        <section className="container max-w-4xl py-12">
          <div
            className="trust-content rounded-lg border bg-card p-6 shadow-sm"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        </section>
      </main>
    </div>
  );
}

function PublicPageHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
          <span className="font-bold font-headline text-lg">TrainlyLabs</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button asChild>
            <Link href="/signup">Get Started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
