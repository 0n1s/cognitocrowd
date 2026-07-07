"use client";

import { useEffect, useMemo, useState } from 'react';
import { Copy, Gift, Link as LinkIcon, Users } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getReferralDashboard } from '@/lib/user-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDisplayCurrency } from '@/hooks/use-display-currency';

type ReferredUser = {
  id: string; name: string; email: string; packageName: string; firstDepositAmount: number | null;
  bonusEarned: number; status: string; signupDate: string | null; creditedAt: string | null;
};

export default function ReferralsPage() {
  const { formatAmount } = useDisplayCurrency();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ referralCode: string; referralBalance: number; totalEarnings: number; referredUsers: ReferredUser[] } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    getReferralDashboard().then((result) => {
      if (!result.success) throw new Error(result.message || 'Could not load referrals.');
      setData({
        referralCode: result.referralCode || '',
        referralBalance: Number(result.referralBalance || 0),
        totalEarnings: Number(result.totalEarnings || 0),
        referredUsers: (result.referredUsers || []) as ReferredUser[],
      });
    }).catch((error) => {
      toast({ title: 'Referral data unavailable', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    }).finally(() => setLoading(false));
  }, [authLoading, user, toast]);

  const referralLink = useMemo(() => {
    if (!data?.referralCode || typeof window === 'undefined') return '';
    return `${window.location.origin}/signup?ref=${encodeURIComponent(data.referralCode)}`;
  }, [data?.referralCode]);
  const pending = data?.referredUsers.filter((item) => item.status === 'pending').length || 0;
  const credited = data?.referredUsers.filter((item) => item.status === 'credited').length || 0;

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: `${label} copied` });
  };

  if (loading || authLoading) return <div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-36 w-full" /><Skeleton className="h-80 w-full" /></div>;
  if (!data) return <p>Could not load referral information.</p>;

  return (
    <div className="space-y-8">
      <div><h1 className="text-3xl font-bold font-headline">Referral Program</h1><p className="mt-1 text-muted-foreground">Invite friends and earn when their eligible deposits succeed.</p></div>
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Referred users</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{data.referredUsers.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Referral balance</CardTitle></CardHeader><CardContent className="text-3xl font-bold text-primary">{formatAmount(data.referralBalance, 'USD')}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total earned</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{formatAmount(data.totalEarnings, 'USD')}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Bonus status</CardTitle></CardHeader><CardContent className="text-sm"><span className="font-semibold">{credited}</span> credited · <span className="font-semibold">{pending}</span> pending</CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5" /> Share your invitation</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><label className="text-sm font-medium">Referral code</label><div className="flex gap-2"><Input readOnly value={data.referralCode} /><Button variant="outline" size="icon" onClick={() => copy(data.referralCode, 'Code')}><Copy className="h-4 w-4" /></Button></div></div>
          <div className="space-y-2"><label className="text-sm font-medium">Referral link</label><div className="flex gap-2"><Input readOnly value={referralLink} /><Button variant="outline" size="icon" onClick={() => copy(referralLink, 'Link')}><LinkIcon className="h-4 w-4" /></Button></div></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Referral activity</CardTitle></CardHeader>
        <CardContent><Table><TableHeader><TableRow><TableHead>User</TableHead><TableHead>Package</TableHead><TableHead>First deposit</TableHead><TableHead>Bonus</TableHead><TableHead>Status</TableHead><TableHead>Signup date</TableHead><TableHead>Credited</TableHead></TableRow></TableHeader>
          <TableBody>{data.referredUsers.length ? data.referredUsers.map((item) => <TableRow key={item.id}><TableCell><div className="font-medium">{item.name}</div><div className="text-xs text-muted-foreground">{item.email}</div></TableCell><TableCell>{item.packageName}</TableCell><TableCell>{item.firstDepositAmount == null ? 'None' : formatAmount(item.firstDepositAmount, 'USD')}</TableCell><TableCell>{formatAmount(item.bonusEarned, 'USD')}</TableCell><TableCell><Badge variant={item.status === 'credited' ? 'secondary' : 'outline'}>{item.status}</Badge></TableCell><TableCell>{item.signupDate ? new Date(item.signupDate).toLocaleDateString() : 'N/A'}</TableCell><TableCell>{item.creditedAt ? new Date(item.creditedAt).toLocaleDateString() : '—'}</TableCell></TableRow>) : <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No referrals yet. Share your link to get started.</TableCell></TableRow>}</TableBody>
        </Table></CardContent>
      </Card>
    </div>
  );
}
