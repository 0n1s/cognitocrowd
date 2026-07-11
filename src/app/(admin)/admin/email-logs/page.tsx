import { Metadata } from 'next';
import { EmailLogsContent } from './email-logs-content';

export const metadata: Metadata = {
  title: 'Email Logs - Admin',
};

export default function EmailLogsPage() {
  return <EmailLogsContent />;
}