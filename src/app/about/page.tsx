import { PublicPageShell } from '@/components/public-page-shell';
import { getAppSettings } from '@/lib/database';

export default async function AboutPage() {
  const settings = await getAppSettings();
  return <PublicPageShell page={settings.publicPages?.about} />;
}
