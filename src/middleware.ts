import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Set Content-Security-Policy header for all routes.
  // Broad https: and wss: policies allow any third-party support widget
  // (Tawk.to, Crisp, custom script) without needing to list each domain.
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "style-src 'self' 'unsafe-inline' https:",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https: data:",
      "connect-src 'self' https: wss:",
      "frame-src 'self' https:",
      "worker-src 'self' blob:",
      "media-src 'self' https:",
      "object-src 'none'",
    ].join('; ')
  );

  return response;
}

export const config = {
  matcher: [
    // Apply to all routes except static files and API routes
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|api/).*)',
  ],
};