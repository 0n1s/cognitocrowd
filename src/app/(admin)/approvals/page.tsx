
import { ApprovalList } from "./approval-list";

export default function AdminApprovalsPage() {
    return (
        <div>
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold font-headline">User Approvals</h1>
                    <p className="text-muted-foreground mt-1">Review and approve new user qualification tests.</p>
                </div>
            </div>
            <div className="mt-8">
                <ApprovalList />
            </div>
        </div>
    );
}
