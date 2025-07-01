
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getTasks, getUserData, getPackage } from '@/lib/database';
import { ArrowRight, Award, CheckCircle, Repeat } from 'lucide-react';
import { Task, Package } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';

const StatCard = ({ title, value, icon: Icon, description }: { title: string; value: string | number; icon: React.ElementType; description: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold text-primary">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);

type UserStatsData = {
    points: number;
    completed: number;
    dailyCount: number;
    dailyLimit: number;
};

function UserStats({ stats, loading }: { stats: UserStatsData | null, loading: boolean}) {
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
                title="Total Points" 
                value={stats.points.toLocaleString()} 
                icon={Award}
                description="Points earned from all contributions."
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
  if (tasks.length === 0) {
    return (
      <Card className="mt-8">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No available contributions at the moment. Check back later!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 mt-8 sm:grid-cols-2 lg:grid-cols-3">
      {tasks.map((task) => (
        <Card key={task.id} className="flex flex-col">
          <CardHeader>
            <div className="flex justify-between items-start">
              <CardTitle>{task.title}</CardTitle>
              <Badge variant={task.difficulty === 'Easy' ? 'secondary' : task.difficulty === 'Medium' ? 'outline' : 'default'}
                className={task.difficulty === 'Hard' ? `bg-destructive/80 text-destructive-foreground` : ''}
              >
                {task.difficulty}
              </Badge>
            </div>
            <CardDescription>{task.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <div className="text-2xl font-bold text-primary">{task.points} Points</div>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href={`/tasks/${task.id}`}>Start Contribution <ArrowRight className="ml-2 h-4 w-4" /></Link>
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
                        <Skeleton className="h-4 w-full mt-2" />
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
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      setLoading(true);
      try {
        const [fetchedTasks, userData] = await Promise.all([
            getTasks(user.uid),
            getUserData(user.uid)
        ]);
        
        setTasks(fetchedTasks);

        if (userData) {
            let userPackage: Package | null = null;
            if (userData.packageId) {
                userPackage = await getPackage(userData.packageId);
            }
            
            const lastReset = userData.lastCompletionReset?.toDate() || new Date(0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const dailyCount = lastReset < today ? 0 : userData.dailyCompletedCount || 0;

            setUserStats({
                points: userData.points || 0,
                completed: userData.completedTasks?.length || 0,
                dailyCount: dailyCount,
                dailyLimit: userPackage?.taskLimit || FREE_TIER_DAILY_LIMIT,
            });
        }
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
    <div>
      <h1 className="text-3xl font-bold font-headline">Dashboard</h1>
      <p className="text-muted-foreground mt-1">An overview of your contributions and available tasks.</p>

      <div className="mt-8">
        <h2 className="text-2xl font-bold font-headline mb-4">Your Stats</h2>
        <UserStats stats={userStats} loading={loading} />
      </div>
      
      <div className="mt-12">
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
