import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, CheckCircle, Package, Calendar, WalletCards, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { WithdrawalRequest, Deposit, AdminUser, Task, User, Package as TPackage, PackagePurchase, TaskResponse } from '@/lib/types';
import { UserPageHeader } from './user-details';
import { UserActivityTables } from './user-activity-tables';


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

const formatDateTime = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return parsed.toLocaleString();
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
    taskResponses: TaskResponse[];
    withdrawalRequests: WithdrawalRequest[];
    package: TPackage | null;
    depositHistory: Deposit[];
    packagePurchases: PackagePurchase[];
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

    const [withdrawalsSnap, depositsSnap, packagePurchasesSnap, taskResponsesSnap, packageSnap, referredSnap, referralLogsSnap] = await Promise.all([
        adminDb.collection('withdrawal_requests').where('userId', '==', userId).get(),
        adminDb.collection('deposits').where('userId', '==', userId).get(),
        adminDb.collection('package_purchases').where('userId', '==', userId).get(),
        adminDb.collection('task_responses').where('userId', '==', userId).get(),
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
    const packagePurchases = packagePurchasesSnap.docs
        .map((doc) => fromAdminDoc<PackagePurchase>(doc.id, doc.data() || {}))
        .sort((a, b) => new Date(String(b.createdAt || 0)).getTime() - new Date(String(a.createdAt || 0)).getTime());
    const taskResponses = taskResponsesSnap.docs
        .map((doc) => fromAdminDoc<TaskResponse>(doc.id, doc.data() || {}))
        .sort((a, b) => new Date(String(b.submittedAt || 0)).getTime() - new Date(String(a.submittedAt || 0)).getTime());

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
        taskResponses,
        withdrawalRequests,
        package: userPackage,
        depositHistory,
        packagePurchases,
        referrals,
        referralTransactions,
    };
}

type FinancialTransaction = {
    id: string;
    type: 'deposit' | 'withdrawal' | 'package_purchase' | 'referral_bonus' | 'contribution_reward';
    description: string;
    amountUsd: number;
    status: string;
    createdAt: string | null;
};

const FinancialTransactionsTable = ({
    deposits,
    withdrawals,
    packagePurchases,
    referralTransactions,
    taskResponses,
}: {
    deposits: Deposit[];
    withdrawals: WithdrawalRequest[];
    packagePurchases: PackagePurchase[];
    referralTransactions: Array<{ id: string; depositAmount: number; totalBonus: number; status: string; reason: string; createdAt: string | null }>;
    taskResponses: TaskResponse[];
}) => {
    const rows: FinancialTransaction[] = [
        ...deposits.map((item) => ({
            id: `dep_${item.id}`,
            type: 'deposit' as const,
            description: `Deposit via ${item.method}`,
            amountUsd: Number(item.amountUsd ?? item.amount ?? 0),
            status: String(item.status || 'pending'),
            createdAt: item.createdAt ? String(item.createdAt) : null,
        })),
        ...withdrawals.map((item) => ({
            id: `wd_${item.id}`,
            type: 'withdrawal' as const,
            description: `Withdrawal via ${item.paymentMethod}`,
            amountUsd: -Math.abs(Number(item.amountUsd ?? item.amount ?? 0)),
            status: String(item.status || 'pending'),
            createdAt: item.requestedAt ? String(item.requestedAt) : null,
        })),
        ...packagePurchases.map((item) => ({
            id: `pkg_${item.id}`,
            type: 'package_purchase' as const,
            description: `Package purchase: ${item.packageName}`,
            amountUsd: -Math.abs(Number(item.amountUsd ?? item.amount ?? 0)),
            status: String(item.status || 'completed'),
            createdAt: item.createdAt ? String(item.createdAt) : null,
        })),
        ...referralTransactions.map((item) => ({
            id: `ref_${item.id}`,
            type: 'referral_bonus' as const,
            description: item.reason || 'Referral bonus',
            amountUsd: Number(item.totalBonus || 0),
            status: String(item.status || 'pending'),
            createdAt: item.createdAt,
        })),
        ...taskResponses.map((item) => ({
            id: `task_${item.id}`,
            type: 'contribution_reward' as const,
            description: 'Contribution reward',
            amountUsd: Number(item.pointsEarned || 0) / 100,
            status: 'completed',
            createdAt: item.submittedAt ? String(item.submittedAt) : null,
        })),
    ].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const getTypeLabel = (type: FinancialTransaction['type']) => {
        if (type === 'deposit') return 'Deposit';
        if (type === 'withdrawal') return 'Withdrawal';
        if (type === 'package_purchase') return 'Package Purchase';
        if (type === 'referral_bonus') return 'Referral Bonus';
        return 'Contribution Reward';
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>All Financial Transactions</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length > 0 ? rows.map((item) => {
                            const isCredit = item.amountUsd >= 0;
                            return (
                                <TableRow key={item.id}>
                                    <TableCell>{formatDateTime(item.createdAt || undefined)}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{getTypeLabel(item.type)}</Badge>
                                    </TableCell>
                                    <TableCell>{item.description}</TableCell>
                                    <TableCell>
                                        <Badge variant={item.status === 'completed' || item.status === 'credited' ? 'secondary' : 'outline'}>{item.status}</Badge>
                                    </TableCell>
                                    <TableCell className={`text-right font-semibold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                                        {isCredit ? '+' : '-'}${Math.abs(item.amountUsd).toFixed(2)}
                                    </TableCell>
                                </TableRow>
                            );
                        }) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center">No transactions found.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};

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
    const ipHistory = Array.isArray(user.ipHistory) ? Array.from(new Set(user.ipHistory.filter(Boolean))) : [];
    const visibleIpHistory = ipHistory.slice(0, 6);
    const hiddenIpCount = Math.max(0, ipHistory.length - visibleIpHistory.length);
    const renderField = (label: string, value: string | number | null | undefined, longValue = false) => {
        const displayValue = value === null || value === undefined || value === '' ? 'N/A' : String(value);

        return (
            <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p
                    className={`font-medium leading-tight ${longValue ? 'truncate' : ''}`}
                    title={longValue ? displayValue : undefined}
                >
                    {displayValue}
                </p>
            </div>
        );
    };

    return (
        <Card>
            <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-4 [&::-webkit-details-marker]:hidden">
                    <span className="text-base font-semibold leading-none tracking-tight">Identity & Security</span>
                    <span className="text-xs text-muted-foreground group-open:hidden">Show</span>
                    <span className="hidden text-xs text-muted-foreground group-open:inline">Hide</span>
                </summary>
                <CardContent className="space-y-2.5 pt-0 text-sm">
                    <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                        {renderField('Registration IP', user.registrationIp, true)}
                        {renderField('Latest IP', user.ipAddress, true)}
                        {renderField('Copy Attempts', user.qualificationCopyAttemptCount || 0)}
                        {renderField('Last Copy Attempt', formatDate(user.qualificationLastCopyAttemptAt))}
                        {renderField('Registration Fingerprint', user.registrationFingerprint, true)}
                        {renderField('Current Fingerprint', user.browserFingerprint, true)}
                    </div>
                    <div>
                        <p className="mb-1 text-[11px] font-medium text-muted-foreground">IP History</p>
                        {visibleIpHistory.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                                {visibleIpHistory.map((ip, index) => (
                                    <Badge key={`${ip}-${index}`} variant="outline" className="font-mono text-[10px] leading-4">{ip}</Badge>
                                ))}
                                {hiddenIpCount > 0 && (
                                    <Badge variant="secondary" className="text-[10px] leading-4">+{hiddenIpCount} more</Badge>
                                )}
                            </div>
                        ) : (
                            <p className="text-[11px] text-muted-foreground">No IP history available.</p>
                        )}
                    </div>
                </CardContent>
            </details>
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
    const { packagePurchases, taskResponses } = data;

    const earningsBalance = Number(user.earningsBalance || 0);
    const depositBalance = Number(user.depositBalance || 0);
    const referralBalance = Number(user.referralBalance || 0);
    const totalBalance = earningsBalance + depositBalance + referralBalance;

    const adminUser: AdminUser = {
        ...user,
        packageName: userPackage?.name || 'Free Tier',
    };

    return (
        <div>
            <UserPageHeader user={adminUser} packages={packages} />
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-8 mb-8">
                <StatCard 
                    title="Earnings Balance" 
                    value={`$${earningsBalance.toFixed(2)}`}
                    icon={Award}
                />
                <StatCard 
                    title="Deposit Balance" 
                    value={`$${depositBalance.toFixed(2)}`}
                    icon={ArrowDownCircle}
                />
                <StatCard 
                    title="Referral Balance" 
                    value={`$${referralBalance.toFixed(2)}`}
                    icon={ArrowUpCircle}
                />
                <StatCard 
                    title="Total Wallet Balance" 
                    value={`$${totalBalance.toFixed(2)}`}
                    icon={WalletCards}
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
                <UserActivityTables
                    deposits={depositHistory}
                    withdrawals={withdrawalRequests}
                    packagePurchases={packagePurchases}
                    referralTransactions={referralTransactions}
                    taskResponses={taskResponses}
                    referrals={referrals}
                    completedTasks={completedTasks}
                />
            </div>
        </div>
    );
}
