import { getAdminTasks } from "@/lib/database";
import { TaskList } from "./task-list";

export default async function AdminTasksPage() {
    const tasks = await getAdminTasks();
    return (
        <div>
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Task Management</h1>
                    <p className="text-muted-foreground mt-1">Create, view, and manage all tasks on the platform.</p>
                </div>
            </div>
            <div className="mt-8">
                <TaskList initialTasks={tasks} />
            </div>
        </div>
    );
}
