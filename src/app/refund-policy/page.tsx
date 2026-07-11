import { PublicPageShell } from '@/components/public-page-shell';
import { getAppSettings } from '@/lib/database';

export default async function RefundPolicyPage() {
  const settings = await getAppSettings();
  return <PublicPageShell page={settings.publicPages?.refund} />;
}
