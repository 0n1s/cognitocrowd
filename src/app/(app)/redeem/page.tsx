"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { mockRewards } from '@/lib/data';
import { useAuth } from '@/hooks/use-auth';
import { getUserData, getAppSettings, getUserWithdrawalRequests } from '@/lib/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Reward, AppSettings, WithdrawalRequest } from '@/lib/types';
import { WithdrawalForm } from './withdrawal-form';

const statusColors: Record<WithdrawalRequest['status'], string> = {
  pending: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  completed: "bg-green-500/20 text-green-700 border-green-500/30",
  failed: "bg-red-500/20 text-red-700 border-red-500/30",
};


function RedeemPageLoadingSkeleton() {
    return (
        <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-5 w-80" />
            <div className="mt-4">
                <Skeleton className="h-7 w-48" />
            </div>
             <div className="grid gap-8 mt-8 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <Skeleton className="h-96 w-full" />
                </div>
                <div>
                     <Skeleton className="h-64 w-full" />
                </div>
             </div>
        </div>
    )
}

function WithdrawalHistory({ requests }: { requests: WithdrawalRequest[] }) {
    if (requests.length === 0) {
        return (
            <p className="text-sm text-center text-muted-foreground mt-4">You have no withdrawal history.</p>
        );
    }
    
    const formatDate = (timestamp: any) => {
        if (timestamp && typeof timestamp.toDate === 'function') {
            return timestamp.toDate().toLocaleDateString();
        }
        return 'N/A';
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Withdrawal History</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {requests.map(req => (
                            <TableRow key={req.id}>
                                <TableCell>{formatDate(req.requestedAt)}</TableCell>
                                <TableCell>${req.amount.toFixed(2)}</TableCell>
                                <TableCell>{req.paymentMethod}</TableCell>
                                <TableCell>
                                    <Badge className={statusColors[req.status]}>{req.status}</Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

export default function RedeemPage() {
  const { user, loading: authLoading } = useAuth();
  const [userPoints, setUserPoints] = useState(0);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const rewards: Reward[] = mockRewards; 

  useEffect(() => {
    async function fetchPageData() {
      if (!user) {
          setLoading(false);
          return;
      };
      try {
        const [userData, appSettings, withdrawalRequests] = await Promise.all([
          getUserData(user.uid),
          getAppSettings(),
          getUserWithdrawalRequests(user.uid)
        ]);
        
        if (userData) {
          setUserPoints(userData.points || 0);
        }
        setSettings(appSettings);
        setRequests(withdrawalRequests);

      } catch (error) {
        console.error("Failed to fetch redeem page data:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      fetchPageData();
    }
  }, [user, authLoading]);

  const refreshData = async () => {
    if (!user) return;
    const [userData, withdrawalRequests] = await Promise.all([
        getUserData(user.uid),
        getUserWithdrawalRequests(user.uid)
    ]);
    if (userData) setUserPoints(userData.points || 0);
    setRequests(withdrawalRequests);
  };

  if (loading || authLoading) {
    return <RedeemPageLoadingSkeleton />;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold font-headline">Redeem & Withdraw</h1>
      <p className="text-muted-foreground mt-1">Use your points to claim rewards or withdraw your earnings.</p>
      <div className="mt-4 text-lg">Your Balance: <span className="font-bold text-primary">${userPoints.toFixed(2)}</span></div>
      <p className="text-xs text-muted-foreground mt-1">(1 point = $1.00 USD)</p>

        <div className="grid gap-8 mt-8 lg:grid-cols-5">
            <div className="lg:col-span-3 space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Redeem Gift Cards</CardTitle>
                        <CardDescription>Instantly claim gift cards with your points.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6 sm:grid-cols-2">
                        {rewards.map((reward) => (
                        <Card key={reward.id} className="flex flex-col">
                            <CardHeader className="p-0">
                            <Image
                                src={reward.image}
                                alt={reward.name}
                                width={600}
                                height={400}
                                className="rounded-t-lg object-cover aspect-[3/2]"
                                data-ai-hint="gift card"
                            />
                            </CardHeader>
                            <div className="p-4 flex flex-col flex-grow">
                                <CardTitle className="text-base">{reward.name}</CardTitle>
                                <div className="mt-2 flex-grow">
                                     <p className="text-lg font-bold text-primary">${reward.cost.toFixed(2)}</p>
                                </div>
                            </div>
                            <CardFooter className="p-2">
                            <Button className="w-full" disabled={userPoints < reward.cost}>
                                Redeem
                            </Button>
                            </CardFooter>
                        </Card>
                        ))}
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-2 space-y-8">
                {user && settings && (
                    <WithdrawalForm 
                        user={user} 
                        settings={settings} 
                        currentPoints={userPoints}
                        onWithdrawal={refreshData}
                    />
                )}
                <WithdrawalHistory requests={requests} />
            </div>
        </div>
    </div>
  );
}
