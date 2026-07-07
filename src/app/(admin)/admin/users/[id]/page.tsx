import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, CheckCircle, Package, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { WithdrawalRequest, Deposit, AdminUser, Task, User, Package as TPackage } from '@/lib/types';
import { UserPageHeader } from './user-details';
import { CompletedTasksTable } from './completed-tasks-table';


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

function serializeFirestoreValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(serializeFirestoreValue);
    }

    if (value && typeof value === 'object') {
        const maybeTimestamp = value as { toDate?: () => Date };
        if (typeof maybeTimestamp.toDate === 'function') {
            return maybeTimestamp.toDate().toISOString();
        }

        const entries = Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
            key,
            serializeFirestoreValue(entryValue),
        ]);
        return Object.fromEntries(entries);
    }

    return value;
}

function fromAdminDoc<T extends { id: string }>(id: string, data: Record<string, unknown>): T {
    return {
        id,
        ...(serializeFirestoreValue(data) as Record<string, unknown>),
    } as T;
}

async function getAdminPackages(): Promise<TPackage[]> {
    const snapshot = await adminDb.collection('packages').get();
    return snapshot.docs.map((doc) => fromAdminDoc<TPackage>(doc.id, doc.data() || {}));
}

async function getAdminUserDetailById(userId: string): Promise<{
    user: User;
    completedTasks: Task[];
    withdrawalRequests: WithdrawalRequest[];
    package: TPackage | null;
    depositHistory: Deposit[];
    referrals: Array<{ id: string; name: string; email: string; packageName: string; firstDepositAmount: number | null; bonus: number; status: string; signupDate: string | null; suspicious: boolean }>;
    referralTransactions: Array<{ id: string; depositAmount: number; totalBonus: number; status: string; reason: string; createdAt: string | null }>;
} | null> {
    const userSnap = await adminDb.collection('users').doc(userId).get();
    if (!userSnap.exists) {
        return null;
    }

    const user = fromAdminDoc<User>(userSnap.id, userSnap.data() || {});

    const completedTaskIds = Array.isArray(user.completedTasks) ? user.completedTasks : [];
    const completedTasks: Task[] = [];
    const MAX_IN_CLAUSE_SIZE = 30;

    for (let i = 0; i < completedTaskIds.length; i += MAX_IN_CLAUSE_SIZE) {
        const chunk = completedTaskIds.slice(i, i + MAX_IN_CLAUSE_SIZE);
        if (chunk.length === 0) continue;
        const taskSnapshot = await adminDb.collection('tasks').where('__name__', 'in', chunk).get();
        taskSnapshot.forEach((doc) => {
            completedTasks.push(fromAdminDoc<Task>(doc.id, doc.data() || {}));
        });
    }

    const [withdrawalsSnap, depositsSnap, packageSnap, referredSnap, referralLogsSnap] = await Promise.all([
        adminDb.collection('withdrawal_requests').where('userId', '==', userId).get(),
        adminDb.collection('deposits').where('userId', '==', userId).get(),
        user.packageId ? adminDb.collection('packages').doc(user.packageId).get() : Promise.resolve(null),
        adminDb.collection('users').where('referredBy', '==', userId).get(),
        adminDb.collection('referral_transactions').where('referrerUserId', '==', userId).get(),
    ]);

    const withdrawalRequests = withdrawalsSnap.docs.map((doc) =>
        fromAdminDoc<WithdrawalRequest>(doc.id, doc.data() || {})
    );
    const depositHistory = depositsSnap.docs
        .map((doc) => fromAdminDoc<Deposit>(doc.id, doc.data() || {}))
        .sort((a, b) => new Date(String(b.createdAt || 0)).getTime() - new Date(String(a.createdAt || 0)).getTime());

    const userPackage = packageSnap && packageSnap.exists
        ? fromAdminDoc<TPackage>(packageSnap.id, packageSnap.data() || {})
        : null;

    const referralLogs = new Map(referralLogsSnap.docs.map((doc) => [String(doc.data().referredUserId || ''), doc.data()]));
    const referralRows = await Promise.all(referredSnap.docs.map(async (doc) => {
        const referred = doc.data() || {};
        const [referredPackage, firstDeposit] = await Promise.all([
            referred.packageId ? adminDb.collection('packages').doc(String(referred.packageId)).get() : null,
            adminDb.collection('deposits').where('userId', '==', doc.id).get(),
        ]);
        const log = referralLogs.get(doc.id);
        return {
            id: doc.id,
            name: String(referred.name || 'User'),
            email: String(referred.email || ''),
            packageName: referredPackage?.exists ? String(referredPackage.data()?.name || 'Package') : 'No package',
            firstDepositAmount: firstDeposit.docs.find((item) => item.data().status === 'completed') ? Number(firstDeposit.docs.find((item) => item.data().status === 'completed')?.data().amount || 0) : null,
            bonus: Number(log?.totalBonus || 0),
            status: String(log?.status || 'pending'),
            signupDate: referred.createdAt?.toDate?.().toISOString?.() || null,
            registrationIp: String(referred.registrationIp || ''),
            registrationFingerprint: String(referred.registrationFingerprint || ''),
        };
    }));
    const ipCounts = new Map<string, number>();
    const fingerprintCounts = new Map<string, number>();
    referralRows.forEach((item) => {
        if (item.registrationIp) ipCounts.set(item.registrationIp, (ipCounts.get(item.registrationIp) || 0) + 1);
        if (item.registrationFingerprint) fingerprintCounts.set(item.registrationFingerprint, (fingerprintCounts.get(item.registrationFingerprint) || 0) + 1);
    });
    const referrals = referralRows.map(({ registrationIp, registrationFingerprint, ...item }) => ({
        ...item,
        suspicious: Boolean(
            (registrationIp && (registrationIp === user.registrationIp || (ipCounts.get(registrationIp) || 0) > 1)) ||
            (registrationFingerprint && (registrationFingerprint === user.registrationFingerprint || (fingerprintCounts.get(registrationFingerprint) || 0) > 1))
        ),
    }));
    const referralTransactions = referralLogsSnap.docs.map((doc) => {
        const log = doc.data() || {};
        return { id: doc.id, depositAmount: Number(log.depositAmount || 0), totalBonus: Number(log.totalBonus || 0), status: String(log.status || 'pending'), reason: String(log.reason || ''), createdAt: log.createdAt?.toDate?.().toISOString?.() || null };
    });

    return {
        user,
        completedTasks,
        withdrawalRequests,
        package: userPackage,
        depositHistory,
        referrals,
        referralTransactions,
    };
}

const ReferralHistoryCard = ({ user, referrals, referralTransactions, userPackage }: { user: User; referrals: Array<{ id: string; name: string; email: string; packageName: string; firstDepositAmount: number | null; bonus: number; status: string; signupDate: string | null; suspicious: boolean }>; referralTransactions: Array<{ id: string; depositAmount: number; totalBonus: number; status: string; reason: string; createdAt: string | null }>; userPackage: TPackage | null }) => (
    <Card>
        <CardHeader><CardTitle>Referral Program</CardTitle></CardHeader>
        <CardContent className="space-y-5">
            <div className="grid gap-3 text-sm md:grid-cols-4">
                <div><p className="text-muted-foreground">Code</p><p className="font-medium">{user.referralCode || 'N/A'}</p></div>
                <div><p className="text-muted-foreground">Referral balance</p><p className="font-medium">${Number(user.referralBalance || 0).toFixed(2)}</p></div>
                <div><p className="text-muted-foreground">Total earned</p><p className="font-medium">${Number(user.referralEarningsTotal || 0).toFixed(2)}</p></div>
                <div><p className="text-muted-foreground">Plan bonus</p><p className="font-medium">${Number(userPackage?.referralBonusFixed || 0).toFixed(2)} + {Number(userPackage?.referralBonusPercentage || 0)}%</p></div>
            </div>
            <Table><TableHeader><TableRow><TableHead>Referred user</TableHead><TableHead>Package</TableHead><TableHead>First deposit</TableHead><TableHead>Bonus</TableHead><TableHead>Status</TableHead><TableHead>Signup</TableHead></TableRow></TableHeader><TableBody>
                {referrals.length ? referrals.map((item) => <TableRow key={item.id}><TableCell><div className="flex items-center gap-2"><span className="font-medium">{item.name}</span>{item.suspicious && <Badge variant="destructive">Review</Badge>}</div><div className="text-xs text-muted-foreground">{item.email}</div></TableCell><TableCell>{item.packageName}</TableCell><TableCell>{item.firstDepositAmount == null ? 'None' : `$${item.firstDepositAmount.toFixed(2)}`}</TableCell><TableCell>${item.bonus.toFixed(2)}</TableCell><TableCell><Badge variant="outline">{item.status}</Badge></TableCell><TableCell>{formatDate(item.signupDate || undefined)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="text-center">No referred users.</TableCell></TableRow>}
            </TableBody></Table>
            <div><h3 className="mb-2 font-semibold">Referral transaction logs</h3><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Deposit</TableHead><TableHead>Bonus</TableHead><TableHead>Status</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader><TableBody>{referralTransactions.length ? referralTransactions.map((item) => <TableRow key={item.id}><TableCell>{formatDate(item.createdAt || undefined)}</TableCell><TableCell>${item.depositAmount.toFixed(2)}</TableCell><TableCell>${item.totalBonus.toFixed(2)}</TableCell><TableCell><Badge variant="outline">{item.status}</Badge></TableCell><TableCell>{item.reason || 'Automatic referral bonus'}</TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="text-center">No referral transactions.</TableCell></TableRow>}</TableBody></Table></div>
        </CardContent>
    </Card>
);

const WithdrawalHistoryTable = ({ requests }: { requests: WithdrawalRequest[] }) => {
    const statusColors: Record<WithdrawalRequest['status'], string> = {
      pending: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
      completed: "bg-green-500/20 text-green-700 border-green-500/30",
      failed: "bg-red-500/20 text-red-700 border-red-500/30",
            canceled: "bg-slate-500/20 text-slate-700 border-slate-500/30",
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

const IdentitySecurityCard = ({ user }: { user: User }) => {
    const ipHistory = Array.isArray(user.ipHistory) ? user.ipHistory.filter(Boolean) : [];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Identity & Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                <p><span className="font-medium">Registration IP:</span> {user.registrationIp || 'N/A'}</p>
                <p><span className="font-medium">Latest IP:</span> {user.ipAddress || 'N/A'}</p>
                <p><span className="font-medium">Registration Fingerprint:</span> {user.registrationFingerprint || 'N/A'}</p>
                <p><span className="font-medium">Current Fingerprint:</span> {user.browserFingerprint || 'N/A'}</p>
                <p><span className="font-medium">Copy Attempts (Qualification):</span> {user.qualificationCopyAttemptCount || 0}</p>
                <p><span className="font-medium">Last Copy Attempt:</span> {formatDate(user.qualificationLastCopyAttemptAt)}</p>
                <div>
                    <p className="font-medium">IP History</p>
                    {ipHistory.length > 0 ? (
                        <ul className="list-disc pl-5 text-muted-foreground">
                            {ipHistory.map((ip, index) => (
                                <li key={`${ip}-${index}`}>{ip}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground">No IP history available.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [data, packages] = await Promise.all([
        getAdminUserDetailById(id),
        getAdminPackages(),
    ]);

    if (!data) {
        notFound();
    }

    const { user, completedTasks, withdrawalRequests, depositHistory, referrals, referralTransactions, package: userPackage } = data;

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
                <IdentitySecurityCard user={user} />
                <ReferralHistoryCard user={user} referrals={referrals} referralTransactions={referralTransactions} userPackage={userPackage} />
                <WithdrawalHistoryTable requests={withdrawalRequests} />
                <DepositHistoryTable deposits={depositHistory} />
                <CompletedTasksTable tasks={completedTasks} />
            </div>
        </div>
    );
}
