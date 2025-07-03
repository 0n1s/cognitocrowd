
import { TaskList } from "./task-list";

export default function AdminTasksPage() {
    return (
        <div>
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Contribution Management</h1>
                    <p className="text-muted-foreground mt-1">Create, view, and manage all contributions on the platform.</p>
                </div>
            </div>
            <div className="mt-8">
                <TaskList />
            </div>
        </div>
    );
}
