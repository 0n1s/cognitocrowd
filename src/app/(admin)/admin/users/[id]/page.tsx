import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminUserDetail, getPackages } from '@/lib/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, CheckCircle, Package, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Task, WithdrawalRequest, Deposit, AdminUser } from '@/lib/types';
import { UserPageHeader } from './user-details';


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

const DepositHistoryTable = ({ deposits }: { deposits: Deposit[] }) => {
    const statusColors: Record<Deposit['status'], string> = {
      pending: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
      completed: "bg-green-500/20 text-green-700 border-green-500/30",
      failed: "bg-red-500/20 text-red-700 border-red-500/30",
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Deposit History</CardTitle>
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
                        {deposits.length > 0 ? deposits.map((dep) => (
                            <TableRow key={dep.id}>
                                <TableCell>{formatDate(dep.createdAt)}</TableCell>
                                <TableCell>${dep.amount.toFixed(2)}</TableCell>
                                <TableCell>{dep.method}</TableCell>
                                <TableCell className="text-right">
                                    <Badge className={statusColors[dep.status]}>{dep.status}</Badge>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center">No deposit history found.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

export default async function UserDetailPage({ params }: { params: { id: string } }) {
    const [data, packages] = await Promise.all([
        getAdminUserDetail(params.id),
        getPackages(),
    ]);

    if (!data) {
        notFound();
    }

    const { user, completedTasks, withdrawalRequests, depositHistory, package: userPackage } = data;

    const adminUser: AdminUser = {
        ...user,
        packageName: userPackage?.name || 'Free Tier',
    };

    return (
        <div>
            <UserPageHeader user={adminUser} packages={packages} />
            
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
                <DepositHistoryTable deposits={depositHistory} />
            </div>
        </div>
    );
}
