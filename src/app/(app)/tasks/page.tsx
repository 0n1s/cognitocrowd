
"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getPackage, getTasks, getUserData } from '@/lib/database';
import { ArrowRight, Search, Sparkles, Target } from 'lucide-react';
import { Package, Task } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { useDisplayCurrency } from '@/hooks/use-display-currency';

const FREE_TIER_DAILY_LIMIT = 50;

function toDate(value: unknown): Date {
  if (!value) return new Date(0);
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date(0);
}

function TaskGrid({ tasks, hasFilters }: { tasks: Task[]; hasFilters: boolean }) {
  const { formatAmount } = useDisplayCurrency();

  if (tasks.length === 0) {
    return (
      <Card className="mt-8">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Target className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-base font-medium">
            {hasFilters ? 'No contributions match your current filters.' : 'No available contributions at the moment.'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {hasFilters ? 'Try changing search text or difficulty.' : 'Check back later for fresh opportunities.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 mt-8 sm:grid-cols-2 xl:grid-cols-3">
      {tasks.map((task) => (
        <Card key={task.id} className="group flex flex-col overflow-hidden border-border/60 transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <div className="h-1 w-full bg-gradient-to-r from-primary/80 to-primary/20" />
          <CardHeader className="flex-grow space-y-3">
            <div className="flex items-start justify-between gap-2">
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
          <CardFooter className="pt-0">
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
    <div className="grid gap-6 mt-8 sm:grid-cols-2 xl:grid-cols-3">
            {[...Array(6)].map((_, i) => (
                <Card key={i}>
          <div className="h-1 w-full bg-muted" />
                    <CardHeader>
                        <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
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

export default function TasksPage() {
  const { formatAmount } = useDisplayCurrency();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'All' | 'Easy' | 'Medium' | 'Hard'>('All');
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      setLoading(true);
      try {
        let packageLimit = FREE_TIER_DAILY_LIMIT;
        const userData = await getUserData(user.uid);
        if (userData) {
          if (userData.packageId) {
            const pkg: Package | null = await getPackage(userData.packageId);
            if (pkg && typeof pkg.taskLimit === 'number') {
              packageLimit = pkg.taskLimit;
            }
          }

          let dailyCount = userData.dailyCompletedCount || 0;
          const lastReset = toDate(userData.lastCompletionReset);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (lastReset < today) {
            dailyCount = 0;
          }

          if (dailyCount >= packageLimit) {
            router.replace('/dashboard?dailyLimitReached=1');
            return;
          }
        }

        const fetchedTasks = await getTasks(user.uid);
        setTasks(fetchedTasks.slice(0, packageLimit));
      } catch (error) {
        console.error("Failed to fetch tasks:", error);
      } finally {
        setLoading(false);
      }
    }
    
    if (user) {
        fetchData();
    }
  }, [user, router]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesDifficulty = difficultyFilter === 'All' || task.difficulty === difficultyFilter;
      const haystack = `${task.title} ${task.description || ''}`.toLowerCase();
      const matchesSearch = haystack.includes(searchTerm.trim().toLowerCase());
      return matchesDifficulty && matchesSearch;
    });
  }, [tasks, searchTerm, difficultyFilter]);

  const averageReward = useMemo(() => {
    if (tasks.length === 0) return 0;
    const total = tasks.reduce((sum, task) => sum + task.points, 0);
    return total / tasks.length / 100;
  }, [tasks]);

  const hasFilters = searchTerm.trim().length > 0 || difficultyFilter !== 'All';

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Contribution Marketplace
            </div>
            <h1 className="text-3xl font-bold font-headline">Available Contributions</h1>
            <p className="text-muted-foreground mt-1">Find the best-fit tasks, complete them fast, and grow your earnings.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:min-w-[320px]">
            <Card className="border-border/50 bg-background/80">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Open Tasks</p>
                <p className="text-xl font-semibold">{tasks.length}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-background/80">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Avg Reward</p>
                <p className="text-xl font-semibold">{formatAmount(averageReward, 'USD')}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border/60 bg-card/70 p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search contributions by title or description"
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            {(['All', 'Easy', 'Medium', 'Hard'] as const).map((level) => (
              <Button
                key={level}
                type="button"
                size="sm"
                variant={difficultyFilter === level ? 'default' : 'outline'}
                onClick={() => setDifficultyFilter(level)}
              >
                {level}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {loading ? <LoadingTaskGridSkeleton /> : <TaskGrid tasks={filteredTasks} hasFilters={hasFilters} />}
    </div>
  );
}
