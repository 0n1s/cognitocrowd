
"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { getUserData, getAppSettings, getUserWithdrawalRequests } from '@/lib/database';
import { Skeleton } from '@/components/ui/skeleton';
import { AppSettings, WithdrawalRequest } from '@/lib/types';
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
                <div className="md:col-span-1">
                    <Skeleton className="h-96 w-full" />
                </div>
                <div className="md:col-span-2">
                     <Skeleton className="h-96 w-full" />
                </div>
             </div>
        </div>
    )
}

function WithdrawalHistory({ requests }: { requests: WithdrawalRequest[] }) {
    if (requests.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Withdrawal History</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-center text-muted-foreground py-12">You have no withdrawal history.</p>
                </CardContent>
            </Card>
        );
    }
    
    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'N/A';
        if (typeof timestamp === 'string') {
            return new Date(timestamp).toLocaleDateString();
        }
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
  const [earningsBalance, setEarningsBalance] = useState(0);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPageData = async () => {
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
        setEarningsBalance(userData.earningsBalance || 0);
      }
      setSettings(appSettings);
      setRequests(withdrawalRequests);

    } catch (error) {
      console.error("Failed to fetch redeem page data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchPageData();
    }
  }, [user, authLoading]);

  if (loading || authLoading) {
    return <RedeemPageLoadingSkeleton />;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold font-headline">Withdraw Earnings</h1>
      <p className="text-muted-foreground mt-1">Request a withdrawal of your available earnings balance.</p>
      <div className="mt-4 text-lg">Your Earnings Balance: <span className="font-bold text-primary">${earningsBalance.toFixed(2)}</span></div>
      <p className="text-xs text-muted-foreground mt-1">(1 point from contributions = $1.00 USD)</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
            <div className="md:col-span-1">
                {user && settings && (
                    <WithdrawalForm 
                        user={user} 
                        settings={settings} 
                        currentBalance={earningsBalance}
                        onWithdrawal={fetchPageData}
                    />
                )}
            </div>
            <div className="md:col-span-2">
                <WithdrawalHistory requests={requests} />
            </div>
        </div>
    </div>
  );
}
