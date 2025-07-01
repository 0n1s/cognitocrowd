import Link from 'next/link';
import { notFound, useRouter } from 'next/navigation';
import { getAdminUserDetail, getPackages } from '@/lib/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Award, CheckCircle, Package, Calendar, Edit, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Task, WithdrawalRequest, Deposit, Package as TPackage, AdminUser } from '@/lib/types';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { updateAdminUser } from "@/lib/actions";

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

function EditUserDialog({ user, packages, open, onOpenChange, onUserUpdated }: { user: AdminUser; packages: TPackage[]; open: boolean; onOpenChange: (open: boolean) => void; onUserUpdated: () => void; }) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [role, setRole] = useState(user.role || 'user');
    const [packageId, setPackageId] = useState(user.packageId || 'null');
    const [earningsBalance, setEarningsBalance] = useState(user.earningsBalance);
    const [depositBalance, setDepositBalance] = useState(user.depositBalance);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        const result = await updateAdminUser(user.id, {
            role,
            packageId: packageId === 'null' ? null : packageId,
            earningsBalance,
            depositBalance,
        });
        
        if (result.success) {
            toast({ title: "Success", description: result.message });
            onOpenChange(false);
            onUserUpdated();
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setIsSubmitting(false);
    };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">Edit User: {user.name}</DialogTitle>
          <DialogDescription>
            Update user role, package, and balances.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role" className="text-right">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="package" className="text-right">Package</Label>
             <Select value={packageId} onValueChange={setPackageId}>
                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="null">Free Tier</SelectItem>
                    {packages.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="earnings" className="text-right">Earnings</Label>
            <Input id="earnings" type="number" value={earningsBalance} onChange={e => setEarningsBalance(Number(e.target.value))} className="col-span-3" />
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="deposits" className="text-right">Deposits</Label>
            <Input id="deposits" type="number" value={depositBalance} onChange={e => setDepositBalance(Number(e.target.value))} className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function UserPageHeader({ user, packages }: { user: AdminUser, packages: TPackage[] }) {
    "use client";
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const router = useRouter();

    const getInitials = (name: string | null | undefined) => {
        if (!name) return "U";
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }

    return (
        <>
            <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
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
                <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit User
                </Button>
            </div>
             {isEditDialogOpen && (
                <EditUserDialog 
                    user={user} 
                    packages={packages} 
                    open={isEditDialogOpen} 
                    onOpenChange={setIsEditDialogOpen} 
                    onUserUpdated={() => {
                        setIsEditDialogOpen(false);
                        router.refresh();
                    }} 
                />
            )}
        </>
    );
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
