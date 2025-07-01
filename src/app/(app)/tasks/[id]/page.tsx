"use client";

import { useEffect, useState } from 'react';
import { getTask, getUserData } from "@/lib/database";
import { notFound, useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskForms } from "./task-forms";
import type { Task } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

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
        if (userData?.completedTasks?.includes(params.id)) {
            toast({ title: "Contribution unavailable", description: "You have already completed this contribution." });
            router.push('/dashboard');
            return;
        }

        const fetchedTask = await getTask(params.id);
        if (!fetchedTask) {
          notFound();
        } else {
          setTask(fetchedTask);
        }
      } catch (error) {
        console.error("Failed to fetch task:", error);
        notFound();
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
      return notFound();
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start mb-2">
            <CardTitle className="text-3xl font-headline">{task.title}</CardTitle>
            <Badge variant={task.difficulty === 'Easy' ? 'secondary' : task.difficulty === 'Medium' ? 'outline' : 'default'}
              className={task.difficulty === 'Hard' ? `bg-destructive/80 text-destructive-foreground` : ''}
            >
              {task.difficulty}
            </Badge>
          </div>
          <p className="text-xl font-semibold text-primary">{task.points} Points</p>
          <CardDescription className="text-base pt-2">{task.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <TaskForms task={task} />
        </CardContent>
      </Card>
    </div>
  );
}
