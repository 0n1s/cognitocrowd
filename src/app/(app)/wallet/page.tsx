
"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getUserData, getAppSettings, getDepositHistory, getPackage } from '@/lib/database';
import { Download, Gift, Upload } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { AppSettings, Deposit, Package, WithdrawalRequest } from '@/lib/types';
import { DepositDialog } from './deposit-dialog';
import { WithdrawalForm } from './withdrawal-form';
import { getUserWithdrawalHistory } from '@/lib/user-api';
import { useToast } from '@/hooks/use-toast';

function WalletPageLoadingSkeleton() {
    return (
        <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-5 w-64" />
            <div className="grid gap-8 mt-8 md:grid-cols-2">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        </div>
    )
}

export default function WalletPage() {
  const [balances, setBalances] = useState<{ earnings: number; deposits: number; referrals: number } | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [minWithdrawalAmount, setMinWithdrawalAmount] = useState(0);
  const [maxWithdrawalAmount, setMaxWithdrawalAmount] = useState(0);
  const [withdrawalsAllowed, setWithdrawalsAllowed] = useState(true);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isDepositDialogOpen, setIsDepositDialogOpen] = useState(false);
  const [isRedeemDialogOpen, setIsRedeemDialogOpen] = useState(false);

  const getStatusClassName = (status: string) => {
    if (status === 'completed') return 'bg-green-500/20 text-green-700 border-green-500/30';
    if (status === 'pending') return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30';
    if (status === 'failed') return 'bg-red-500/20 text-red-700 border-red-500/30';
    return 'bg-muted text-muted-foreground border-border';
  };

  const formatDate = (value: any) => {
    if (!value) return 'N/A';
    if (typeof value === 'string') return new Date(value).toLocaleString();
    if (typeof value?.toDate === 'function') return value.toDate().toLocaleString();
    return 'N/A';
  };

  const formatAmount = (value: unknown) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00';
  };

  const fetchWalletData = async () => {
      if (!user) {
        setLoading(false);
        return;
      };
      setLoading(true);
      setHistoryError(null);
      try {
        const [userData, appSettings, depositHistory, withdrawalResult] = await Promise.all([
            getUserData(user.uid),
            getAppSettings(),
            getDepositHistory(user.uid),
          getUserWithdrawalHistory(user.uid),
        ]);
        if (userData) {
          setBalances({
            earnings: userData.earningsBalance || 0,
            deposits: userData.depositBalance || 0,
            referrals: userData.referralBalance || 0,
          });

          const globalMin = Number(appSettings.withdrawalMinimumAmount || 0);
          const globalMax = Number(appSettings.withdrawalMaximumAmount || 0);

          let packageMin = 0;
          let packageMax = 0;
          let packageAllowsWithdrawals = true;
          if (userData.packageId) {
            const userPackage: Package | null = await getPackage(userData.packageId);
            packageMin = Number(userPackage?.withdrawalMinimumAmount || 0);
            packageMax = Number(userPackage?.withdrawalMaximumAmount || 0);
            packageAllowsWithdrawals = userPackage?.allowWithdrawals !== false;
          }

          const effectiveMin = Math.max(globalMin > 0 ? globalMin : 0, packageMin > 0 ? packageMin : 0);
          const hasGlobalMax = globalMax > 0;
          const hasPackageMax = packageMax > 0;
          const effectiveMax = hasGlobalMax && hasPackageMax
            ? Math.min(globalMax, packageMax)
            : hasGlobalMax
              ? globalMax
              : hasPackageMax
                ? packageMax
                : 0;

          setMinWithdrawalAmount(effectiveMin);
          setMaxWithdrawalAmount(effectiveMax);
          setWithdrawalsAllowed(packageAllowsWithdrawals);
        } else {
          setMinWithdrawalAmount(0);
          setMaxWithdrawalAmount(0);
          setWithdrawalsAllowed(true);
        }
        setSettings(appSettings);
        setDeposits(depositHistory);
        if (!withdrawalResult.success) {
          throw new Error(withdrawalResult.message || 'Could not load withdrawal history.');
        }
        setWithdrawals((withdrawalResult.withdrawals || []) as WithdrawalRequest[]);
      } catch (error) {
        console.error("Failed to fetch wallet data:", error);
        const message = error instanceof Error ? error.message : 'Could not load wallet history.';
        setHistoryError(message);
        toast({ title: 'Wallet history unavailable', description: message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    }

  useEffect(() => {
    if (!authLoading && user) {
      fetchWalletData();
    }
  }, [user, authLoading]);

  if (loading || authLoading) {
      return <WalletPageLoadingSkeleton />;
  }
  
  if (!balances || !settings || !user) {
      return <p>Could not load wallet information.</p>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold font-headline">My Wallet</h1>
      <p className="text-muted-foreground mt-1">Manage your earnings and deposit balances.</p>

      <div className="grid gap-8 mt-8 md:grid-cols-3">
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-green-500/10 border border-green-500/20">
                    <Download className="h-6 w-6 text-green-600" />
                </div>
                <div>
                    <CardDescription>Earnings Balance</CardDescription>
                    <CardTitle className="text-4xl">${balances.earnings.toFixed(2)}</CardTitle>
                </div>
            </div>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-muted-foreground">This is the balance you've earned from completing contributions. You can withdraw these funds or use them to redeem rewards.</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => setIsRedeemDialogOpen(true)}>
              Redeem Earnings
            </Button>
          </CardFooter>
        </Card>
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-violet-500/20 bg-violet-500/10 p-3"><Gift className="h-6 w-6 text-violet-600" /></div>
              <div><CardDescription>Referral Balance</CardDescription><CardTitle className="text-4xl">${balances.referrals.toFixed(2)}</CardTitle></div>
            </div>
          </CardHeader>
          <CardContent className="flex-grow"><p className="text-muted-foreground">Referral bonuses credited from eligible deposits. Credited bonuses are included in your earnings balance.</p></CardContent>
        </Card>
        
        <Card className="flex flex-col bg-muted/50">
           <CardHeader>
            <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-blue-500/10 border border-blue-500/20">
                    <Upload className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                    <CardDescription>Deposit Balance</CardDescription>
                    <CardTitle className="text-4xl">${balances.deposits.toFixed(2)}</CardTitle>
                </div>
            </div>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-muted-foreground">This is the balance you've deposited into your account. Use these funds to purchase premium packages or features.</p>
          </CardContent>
          <CardFooter>
            <Button variant="secondary" onClick={() => setIsDepositDialogOpen(true)}>
              Make a Deposit
            </Button>
          </CardFooter>
        </Card>
      </div>
      <DepositDialog
        open={isDepositDialogOpen}
        onOpenChange={setIsDepositDialogOpen}
        settings={settings}
        userId={user.uid}
        onDeposit={fetchWalletData}
      />

      <Dialog open={isRedeemDialogOpen} onOpenChange={setIsRedeemDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Redeem Earnings</DialogTitle>
            <DialogDescription>Submit a withdrawal request from your earnings balance.</DialogDescription>
          </DialogHeader>
          <WithdrawalForm
            userId={user.uid}
            settings={settings}
            currentBalance={balances.earnings}
            minWithdrawalAmount={minWithdrawalAmount}
            maxWithdrawalAmount={maxWithdrawalAmount}
            withdrawalsAllowed={withdrawalsAllowed}
            onWithdrawal={() => {
              setIsRedeemDialogOpen(false);
              fetchWalletData();
            }}
          />
        </DialogContent>
      </Dialog>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Your recent deposits and withdrawals.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {historyError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {historyError}
              <Button type="button" variant="outline" size="sm" className="ml-3" onClick={fetchWalletData}>Try again</Button>
            </div>
          ) : deposits.length === 0 && withdrawals.length === 0 ? (
            <p className="text-muted-foreground">No transactions yet.</p>
          ) : (
            <div className="space-y-2">
              {[...
                deposits.map((deposit) => ({
                  id: `deposit-${deposit.id}`,
                  type: 'Deposit' as const,
                  amount: Number(deposit.amount || 0),
                  method: deposit.method || 'Deposit method',
                  status: deposit.status,
                  date: deposit.createdAt,
                })),
                ...withdrawals.map((withdrawal) => ({
                  id: `withdrawal-${withdrawal.id}`,
                  type: 'Withdrawal' as const,
                  amount: Number(withdrawal.amount || 0),
                  method: withdrawal.paymentMethod || 'Withdrawal method',
                  status: withdrawal.status,
                  date: withdrawal.requestedAt,
                })),
              ]
                .sort((a, b) => {
                  const timeA = typeof a.date?.toDate === 'function' ? a.date.toDate().getTime() : new Date(a.date || 0).getTime();
                  const timeB = typeof b.date?.toDate === 'function' ? b.date.toDate().getTime() : new Date(b.date || 0).getTime();
                  return timeB - timeA;
                })
                .map((tx, index) => (
                  <div key={`${tx.id}-${index}`} className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">{tx.type} • ${formatAmount(tx.amount)}</p>
                      <p className="text-sm text-muted-foreground">{tx.method} • {formatDate(tx.date)}</p>
                    </div>
                    <Badge className={getStatusClassName(tx.status)}>{tx.status}</Badge>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
