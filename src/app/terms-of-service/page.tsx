import { PublicPageShell } from '@/components/public-page-shell';
import { getPublicPage } from '@/lib/database';

export default async function TermsOfServicePage() {
  const page = await getPublicPage('terms');
  return <PublicPageShell page={page} />;
}