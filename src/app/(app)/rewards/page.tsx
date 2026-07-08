
"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { getUserData, getCompletedTaskDetails, getUserTaskResponses } from '@/lib/database';
import { Task, TaskResponse } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useDisplayCurrency } from '@/hooks/use-display-currency';

type RewardsDatePreset = 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'this_year';

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
  const { formatAmount } = useDisplayCurrency();
  const { user, loading: authLoading } = useAuth();
  const [earningsBalance, setEarningsBalance] = useState(0);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [taskResponses, setTaskResponses] = useState<TaskResponse[]>([]);
  const [datePreset, setDatePreset] = useState<RewardsDatePreset>('all');
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

  const getResponseDate = (response?: TaskResponse) => {
    const raw = response?.submittedAt;
    if (!raw) {
      return null;
    }

    if (typeof raw?.toDate === 'function') {
      return raw.toDate() as Date;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getPresetBoundaries = (preset: RewardsDatePreset) => {
    const now = new Date();

    if (preset === 'all') {
      return { start: null as Date | null, end: null as Date | null };
    }

    if (preset === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start, end };
    }

    if (preset === 'yesterday') {
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      return { start, end };
    }

    if (preset === 'this_week') {
      const day = now.getDay();
      const daysSinceMonday = (day + 6) % 7;
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start, end };
    }

    if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start, end };
    }

    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end };
  };

  const { start: startBoundary, end: endBoundary } = getPresetBoundaries(datePreset);

  const filteredTasks = completedTasks.filter((task) => {
    if (!startBoundary && !endBoundary) {
      return true;
    }

    const responseDate = getResponseDate(responsesByTaskId.get(task.id));
    if (!responseDate) {
      return false;
    }

    if (startBoundary && responseDate < startBoundary) {
      return false;
    }

    if (endBoundary && responseDate > endBoundary) {
      return false;
    }

    return true;
  });

  const filteredResponses = filteredTasks
    .map((task) => responsesByTaskId.get(task.id))
    .filter((response): response is TaskResponse => Boolean(response));

  const totalAwarded = filteredResponses.reduce((total, response) => total + Number(response.pointsEarned || 0), 0) / 100;

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
            <div className="text-4xl font-bold text-primary">{formatAmount(earningsBalance, 'USD')}</div>
            <p className="text-xs text-muted-foreground mt-1">Your current earnings balance</p>
          </CardContent>
        </Card>
        <Card className="md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Awarded</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{formatAmount(totalAwarded, 'USD')}</div>
            <p className="text-xs text-muted-foreground mt-1">Actual rewards from recorded submissions</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Contribution History</CardTitle>
          <CardDescription>A log of all the contributions you have completed.</CardDescription>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant={datePreset === 'today' ? 'default' : 'outline'} size="sm" onClick={() => setDatePreset('today')}>Today</Button>
            <Button variant={datePreset === 'yesterday' ? 'default' : 'outline'} size="sm" onClick={() => setDatePreset('yesterday')}>Yesterday</Button>
            <Button variant={datePreset === 'this_week' ? 'default' : 'outline'} size="sm" onClick={() => setDatePreset('this_week')}>This Week</Button>
            <Button variant={datePreset === 'this_month' ? 'default' : 'outline'} size="sm" onClick={() => setDatePreset('this_month')}>This Month</Button>
            <Button variant={datePreset === 'this_year' ? 'default' : 'outline'} size="sm" onClick={() => setDatePreset('this_year')}>This Year</Button>
            <Button variant={datePreset === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setDatePreset('all')}>All Time</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contribution</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>AI Review</TableHead>
                <TableHead className="text-right">Maximum</TableHead>
                <TableHead className="text-right">Actual Earned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.length > 0 ? (
                filteredTasks.map((task) => {
                  const response = responsesByTaskId.get(task.id);
                  const responseDate = getResponseDate(response);
                  return (
                      <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>{task.type}</TableCell>
                      <TableCell>{responseDate ? responseDate.toLocaleDateString() : 'N/A'}</TableCell>
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
                      <TableCell className="text-right text-muted-foreground">{formatAmount((response?.maxPoints ?? task.points) / 100, 'USD')}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {response ? `+${formatAmount((Number(response.pointsEarned || 0) / 100), 'USD')}` : 'Unavailable'}
                      </TableCell>
                      </TableRow>
                  );
                })
              ) : (
                <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                        {completedTasks.length > 0 ? 'No contributions match the selected date range.' : "You haven't completed any contributions yet."}
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
