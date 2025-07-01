import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminUserDetail } from '@/lib/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Award, CheckCircle, Package, Calendar } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Task, WithdrawalRequest } from '@/lib/types';

const StatCard = ({ title, value, icon: Icon }: { title: string, value: string | number, icon: React.ElementType }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
};

const CompletedTasksTable = ({ tasks }: { tasks: Task[] }) => (
    <Card>
        <CardHeader>
            <CardTitle>Completed Contributions</CardTitle>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tasks.length > 0 ? tasks.map((task) => (
                        <TableRow key={task.id}>
                            <TableCell>{task.title}</TableCell>
                            <TableCell>{task.type}</TableCell>
                            <TableCell className="text-right">{task.points}</TableCell>
                        </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={3} className="text-center">No contributions completed yet.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
);

const WithdrawalHistoryTable = ({ requests }: { requests: WithdrawalRequest[] }) => {
    const statusColors: Record<WithdrawalRequest['status'], string> = {
      pending: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
      completed: "bg-green-500/20 text-green-700 border-green-500/30",
      failed: "bg-red-500/20 text-red-700 border-red-500/30",
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Withdrawal History</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {requests.length > 0 ? requests.map((req) => (
                            <TableRow key={req.id}>
                                <TableCell>{formatDate(req.requestedAt)}</TableCell>
                                <TableCell>${req.amount.toFixed(2)}</TableCell>
                                <TableCell>{req.paymentMethod}</TableCell>
                                <TableCell className="text-right">
                                    <Badge className={statusColors[req.status]}>{req.status}</Badge>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center">No withdrawal requests found.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};

export default async function UserDetailPage({ params }: { params: { id: string } }) {
    const data = await getAdminUserDetail(params.id);

    if (!data) {
        notFound();
    }

    const { user, completedTasks, withdrawalRequests, package: userPackage } = data;

    const getInitials = (name: string | null | undefined) => {
        if (!name) return "U";
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }

    return (
        <div>
            <div className="flex items-center gap-4 mb-6">
                 <Button asChild variant="outline" size="icon">
                    <Link href="/admin/users"><ArrowLeft className="h-4 w-4" /></Link>
                 </Button>
                <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-2xl font-bold font-headline">{user.name}</h1>
                        <p className="text-muted-foreground">{user.email}</p>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-8 mb-8">
                <StatCard 
                    title="Total Earnings" 
                    value={`$${user.earningsBalance.toFixed(2)}`}
                    icon={Award}
                />
                <StatCard 
                    title="Contributions Completed" 
                    value={user.completedTasks?.length || 0} 
                    icon={CheckCircle}
                />
                 <StatCard 
                    title="Current Package" 
                    value={userPackage?.name || 'Free Tier'} 
                    icon={Package}
                />
                <StatCard 
                    title="Date Joined" 
                    value={formatDate(user.createdAt)}
                    icon={Calendar}
                />
            </div>

            <div className="space-y-8">
                <CompletedTasksTable tasks={completedTasks} />
                <WithdrawalHistoryTable requests={withdrawalRequests} />
            </div>
        </div>
    );
}