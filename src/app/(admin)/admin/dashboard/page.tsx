import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList, Users, BarChart, CheckCircle2, Users2, Banknote } from 'lucide-react';
import { getDashboardStats } from '@/lib/database';

const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string | number, icon: React.ElementType, description: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);

export default async function AdminDashboardPage() {
    const stats = await getDashboardStats();

    return (
        <div>
            <h1 className="text-3xl font-bold font-headline">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">Overview and management tools.</p>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-8">
                <StatCard 
                    title="Total Users" 
                    value={stats.totalUsers} 
                    icon={Users2}
                    description="Total registered users on the platform."
                />
                <StatCard 
                    title="Contributions Completed" 
                    value={stats.totalTasksCompleted.toLocaleString()} 
                    icon={CheckCircle2}
                    description="Total responses submitted by all users."
                />
                 <StatCard 
                    title="Pending Withdrawals" 
                    value={stats.pendingWithdrawals} 
                    icon={Banknote}
                    description="User withdrawal requests needing review."
                />
                <StatCard 
                    title="Active Contributions" 
                    value={stats.activeTasks} 
                    icon={ClipboardList}
                    description="Contributions currently available for users."
                />
            </div>

            <div className="grid gap-6 mt-8 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm font-medium">
                            <ClipboardList className="h-5 w-5" />
                            Contribution Management
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">Create, edit, and manage all user contributions.</p>
                        <Link href="/admin/tasks" className="text-primary font-semibold mt-4 inline-block">
                            Go to Contributions &rarr;
                        </Link>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm font-medium">
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
                        <CardTitle className="flex items-center gap-2 text-sm font-medium">
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
