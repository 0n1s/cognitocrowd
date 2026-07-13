import { PublicPageShell } from '@/components/public-page-shell';
import { getPublicPage } from '@/lib/database';

export default async function ContactPage() {
  const page = await getPublicPage('contact');
  return <PublicPageShell page={page} />;
}