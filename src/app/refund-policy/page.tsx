import { PublicPageShell } from '@/components/public-page-shell';
import { getPublicPage } from '@/lib/database';

export default async function RefundPolicyPage() {
  const page = await getPublicPage('refund');
  return <PublicPageShell page={page} />;
}