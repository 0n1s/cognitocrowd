
"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Award } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { getUserData, getCompletedTaskDetails } from '@/lib/database';
import { Task } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

function RewardsPageLoadingSkeleton() {
    return (
        <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-5 w-80 mb-8" />
            <div className="grid gap-6 md:grid-cols-3">
                <Skeleton className="md:col-span-1 h-28" />
            </div>
            <div className="mt-8">
                <Skeleton className="h-96 w-full" />
            </div>
        </div>
    )
}

export default function RewardsPage() {
  const { user, loading: authLoading } = useAuth();
  const [earningsBalance, setEarningsBalance] = useState(0);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPageData() {
        if (!user) {
            setLoading(false);
            return;
        }
        try {
            const userData = await getUserData(user.uid);
            if (userData) {
                setEarningsBalance(userData.earningsBalance || 0);
                if (userData.completedTasks && userData.completedTasks.length > 0) {
                    const taskDetails = await getCompletedTaskDetails(userData.completedTasks);
                    setCompletedTasks(taskDetails);
                }
            }
        } catch (error) {
            console.error("Failed to fetch rewards page data:", error);
        } finally {
            setLoading(false);
        }
    }

    if (!authLoading) {
        fetchPageData();
    }
  }, [user, authLoading]);

  if (loading || authLoading) {
      return <RewardsPageLoadingSkeleton />;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold font-headline">My Rewards</h1>
      <p className="text-muted-foreground mt-1">Track your earnings and contribution history.</p>

      <div className="grid gap-6 mt-8 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">${earningsBalance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Your current earnings balance</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Contribution History</CardTitle>
          <CardDescription>A log of all the contributions you have completed.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contribution</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Points Earned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completedTasks.length > 0 ? (
                completedTasks.map((task) => (
                    <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell>{task.type}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">+{task.points}</TableCell>
                    </TableRow>
                ))
              ) : (
                <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
                        You haven't completed any contributions yet.
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
