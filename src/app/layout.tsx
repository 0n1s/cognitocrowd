
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
  title: 'TrainlyLabs',
  description: 'Help train AI models by completing simple, gamified tasks.',
  icons: {
    icon: [`/favicon.ico?v=${FAVICON_VERSION}`, `/icon.svg?v=${FAVICON_VERSION}`],
    shortcut: `/favicon.ico?v=${FAVICON_VERSION}`,
    apple: `/icon.svg?v=${FAVICON_VERSION}`,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getAppSettings().catch(() => null);

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
            <SupportWidget settings={settings} />
          </ThemeProvider>
      </body>
    </html>
  );
}
