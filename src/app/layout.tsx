
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from '@/hooks/use-auth';
import { SessionCurrencyProvider } from '@/hooks/use-session-currency';
import { ThemeProvider } from "@/components/theme-provider";
import { Roboto } from 'next/font/google';

const roboto = Roboto({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto',
});

const FAVICON_VERSION = '20260708-1';

export const metadata: Metadata = {
  title: 'Trainly',
  description: 'Help train AI models by completing simple, gamified tasks.',
  icons: {
    icon: [`/favicon.ico?v=${FAVICON_VERSION}`, `/icon.svg?v=${FAVICON_VERSION}`],
    shortcut: `/favicon.ico?v=${FAVICON_VERSION}`,
    apple: `/icon.svg?v=${FAVICON_VERSION}`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${roboto.variable} font-body antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SessionCurrencyProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </SessionCurrencyProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
