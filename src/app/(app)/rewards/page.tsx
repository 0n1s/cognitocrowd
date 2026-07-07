
"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Award } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { getUserData, getCompletedTaskDetails, getUserTaskResponses } from '@/lib/database';
import { Task, TaskResponse } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

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
  const [taskResponses, setTaskResponses] = useState<TaskResponse[]>([]);
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
                    const [taskDetails, responses] = await Promise.all([
                        getCompletedTaskDetails(userData.completedTasks),
                        getUserTaskResponses(user.uid),
                    ]);
                    setCompletedTasks(taskDetails);
                    setTaskResponses(responses);
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

  const responsesByTaskId = new Map(taskResponses.map((response) => [response.taskId, response]));
  const totalAwarded = taskResponses.reduce((total, response) => total + Number(response.pointsEarned || 0), 0) / 100;

  return (
    <div>
      <h1 className="text-3xl font-bold font-headline">My Rewards</h1>
      <p className="text-muted-foreground mt-1">Track your earnings and contribution history.</p>

      <div className="grid gap-6 mt-8 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Available Earnings</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">${earningsBalance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Your current earnings balance</p>
          </CardContent>
        </Card>
        <Card className="md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Awarded</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">${totalAwarded.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Actual rewards from recorded submissions</p>
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
                <TableHead>AI Review</TableHead>
                <TableHead className="text-right">Maximum</TableHead>
                <TableHead className="text-right">Actual Earned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completedTasks.length > 0 ? (
                completedTasks.map((task) => {
                  const response = responsesByTaskId.get(task.id);
                  return (
                      <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>{task.type}</TableCell>
                      <TableCell>
                        {typeof response?.scorePercent === 'number' ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{response.scorePercent}% accuracy</Badge>
                            {typeof response.rank === 'number' && <span className="text-xs text-muted-foreground">Rank {response.rank}/10</span>}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not AI reviewed</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">${((response?.maxPoints ?? task.points) / 100).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {response ? `+$${(Number(response.pointsEarned || 0) / 100).toFixed(2)}` : 'Unavailable'}
                      </TableCell>
                      </TableRow>
                  );
                })
              ) : (
                <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
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
