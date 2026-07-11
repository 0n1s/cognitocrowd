import { Metadata } from 'next';
import { VerifyEmailContent } from './verify-email-content';

export const metadata: Metadata = {
  title: 'Verify Email - TrainlyLabs',
};

export default function VerifyEmailPage() {
  return <VerifyEmailContent />;
}