import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/**
 * Proxies images from Firebase Storage without exposing service account credentials in the HTML.
 * Accepts a full signed URL or a storage path.
 * 
 * Usage (recommended): /api/storage/proxy-image?url=https://storage.googleapis.com/...signed-url...
 * Usage (alternative): /api/storage/proxy-image?path=landing-page/processImage1.jpg
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const inputUrl = searchParams.get('url');
    const path = searchParams.get('path');

    let storagePath: string | null = null;

    if (inputUrl) {
      // Extract the storage path from a full signed URL
      try {
        const url = new URL(inputUrl);
        // Path looks like /cognitocrowd.firebasestorage.app/landing-page/processImage1.jpg
        const pathParts = url.pathname.split('/');
        // Skip the bucket name (first 2 parts: empty string + bucket name)
        storagePath = pathParts.slice(2).join('/');
      } catch {
        return new NextResponse('Invalid URL', { status: 400 });
      }
    } else if (path) {
      storagePath = path;
    }

    if (!storagePath) {
      return new NextResponse('Missing url or path parameter', { status: 400 });
    }

    // Prevent directory traversal
    const sanitizedPath = storagePath.replace(/\.\.\//g, '').replace(/^\/+/, '');
    if (!sanitizedPath) {
      return new NextResponse('Invalid path', { status: 400 });
    }

    const bucket = (adminStorage as any).bucket();
    const file = bucket.file(sanitizedPath);

    const [exists] = await file.exists();
    if (!exists) {
      return new NextResponse('File not found', { status: 404 });
    }

    // Get a fresh signed URL with 1-hour expiry (server-side, never exposed to client)
    const [freshSignedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    // Fetch the image and return it directly
    const response = await fetch(freshSignedUrl);
    const blob = await response.blob();

    return new NextResponse(blob, {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return new NextResponse('Failed to load image', { status: 500 });
  }
}