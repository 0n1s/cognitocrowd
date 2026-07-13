import { PublicPageShell } from '@/components/public-page-shell';
import { getPublicPage } from '@/lib/database';

export default async function PrivacyPolicyPage() {
  const page = await getPublicPage('privacy');
  return <PublicPageShell page={page} />;
}