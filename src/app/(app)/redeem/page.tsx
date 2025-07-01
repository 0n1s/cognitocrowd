"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { mockRewards } from '@/lib/data';
import { useAuth } from '@/hooks/use-auth';
import { getUserData } from '@/lib/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Reward } from '@/lib/types';

function RedeemPageLoadingSkeleton() {
    return (
        <div>
            <h1 className="text-3xl font-bold font-headline">Redeem Rewards</h1>
            <p className="text-muted-foreground mt-1">Use your points to claim exciting rewards.</p>
            <div className="mt-4">
                <Skeleton className="h-7 w-48" />
            </div>
             <div className="grid gap-6 mt-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                <Card key={i} className="flex flex-col">
                    <CardHeader className="p-0">
                        <Skeleton className="rounded-t-lg aspect-[3/2] w-full" />
                    </CardHeader>
                    <div className="p-6 flex flex-col flex-grow">
                        <Skeleton className="h-6 w-3/4 mb-2" />
                        <Skeleton className="h-10 w-full mb-4" />
                        <div className="flex-grow" />
                        <Skeleton className="h-8 w-1/2 mt-4" />
                    </div>
                    <CardFooter>
                        <Skeleton className="h-10 w-full" />
                    </CardFooter>
                </Card>
                ))}
            </div>
        </div>
    )
}

export default function RedeemPage() {
  const { user, loading: authLoading } = useAuth();
  const [userPoints, setUserPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const rewards: Reward[] = mockRewards; 

  useEffect(() => {
    async function fetchUserData() {
      if (!user) {
          setLoading(false);
          return;
      };
      try {
        const userData = await getUserData(user.uid);
        if (userData) {
          setUserPoints(userData.points || 0);
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      fetchUserData();
    }
  }, [user, authLoading]);

  if (loading || authLoading) {
    return <RedeemPageLoadingSkeleton />;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold font-headline">Redeem Rewards</h1>
      <p className="text-muted-foreground mt-1">Use your points to claim exciting rewards.</p>
      <div className="mt-4 text-lg">Your Balance: <span className="font-bold text-primary">{userPoints.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span></div>
      <p className="text-xs text-muted-foreground mt-1">(1 point = $1.00 USD)</p>

      <div className="grid gap-6 mt-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
            <div className="p-6 flex flex-col flex-grow">
                <CardTitle>{reward.name}</CardTitle>
                <CardDescription className="mt-2 flex-grow">{reward.description}</CardDescription>
                <div className="mt-4">
                    <p className="text-2xl font-bold text-primary">{reward.cost.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
                </div>
            </div>
            <CardFooter>
              <Button className="w-full" disabled={userPoints < reward.cost}>
                Redeem
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
