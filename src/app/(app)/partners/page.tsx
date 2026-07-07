"use client";

import { PartnerTransactions } from '@/app/(app)/wallet/partner-transactions';

export default function PartnersPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold font-headline">Partners</h1>
      <p className="mt-1 text-muted-foreground">Find available partners in your country and initiate local deposits or withdrawals.</p>
      <PartnerTransactions onChanged={() => {}} />
    </div>
  );
}
