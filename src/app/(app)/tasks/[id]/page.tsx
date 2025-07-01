import { getTask } from "@/lib/database";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskForms } from "./task-forms";

export default async function TaskPage({ params }: { params: { id: string } }) {
  const task = await getTask(params.id);

  if (!task) {
    notFound();
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
