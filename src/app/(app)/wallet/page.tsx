
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getUserData } from '@/lib/database';
import { ArrowRight, DollarSign, Download, Upload } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';

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
  const [balances, setBalances] = useState<{ earnings: number; deposits: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    async function fetchWalletData() {
      if (!user) {
        setLoading(false);
        return;
      };
      
      try {
        const userData = await getUserData(user.uid);
        if (userData) {
          setBalances({
            earnings: userData.earningsBalance || 0,
            deposits: userData.depositBalance || 0,
          });
        }
      } catch (error) {
        console.error("Failed to fetch wallet data:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      fetchWalletData();
    }
  }, [user, authLoading]);

  if (loading || authLoading) {
      return <WalletPageLoadingSkeleton />;
  }
  
  if (!balances) {
      return <p>Could not load wallet information.</p>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold font-headline">My Wallet</h1>
      <p className="text-muted-foreground mt-1">Manage your earnings and deposit balances.</p>

      <div className="grid gap-8 mt-8 md:grid-cols-2">
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
            <Button asChild>
              <Link href="/redeem">Withdraw or Redeem <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardFooter>
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
            <Button variant="secondary">
              Make a Deposit
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
