import { UserList } from "./user-list";

export default function AdminUsersPage() {
    return (
        <div>
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold font-headline">User Management</h1>
                    <p className="text-muted-foreground mt-1">View, edit, and manage all users on the platform.</p>
                </div>
            </div>
            <div className="mt-8">
                <UserList />
            </div>
        </div>
    );
}
