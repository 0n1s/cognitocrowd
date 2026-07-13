import { PublicPageShell } from '@/components/public-page-shell';
import { getPublicPage } from '@/lib/database';

export default async function ContributorGuidelinesPage() {
  const page = await getPublicPage('guidelines');
  return <PublicPageShell page={page} />;
}