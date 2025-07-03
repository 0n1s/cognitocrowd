
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getTasks } from '@/lib/database';
import { ArrowRight } from 'lucide-react';
import { Task } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

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
          <CardHeader className="flex-grow">
            <div className="flex justify-between items-start">
              <CardTitle className="text-lg truncate">{task.title}</CardTitle>
              <Badge variant={task.difficulty === 'Easy' ? 'secondary' : task.difficulty === 'Medium' ? 'outline' : 'default'}
                className={cn(
                  'px-1.5 py-0 text-xxs',
                  task.difficulty === 'Hard' && 'bg-destructive/80 text-destructive-foreground'
                )}
              >
                {task.difficulty}
              </Badge>
            </div>
          </CardHeader>
          <CardFooter>
            <Button asChild size="sm" className="w-full">
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
            {[...Array(6)].map((_, i) => (
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

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      setLoading(true);
      try {
        const fetchedTasks = await getTasks(user.uid);
        setTasks(fetchedTasks);
      } catch (error) {
        console.error("Failed to fetch tasks:", error);
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
      <h1 className="text-3xl font-bold font-headline">Available Contributions</h1>
      <p className="text-muted-foreground mt-1">Select a contribution to complete and earn points.</p>
      {loading ? <LoadingTaskGridSkeleton /> : <TaskGrid tasks={tasks} />}
    </div>
  );
}
