"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getTasks } from '@/lib/database';
import { ArrowRight } from 'lucide-react';
import { Task } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';

function TaskGrid({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return (
      <Card className="mt-8">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No available tasks at the moment. Check back later!</p>
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
              <Link href={`/tasks/${task.id}`}>Start Task <ArrowRight className="ml-2 h-4 w-4" /></Link>
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
      <h1 className="text-3xl font-bold font-headline">Available Tasks</h1>
      <p className="text-muted-foreground mt-1">Select a task to complete and earn points.</p>
      {loading ? <LoadingTaskGridSkeleton /> : <TaskGrid tasks={tasks} />}
    </div>
  );
}
