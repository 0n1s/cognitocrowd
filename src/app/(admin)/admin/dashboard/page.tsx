import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList, Users, BarChart } from 'lucide-react';

export default function AdminDashboardPage() {
    return (
        <div>
            <h1 className="text-3xl font-bold font-headline">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">Overview and management tools.</p>
            <div className="grid gap-6 mt-8 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ClipboardList className="h-5 w-5" />
                            Task Management
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">Create, edit, and manage all user tasks.</p>
                        <Link href="/admin/tasks" className="text-primary font-semibold mt-4 inline-block">
                            Go to Tasks &rarr;
                        </Link>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            User Management
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">View and manage user accounts and roles.</p>
                        <Link href="/admin/users" className="text-primary font-semibold mt-4 inline-block">
                            Go to Users &rarr;
                        </Link>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart className="h-5 w-5" />
                            Analytics
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">View platform analytics and task statistics.</p>
                         <Link href="#" className="text-primary font-semibold mt-4 inline-block text-muted-foreground pointer-events-none">
                            Coming Soon
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
