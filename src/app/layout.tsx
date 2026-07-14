import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from '@/hooks/use-auth';
import { SessionCurrencyProvider } from '@/hooks/use-session-currency';
import { ThemeProvider } from "@/components/theme-provider";
import { Comfortaa } from 'next/font/google';
import { SupportWidget } from '@/components/support-widget';
import { ServiceWorkerRegister } from '@/components/service-worker-register';
import { getSupportWidgetSettings } from '@/lib/database';
import { getBrandAssets } from '@/lib/database';
import { BrandProvider } from '@/components/brand-provider';

const comfortaa = Comfortaa({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-comfortaa',
});

const FAVICON_VERSION = '20260708-1';

const baseMetadata: Metadata = {
  metadataBase: new URL('https://trainlylabs.com'),
  title: {
    default: 'TrainlyLabs — Train AI. Earn Rewards. Create with AI.',
    template: '%s | TrainlyLabs',
  },
  description: 'A full-stack AI contributor platform. Complete paid AI training tasks, use AI workspace tools, manage your wallet, and earn rewards.',
  icons: {
    icon: [`/favicon.ico?v=${FAVICON_VERSION}`, `/icon.svg?v=${FAVICON_VERSION}`],
    shortcut: `/favicon.ico?v=${FAVICON_VERSION}`,
    apple: `/icon.svg?v=${FAVICON_VERSION}`,
  },
  openGraph: {
    type: 'website',
    siteName: 'TrainlyLabs',
    title: 'TrainlyLabs — AI Contributor Platform',
    description: 'Complete paid AI training tasks, use AI creative tools, and earn rewards.',
    url: 'https://trainlylabs.com',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TrainlyLabs',
    description: 'Earn rewards by training AI and using creative AI tools.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const assets = await getBrandAssets();
  return {
    ...baseMetadata,
    icons: {
      icon: assets.faviconUrl || baseMetadata.icons?.icon,
      shortcut: assets.faviconUrl || `/favicon.ico?v=${FAVICON_VERSION}`,
      apple: assets.appleTouchIconUrl || assets.faviconUrl || `/icon.svg?v=${FAVICON_VERSION}`,
    },
    openGraph: {
      ...baseMetadata.openGraph,
      images: assets.socialImageUrl ? [{ url: assets.socialImageUrl }] : undefined,
    },
    twitter: {
      ...baseMetadata.twitter,
      images: assets.socialImageUrl ? [assets.socialImageUrl] : undefined,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch only the support-widget fields — never the full settings object.
  // The full object includes sensitive keys (plisioApiKey, aiProviders[].apiKey)
  // that would be serialized into the RSC payload if held in scope here.
  const supportSettings = await getSupportWidgetSettings().catch(() => null);
  const brandAssets = await getBrandAssets();

  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={`${comfortaa.variable} font-body antialiased`}>
          <BrandProvider assets={brandAssets}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SessionCurrencyProvider>
              <AuthProvider>
                <ServiceWorkerRegister />
                {children}
              </AuthProvider>
            </SessionCurrencyProvider>
            <Toaster />
            <SupportWidget settings={supportSettings} />
          </ThemeProvider>
          </BrandProvider>
      </body>
    </html>
  );
}
