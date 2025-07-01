import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { mockTasks } from '@/lib/data';
import { ArrowRight } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold font-headline">Available Tasks</h1>
      <p className="text-muted-foreground mt-1">Select a task to complete and earn points.</p>
      <div className="grid gap-6 mt-8 sm:grid-cols-2 lg:grid-cols-3">
        {mockTasks.map((task) => (
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
    </div>
  );
}
