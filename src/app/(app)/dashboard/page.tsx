
"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getTasks, getUserData, getPackage } from '@/lib/database';
import { ArrowRight, Award, CheckCircle, Repeat, Sparkles, Wallet, Target } from 'lucide-react';
import { Task, Package, User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { DailyLimitPopup } from '@/components/daily-limit-popup';
import { Progress } from '@/components/ui/progress';
import { useDisplayCurrency } from '@/hooks/use-display-currency';

const StatCard = ({ title, value, icon: Icon, description }: { title: string; value: string | number; icon: React.ElementType; description: string }) => {
  return (
    <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="rounded-md border border-primary/20 bg-primary/10 p-1.5">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-primary">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
};

type UserStatsData = {
    earningsBalance: number;
    completed: number;
    dailyCount: number;
    dailyLimit: number;
  expertise: string[];
};

type ServerTimeResponse = {
  serverTimeIso: string;
  processingTimeZone?: string;
};

type ServerClockState = {
  serverEpochMs: number;
  syncedAtMs: number;
  processingTimeZone: string;
};

function UserStats({ stats, loading }: { stats: UserStatsData | null, loading: boolean}) {
  const { formatAmount } = useDisplayCurrency();

    if (loading) {
        return (
            <div className="grid gap-4 md:grid-cols-3">
                <Skeleton className="h-[100px]" />
                <Skeleton className="h-[100px]" />
                <Skeleton className="h-[100px]" />
            </div>
        )
    }

    if (!stats) return null;

    return (
        <div className="grid gap-4 md:grid-cols-3">
            <StatCard 
                title="Earnings Balance" 
            value={formatAmount(stats.earningsBalance, 'USD')}
                icon={Award}
                description="Balance earned from all contributions."
            />
            <StatCard 
                title="Contributions Completed" 
                value={stats.completed} 
                icon={CheckCircle}
                description="Total number of contributions you've submitted."
            />
            <StatCard
                title="Today's Progress"
                value={`${stats.dailyCount} / ${stats.dailyLimit}`}
                icon={Repeat}
                description="Contributions submitted today. Resets daily."
            />
        </div>
    )
}

function TaskGrid({ tasks }: { tasks: Task[] }) {
  const { formatAmount } = useDisplayCurrency();
  
  if (tasks.length === 0) {
    return (
      <Card className="mt-8">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Target className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-base font-medium">No available contributions at the moment.</p>
          <p className="text-sm text-muted-foreground mt-1">Check back later for fresh opportunities.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 mt-8 sm:grid-cols-2 lg:grid-cols-3">
      {tasks.map((task) => (
        <Card key={task.id} className="group flex flex-col overflow-hidden border-border/60 transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <div className="h-1 w-full bg-gradient-to-r from-primary/80 to-primary/20" />
          <CardHeader className="flex-grow space-y-3">
            <div className="flex justify-between items-start gap-2">
              <CardTitle className="text-lg leading-tight">
                {task.title.length > 25
                  ? `${task.title.substring(0, 25)}...`
                  : task.title}
              </CardTitle>
              <Badge variant={task.difficulty === 'Easy' ? 'secondary' : task.difficulty === 'Medium' ? 'outline' : 'default'}
                className={cn(
                  'px-1.5 py-0 text-xxs',
                  task.difficulty === 'Hard' && 'bg-destructive/80 text-destructive-foreground'
                )}
              >
                {task.difficulty}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-3 min-h-[60px]">
              {task.description || 'No description provided for this contribution.'}
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Reward</span>
              <span className="font-semibold text-primary">{formatAmount(task.points / 100, 'USD')}</span>
            </div>
          </CardHeader>
          <CardFooter>
            <Button asChild size="sm" className="w-full">
              <Link href={`/tasks/${task.id}`}>Open Contribution <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function LoadingTaskGridSkeleton() {
    return (
        <div className="grid gap-6 mt-8 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
                <Card key={i}>
                    <CardHeader>
                        <Skeleton className="h-6 w-3/4" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-8 w-1/2" />
                    </CardContent>
                    <CardFooter>
                        <Skeleton className="h-10 w-full" />
                    </CardFooter>
                </Card>
            ))}
        </div>
    )
}

const FREE_TIER_DAILY_LIMIT = 50;

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userStats, setUserStats] = useState<UserStatsData | null>(null);
  const [serverClock, setServerClock] = useState<ServerClockState | null>(null);
  const [clockTick, setClockTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const progressPercent = useMemo(() => {
    if (!userStats || userStats.dailyLimit <= 0) return 0;
    return Math.min(100, Math.round((userStats.dailyCount / userStats.dailyLimit) * 100));
  }, [userStats]);

  const liveServerTimeLabel = useMemo(() => {
    if (!serverClock) return 'Loading...';
    const elapsedMs = Date.now() - serverClock.syncedAtMs;
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'short',
      timeStyle: 'medium',
      timeZone: serverClock.processingTimeZone,
    }).format(new Date(serverClock.serverEpochMs + elapsedMs));
  }, [serverClock, clockTick]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setClockTick((value) => value + 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const fetchServerTime = async () => {
      try {
        const response = await fetch('/api/server-time', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as ServerTimeResponse;
        if (isMounted && payload?.serverTimeIso) {
          const parsedServerMs = Date.parse(payload.serverTimeIso);
          if (!Number.isNaN(parsedServerMs)) {
            setServerClock({
              serverEpochMs: parsedServerMs,
              syncedAtMs: Date.now(),
              processingTimeZone: String(payload.processingTimeZone || 'UTC').trim() || 'UTC',
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch server time:', error);
      }
    };

    fetchServerTime();
    intervalId = setInterval(fetchServerTime, 30000);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      setLoading(true);
      try {
        const [fetchedTasks, fetchedUserData] = await Promise.all([
            getTasks(user.uid),
            getUserData(user.uid),
        ]);

        let packageTaskLimit = FREE_TIER_DAILY_LIMIT;

        if (fetchedUserData) {
            let userPackage: Package | null = null;
            if (fetchedUserData.packageId) {
                userPackage = await getPackage(fetchedUserData.packageId);
            }

          packageTaskLimit = userPackage?.taskLimit || FREE_TIER_DAILY_LIMIT;
            
            const lastReset = fetchedUserData.lastCompletionReset ? new Date(fetchedUserData.lastCompletionReset) : new Date(0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const dailyCount = lastReset < today ? 0 : fetchedUserData.dailyCompletedCount || 0;

            setUserStats({
                earningsBalance: fetchedUserData.earningsBalance || 0,
                completed: fetchedUserData.completedTasks?.length || 0,
                dailyCount: dailyCount,
                dailyLimit: packageTaskLimit,
              expertise: fetchedUserData.expertise || [],
            });
        }

        setTasks(fetchedTasks.slice(0, packageTaskLimit));
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    
    if (user) {
        fetchData();
    }
  }, [user]);

  return (
    <div className="space-y-8">
      <DailyLimitPopup />
      <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Contributor Hub
            </div>
            <h1 className="text-3xl font-bold font-headline">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Track your progress, monitor rewards, and jump into high-value tasks.</p>
            <p className="text-xs text-muted-foreground mt-2">
              Server time: {liveServerTimeLabel}{serverClock ? ` (${serverClock.processingTimeZone})` : ''}
            </p>
          </div>

          <div className="w-full max-w-sm rounded-xl border border-border/60 bg-card/80 p-4">
            <p className="text-sm uppercase tracking-wide text-muted-foreground">Daily contribution usage</p>
            <p className="mt-1 text-lg font-semibold">{userStats ? `${userStats.dailyCount} / ${userStats.dailyLimit}` : '0 / 0'}</p>
            <Progress value={progressPercent} className="mt-3 h-2" />
            <p className="mt-2 text-sm text-muted-foreground">{progressPercent}% used today</p>
          </div>
        </div>
      </section>
      
      <div>
        <h2 className="text-2xl font-bold font-headline mb-4">Your Stats</h2>
        <UserStats stats={userStats} loading={loading} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/60 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Wallet Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="rounded-md border border-primary/20 bg-primary/10 p-2">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Your current earnings are shown above and update after each approved contribution.</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Fast Action</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">Browse the full task board and start contributing right away.</p>
            <Button asChild>
              <Link href="/tasks">Go to Tasks <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">My Skills / Specialty</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {userStats?.expertise && userStats.expertise.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {userStats.expertise.slice(0, 4).map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                ))}
                {userStats.expertise.length > 4 ? (
                  <Badge variant="outline" className="text-xs">+{userStats.expertise.length - 4} more</Badge>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No specialty selected yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div>
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-bold font-headline">Available Contributions</h2>
                <p className="text-muted-foreground mt-1">A preview of the latest contributions available.</p>
            </div>
            <Button asChild variant="outline">
                <Link href="/tasks">View All Contributions <ArrowRight className="ml-2 h-4 w-4"/></Link>
            </Button>
        </div>
        {loading ? <LoadingTaskGridSkeleton /> : <TaskGrid tasks={tasks.slice(0, 3)} />}
      </div>
    </div>
  );
}
