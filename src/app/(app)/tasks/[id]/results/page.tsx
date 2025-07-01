
"use client";

import { useEffect, useState } from 'react';
import { getTask, getTaskResponses } from "@/lib/database";
import { notFound, useParams } from "next/navigation";
import type { Task, TaskResponse } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { ResultsDisplay } from './results-display';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

function LoadingSkeleton() {
    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center">
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-10 w-48" />
        </div>
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
}

export default function TaskResultsPage() {
  const params = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [responses, setResponses] = useState<TaskResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    async function fetchData() {
      if (!params.id || !user) return;
      
      try {
        const [fetchedTask, fetchedResponses] = await Promise.all([
            getTask(params.id),
            getTaskResponses(params.id)
        ]);

        if (!fetchedTask) {
          notFound();
        } else {
          setTask(fetchedTask);
          setResponses(fetchedResponses);
        }
      } catch (error) {
        console.error("Failed to fetch task results:", error);
        notFound();
      } finally {
        setLoading(false);
      }
    }
    
    if (!authLoading) {
        fetchData();
    }
  }, [params.id, user, authLoading]);

  if (loading || authLoading) {
      return <LoadingSkeleton />;
  }
  
  if (!task) {
      return notFound();
  }

  return (
    <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold font-headline">Contribution Results: {task.title}</h1>
            <Button asChild variant="outline">
                <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Link>
            </Button>
        </div>
      
        <ResultsDisplay task={task} responses={responses} userId={user!.uid} />
    </div>
  );
}
