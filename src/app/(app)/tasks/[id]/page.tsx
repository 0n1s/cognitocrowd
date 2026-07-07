
"use client";

import { useEffect, useState } from 'react';
import { getPackage, getTask, getUserData, getUserTaskResponses } from "@/lib/database";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskForms } from "./task-forms";
import type { Package, Task } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const FREE_TIER_DAILY_LIMIT = 50;

function toDate(value: unknown): Date {
  if (!value) return new Date(0);
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date(0);
}

function LoadingSkeleton() {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start mb-2">
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-6 w-20" />
                </div>
                <Skeleton className="h-7 w-24" />
                <div className="pt-2 space-y-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-2/3" />
                </div>
            </CardHeader>
            <CardContent>
              <div className="mt-6 pt-6 border-t">
                <Skeleton className="h-8 w-1/4 mb-4" />
                <Skeleton className="h-20 w-full" />
              </div>
            </CardContent>
        </Card>
      </div>
    )
}

export default function TaskPage() {
  const params = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    async function fetchTaskAndCheckCompletion() {
      if (!params.id || !user) return;
      
      try {
        const userData = await getUserData(user.uid);
        if (!userData) {
          toast({ title: "Contribution unavailable", description: "User profile not found." });
          router.push('/dashboard');
          return;
        }

        let packageLimit = FREE_TIER_DAILY_LIMIT;
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
          router.push('/dashboard?dailyLimitReached=1');
          return;
        }

        if (userData?.completedTasks?.includes(params.id)) {
            toast({ title: "Contribution unavailable", description: "You have already completed this contribution." });
            router.push('/dashboard');
            return;
        }

        const priorResponses = await getUserTaskResponses(user.uid);
        if (priorResponses.some((response) => response.taskId === params.id)) {
            toast({ title: "Contribution unavailable", description: "You have already completed this contribution." });
            router.push('/dashboard');
            return;
        }

        const fetchedTask = await getTask(params.id);
        if (!fetchedTask) {
          toast({ title: "Contribution unavailable", description: "This contribution no longer exists." });
          router.push('/dashboard');
        } else {
          setTask(fetchedTask);
        }
      } catch (error) {
        console.error("Failed to fetch task:", error);
        toast({ title: "Error", description: "Failed to load contribution.", variant: "destructive" });
        router.push('/dashboard');
      } finally {
        setLoading(false);
      }
    }
    
    if (!authLoading) {
        fetchTaskAndCheckCompletion();
    }
  }, [params.id, user, authLoading, router, toast]);

  if (loading || authLoading) {
      return <LoadingSkeleton />;
  }
  
  if (!task) {
      return null;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start mb-2">
            <CardTitle className="text-3xl font-headline">{task.title}</CardTitle>
            <Badge variant={task.difficulty === 'Easy' ? 'secondary' : task.difficulty === 'Medium' ? 'outline' : 'default'}
              className={cn(
                'px-1.5 py-0 text-xxs',
                task.difficulty === 'Hard' && 'bg-destructive/80 text-destructive-foreground'
              )}
            >
              {task.difficulty}
            </Badge>
          </div>
          <p className="text-xl font-semibold text-primary">${(task.points / 100).toFixed(2)}</p>
          <CardDescription className="text-base pt-2">{task.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <TaskForms task={task} />
        </CardContent>
      </Card>
    </div>
  );
}
