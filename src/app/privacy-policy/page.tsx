import { PublicPageShell } from '@/components/public-page-shell';
import { getAppSettings } from '@/lib/database';

export default async function PrivacyPolicyPage() {
  const settings = await getAppSettings();
  return <PublicPageShell page={settings.publicPages?.privacy} />;
}
