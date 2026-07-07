"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from 'recharts';
import { ClipboardList, Users, BarChart, CheckCircle2, Users2, Banknote, Activity, GaugeCircle, Layers3, TrendingUp, Wallet, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { recordExpense } from '@/lib/admin-api';
import { useToast } from '@/hooks/use-toast';
import { onAuthStateChanged } from 'firebase/auth';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';

const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string | number, icon: React.ElementType, description: string }) => (
    <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <div className="rounded-md border border-primary/20 bg-primary/10 p-1.5">
                <Icon className="h-4 w-4 text-primary" />
            </div>
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold text-primary">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);

type DashboardStats = {
    totalUsers: number;
    totalTasksCompleted: number;
    activeTasks: number;
    pendingWithdrawals: number;
};

type FinanceRange = 'today' | '7d' | '30d' | '90d' | '365d';

type FinanceAnalytics = {
    totalDeposits: number;
    totalWithdrawals: number;
    totalExpenses: number;
    netFlow: number;
    startDateIso: string;
    endDateIso: string;
    series: Array<{
        key: string;
        label: string;
        deposits: number;
        withdrawals: number;
        expenses: number;
        net: number;
    }>;
};

const RANGE_LABEL_MAP: Record<FinanceRange, string> = {
    'today': 'Today',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
    '365d': 'Last 12 months',
};

const emptyFinance: FinanceAnalytics = {
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalExpenses: 0,
    netFlow: 0,
    startDateIso: new Date(0).toISOString(),
    endDateIso: new Date(0).toISOString(),
    series: [],
};

const financeChartConfig = {
    deposits: {
        label: 'Deposits',
        color: 'hsl(var(--chart-2))',
    },
    withdrawals: {
        label: 'Withdrawals',
        color: 'hsl(var(--chart-5))',
    },
    expenses: {
        label: 'Expenses',
        color: 'hsl(var(--chart-4))',
    },
    net: {
        label: 'Net Flow',
        color: 'hsl(var(--chart-1))',
    },
};

const emptyStats: DashboardStats = {
    totalUsers: 0,
    totalTasksCompleted: 0,
    activeTasks: 0,
    pendingWithdrawals: 0,
};

export default function AdminDashboardPage() {
    const { toast } = useToast();
    const [stats, setStats] = useState<DashboardStats>(emptyStats);
    const [loading, setLoading] = useState(true);
    const [financeRange, setFinanceRange] = useState<FinanceRange>('today');
    const [finance, setFinance] = useState<FinanceAnalytics>(emptyFinance);
    const [financeLoading, setFinanceLoading] = useState(true);
    const [financeRefreshToken, setFinanceRefreshToken] = useState(0);
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseCurrency, setExpenseCurrency] = useState('USD');
    const [expenseCategory, setExpenseCategory] = useState('');
    const [expenseNote, setExpenseNote] = useState('');
    const [recordingExpense, setRecordingExpense] = useState(false);
    const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);

    const analytics = useMemo(() => {
        const safeUsers = Math.max(1, stats.totalUsers);
        const contributionsPerUser = stats.totalTasksCompleted / safeUsers;
        const pendingWithdrawalRate = (stats.pendingWithdrawals / safeUsers) * 100;
        const activeContributionCoverage = (stats.activeTasks / safeUsers) * 100;

        return {
            contributionsPerUser,
            pendingWithdrawalRate,
            activeContributionCoverage,
            fulfillmentSignal: stats.pendingWithdrawals <= Math.max(5, Math.round(stats.totalUsers * 0.03)) ? 'Healthy' : 'Needs Attention',
        };
    }, [stats]);

    const financeComparison = useMemo(() => {
        const deposits = finance.totalDeposits;
        const withdrawals = finance.totalWithdrawals;
        const expenses = finance.totalExpenses;
        const totalOutflow = withdrawals + expenses;
        const ratio = totalOutflow > 0 ? deposits / totalOutflow : deposits > 0 ? Infinity : 1;
        const ratioLabel = Number.isFinite(ratio) ? `${ratio.toFixed(2)}x` : '∞';
        return {
            ratioLabel,
            direction: finance.netFlow >= 0 ? 'positive' : 'negative',
            totalOutflow,
        };
    }, [finance]);

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 2,
        }).format(value || 0);

    const loadAdminDashboardData = async (range: FinanceRange) => {
        if (!auth?.currentUser) {
            throw new Error('You must be logged in as admin.');
        }

        const idToken = await auth.currentUser.getIdToken();
        const response = await fetch(`/api/admin/dashboard?range=${encodeURIComponent(range)}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${idToken}`,
            },
            cache: 'no-store',
        });

        const result = await response.json().catch(() => null) as {
            success?: boolean;
            message?: string;
            stats?: DashboardStats;
            finance?: FinanceAnalytics;
        } | null;

        if (!response.ok || !result?.success || !result.stats || !result.finance) {
            throw new Error(result?.message || 'Failed to load dashboard data.');
        }

        return result;
    };

    const handleRecordExpense = async () => {
        const amount = Number(expenseAmount);
        const category = expenseCategory.trim();
        const note = expenseNote.trim();

        if (!Number.isFinite(amount) || amount <= 0 || !category) {
            toast({ title: 'Missing info', description: 'Enter a valid amount and category.', variant: 'destructive' });
            return;
        }

        setRecordingExpense(true);
        try {
            const result = await recordExpense({ amount, category, note, currency: expenseCurrency });
            if (result.success) {
                toast({ title: 'Expense recorded', description: result.message });
                setExpenseAmount('');
                setExpenseCurrency('USD');
                setExpenseCategory('');
                setExpenseNote('');
                setFinanceRefreshToken((value) => value + 1);
            } else {
                toast({ title: 'Error', description: result.message || 'Failed to record expense.', variant: 'destructive' });
            }
        } catch (error) {
            console.error('Failed to record expense:', error);
            toast({ title: 'Error', description: 'Failed to record expense.', variant: 'destructive' });
        } finally {
            setRecordingExpense(false);
        }
    };

    useEffect(() => {
        let isMounted = true;

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!isMounted) return;

            if (!currentUser) {
                setLoading(false);
                setFinanceLoading(false);
                return;
            }

            setLoading(true);
            setFinanceLoading(true);

            try {
                const result = await loadAdminDashboardData(financeRange);
                if (isMounted) {
                    setStats(result.stats);
                    setFinance(result.finance);
                }
            } catch (error) {
                console.error('Failed to load admin dashboard data:', error);
                if (isMounted) {
                    setStats(emptyStats);
                    setFinance(emptyFinance);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                    setFinanceLoading(false);
                }
            }
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, [financeRange, financeRefreshToken]);

    return (
        <div>
          
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-8">
                <StatCard 
                    title="Total Users" 
                    value={loading ? '...' : stats.totalUsers} 
                    icon={Users2}
                    description="Total registered users on the platform."
                />
                <StatCard 
                    title="Contributions Completed" 
                    value={loading ? '...' : stats.totalTasksCompleted.toLocaleString()} 
                    icon={CheckCircle2}
                    description="Total responses submitted by all users."
                />
                 <StatCard 
                    title="Pending Withdrawals" 
                    value={loading ? '...' : stats.pendingWithdrawals} 
                    icon={Banknote}
                    description="User withdrawal requests needing review."
                />
                <StatCard 
                    title="Active Contributions" 
                    value={loading ? '...' : stats.activeTasks} 
                    icon={ClipboardList}
                    description="Contributions currently available for users."
                />
            </div>

            <div className="grid gap-4 mt-8 md:grid-cols-2 xl:grid-cols-4">
                <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-medium">
                            <Activity className="h-4 w-4 text-primary" />
                            Contribution Intensity
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-primary">{loading ? '...' : analytics.contributionsPerUser.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Average completed contributions per user.</p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-medium">
                            <GaugeCircle className="h-4 w-4 text-primary" />
                            Payout Queue Pressure
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-primary">{loading ? '...' : `${analytics.pendingWithdrawalRate.toFixed(1)}%`}</p>
                        <p className="text-xs text-muted-foreground">Pending withdrawals relative to user base.</p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-medium">
                            <Layers3 className="h-4 w-4 text-primary" />
                            Contribution Coverage
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-primary">{loading ? '...' : `${analytics.activeContributionCoverage.toFixed(1)}%`}</p>
                        <p className="text-xs text-muted-foreground">Active contribution pool vs total users.</p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-medium">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            Fulfillment Signal
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Badge variant={analytics.fulfillmentSignal === 'Healthy' ? 'secondary' : 'destructive'}>
                            {loading ? 'Calculating...' : analytics.fulfillmentSignal}
                        </Badge>
                        <p className="mt-2 text-xs text-muted-foreground">Operational health based on payout queue and platform size.</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 mt-6 lg:grid-cols-3">
                <Card className="border-border/60 bg-card/80 backdrop-blur-sm lg:col-span-1">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2 text-sm font-medium">
                                <Wallet className="h-4 w-4 text-primary" />
                                Cash Flow vs Expenses
                            </CardTitle>
                            <Select value={financeRange} onValueChange={(value) => setFinanceRange(value as FinanceRange)}>
                                <SelectTrigger className="h-8 w-[150px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="today">Today</SelectItem>
                                    <SelectItem value="7d">Last 7 days</SelectItem>
                                    <SelectItem value="30d">Last 30 days</SelectItem>
                                    <SelectItem value="90d">Last 90 days</SelectItem>
                                    <SelectItem value="365d">Last 12 months</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                        <div className="rounded-md border p-2.5">
                            <p className="text-xs text-muted-foreground">Range</p>
                            <p className="text-sm font-medium">{RANGE_LABEL_MAP[financeRange]}</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                            <div className="rounded-md border p-2.5">
                                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <ArrowDownToLine className="h-3.5 w-3.5" />
                                    Completed Deposits
                                </p>
                                <p className="text-lg font-semibold text-emerald-600">{financeLoading ? '...' : formatCurrency(finance.totalDeposits)}</p>
                            </div>
                            <div className="rounded-md border p-2.5">
                                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <ArrowUpFromLine className="h-3.5 w-3.5" />
                                    Completed Withdrawals
                                </p>
                                <p className="text-lg font-semibold text-rose-600">{financeLoading ? '...' : formatCurrency(finance.totalWithdrawals)}</p>
                            </div>
                            <div className="rounded-md border p-2.5 sm:col-span-2 lg:col-span-1">
                                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Banknote className="h-3.5 w-3.5" />
                                    Tracked Expenses
                                </p>
                                <p className="text-lg font-semibold text-amber-600">{financeLoading ? '...' : formatCurrency(finance.totalExpenses)}</p>
                            </div>
                        </div>
                        <div className="rounded-md border p-2.5">
                            <p className="text-xs text-muted-foreground">Net After Expenses</p>
                            <p className={`text-lg font-semibold ${finance.netFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {financeLoading ? '...' : formatCurrency(finance.netFlow)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Deposit to total outflow ratio: {financeLoading ? '...' : financeComparison.ratioLabel}
                            </p>
                            <Badge className="mt-2" variant={financeComparison.direction === 'positive' ? 'secondary' : 'destructive'}>
                                {financeLoading ? 'Analyzing...' : financeComparison.direction === 'positive' ? 'Positive cash flow' : 'Negative cash flow'}
                            </Badge>
                        </div>
                        <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full h-9">
                                    Add Expense
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Record Expense</DialogTitle>
                                    <DialogDescription>
                                        Capture operational spending without taking up space on the dashboard.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-3 pt-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="Amount"
                                            value={expenseAmount}
                                            onChange={(event) => setExpenseAmount(event.target.value)}
                                        />
                                        <Select value={expenseCurrency} onValueChange={setExpenseCurrency}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {SUPPORTED_CURRENCIES.map((currencyCode) => (
                                                    <SelectItem key={currencyCode} value={currencyCode}>{currencyCode}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Input
                                        placeholder="Category"
                                        value={expenseCategory}
                                        onChange={(event) => setExpenseCategory(event.target.value)}
                                    />
                                    <Textarea
                                        placeholder="Note (optional)"
                                        value={expenseNote}
                                        onChange={(event) => setExpenseNote(event.target.value)}
                                    />
                                    <Button
                                        onClick={async () => {
                                            await handleRecordExpense();
                                            setExpenseDialogOpen(false);
                                        }}
                                        disabled={recordingExpense}
                                    >
                                        {recordingExpense ? 'Recording...' : 'Record Expense'}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80 backdrop-blur-sm lg:col-span-2 flex h-full flex-col">
                    <CardHeader className="pb-1">
                        <CardTitle className="text-sm font-medium">Financial Flow Trend</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col pt-0 pb-3">
                        <ChartContainer config={financeChartConfig} className="min-h-[170px] flex-1 w-full">
                            <AreaChart data={finance.series} margin={{ left: 6, right: 6, top: 2, bottom: 0 }}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                                <YAxis tickLine={false} axisLine={false} width={90} tickFormatter={(value) => `$${Number(value).toLocaleString()}`} />
                                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Area type="monotone" dataKey="deposits" stroke="var(--color-deposits)" fill="var(--color-deposits)" fillOpacity={0.22} strokeWidth={2} />
                                <Area type="monotone" dataKey="withdrawals" stroke="var(--color-withdrawals)" fill="var(--color-withdrawals)" fillOpacity={0.16} strokeWidth={2} />
                                <Area type="monotone" dataKey="expenses" stroke="var(--color-expenses)" fill="var(--color-expenses)" fillOpacity={0.14} strokeWidth={2} />
                                <Line type="monotone" dataKey="net" stroke="var(--color-net)" strokeWidth={2} dot={false} />
                            </AreaChart>
                        </ChartContainer>
                        <p className="mt-3 text-xs text-muted-foreground">
                            {financeLoading ? 'Loading financial trend...' : `Showing completed deposit, withdrawal, and expense flow for ${RANGE_LABEL_MAP[financeRange]}.`}
                        </p>
                    </CardContent>
                </Card>
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
                            Platform Analytics
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">Use the metrics above to monitor throughput, payout pressure, and contribution supply health.</p>
                         <Link href="/admin/dashboard" className="text-primary font-semibold mt-4 inline-block">
                            Refresh Analytics &rarr;
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
