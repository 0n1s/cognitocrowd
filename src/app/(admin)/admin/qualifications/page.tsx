
import { TestList } from "./test-list";

export default function AdminQualificationsPage() {
    return (
        <div>
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Qualification Tests</h1>
                    <p className="text-muted-foreground mt-1">Manage the question banks for user qualification tests.</p>
                </div>
            </div>
            <div className="mt-8">
                <TestList />
            </div>
        </div>
    );
}
