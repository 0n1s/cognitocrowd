import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from '@/hooks/use-auth';
import { SessionCurrencyProvider } from '@/hooks/use-session-currency';
import { ThemeProvider } from "@/components/theme-provider";
import { Roboto } from 'next/font/google';
import { SupportWidget } from '@/components/support-widget';
import { ServiceWorkerRegister } from '@/components/service-worker-register';
import { getAppSettings } from '@/lib/database';

const roboto = Roboto({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto',
});

const FAVICON_VERSION = '20260708-1';

export const metadata: Metadata = {
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

function sanitizeSettingsForClient(settings: any) {
  if (!settings) return null;
  // Only pass support-widget-related fields to the client
  return {
    supportWidgetEnabled: settings.supportWidgetEnabled,
    supportWidgetProvider: settings.supportWidgetProvider,
    supportWidgetTawkPropertyId: settings.supportWidgetTawkPropertyId,
    supportWidgetTawkWidgetId: settings.supportWidgetTawkWidgetId,
    supportWidgetCrispWebsiteId: settings.supportWidgetCrispWebsiteId,
    supportWidgetScriptUrl: settings.supportWidgetScriptUrl,
    supportWidgetCustomScript: settings.supportWidgetCustomScript,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getAppSettings().catch(() => null);
  const clientSettings = sanitizeSettingsForClient(settings);

  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={`${roboto.variable} font-body antialiased`}>
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
            <SupportWidget settings={clientSettings} />
          </ThemeProvider>
      </body>
    </html>
  );
}