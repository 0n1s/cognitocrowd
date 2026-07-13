import { PublicPageShell } from '@/components/public-page-shell';
import { getPublicPage } from '@/lib/database';

export default async function AboutPage() {
  const page = await getPublicPage('about');
  return <PublicPageShell page={page} />;
}