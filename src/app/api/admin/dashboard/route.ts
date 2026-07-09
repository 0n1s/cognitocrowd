import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import type { Deposit, Expense, WithdrawalRequest } from '@/lib/types';

export const runtime = 'nodejs';

type FinanceRange = 'today' | '7d' | '30d' | '90d' | '365d';
type FinanceGranularity = 'day' | 'week' | 'month';

type DashboardStats = {
  totalUsers: number;
  totalTasksCompleted: number;
  activeTasks: number;
  pendingWithdrawals: number;
};

type FinancialFlowPoint = {
  key: string;
  label: string;
  deposits: number;
  withdrawals: number;
  expenses: number;
  net: number;
};

type FinancialFlowAnalytics = {
  totalDeposits: number;
  totalWithdrawals: number;
  totalExpenses: number;
  netFlow: number;
  series: FinancialFlowPoint[];
  startDateIso: string;
  endDateIso: string;
  granularity: FinanceGranularity;
};

function getRangeDays(range: FinanceRange): number {
  switch (range) {
    case 'today': return 1;
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
    default: return 365;
  }
}

function getGranularityForRange(days: number): FinanceGranularity {
  if (days <= 31) return 'day';
  if (days <= 120) return 'week';
  return 'month';
}

function getStartOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getStartOfUtcWeek(date: Date): Date {
  const day = date.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  const start = getStartOfUtcDay(date);
  start.setUTCDate(start.getUTCDate() - mondayOffset);
  return start;
}

function getStartOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function getBucketStart(date: Date, granularity: FinanceGranularity): Date {
  if (granularity === 'week') return getStartOfUtcWeek(date);
  if (granularity === 'month') return getStartOfUtcMonth(date);
  return getStartOfUtcDay(date);
}

function addBucketStep(date: Date, granularity: FinanceGranularity): Date {
  const next = new Date(date);
  if (granularity === 'week') next.setUTCDate(next.getUTCDate() + 7);
  else if (granularity === 'month') next.setUTCMonth(next.getUTCMonth() + 1);
  else next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function formatBucketLabel(date: Date, granularity: FinanceGranularity): string {
  if (granularity === 'month') {
    return new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
}

function toDateValue(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'object' && value && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const converted = (value as { toDate: () => Date }).toDate();
    return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
  }
  return null;
}

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized request.');
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  const apiKey = process.env.FIREBASE_WEB_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error('Unauthorized request.');
  }

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
    cache: 'no-store',
  });

  const body = (await response.json().catch(() => ({}))) as {
    users?: Array<{ localId?: string }>;
  };
  const uid = Array.isArray(body.users) ? String(body.users[0]?.localId || '') : '';
  if (!response.ok || !uid) {
    throw new Error('Unauthorized request.');
  }

  const userDoc = await adminDb.collection('users').doc(uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'super_user_alpha_7') {
    throw new Error('Forbidden.');
  }
}

async function getDashboardStats(): Promise<DashboardStats> {
  const [usersSnapshot, tasksSnapshot, responsesSnapshot, withdrawalsSnapshot] = await Promise.all([
    adminDb.collection('users').get(),
    adminDb.collection('tasks').where('status', '==', 'Active').get(),
    adminDb.collection('task_responses').get(),
    adminDb.collection('withdrawal_requests').where('status', '==', 'pending').get(),
  ]);

  return {
    totalUsers: usersSnapshot.size,
    activeTasks: tasksSnapshot.size,
    totalTasksCompleted: responsesSnapshot.size,
    pendingWithdrawals: withdrawalsSnapshot.size,
  };
}

async function getFinancialFlowAnalytics(rangeDays: number): Promise<FinancialFlowAnalytics> {
  const now = new Date();
  const endDate = getStartOfUtcDay(now);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - Math.max(1, rangeDays));
  const granularity = getGranularityForRange(rangeDays);

  const points = new Map<string, FinancialFlowPoint>();
  for (let cursor = getBucketStart(startDate, granularity); cursor < endDate; cursor = addBucketStep(cursor, granularity)) {
    const key = cursor.toISOString();
    points.set(key, { key, label: formatBucketLabel(cursor, granularity), deposits: 0, withdrawals: 0, expenses: 0, net: 0 });
  }

  const startTimestamp = Timestamp.fromDate(startDate);
  const [depositsSnapshot, withdrawalsSnapshot, expensesSnapshot] = await Promise.all([
    adminDb.collection('deposits').where('createdAt', '>=', startTimestamp).get(),
    adminDb.collection('withdrawal_requests').where('requestedAt', '>=', startTimestamp).get(),
    adminDb.collection('expenses').where('createdAt', '>=', startTimestamp).get(),
  ]);

  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let totalExpenses = 0;

  for (const depositDoc of depositsSnapshot.docs) {
    const deposit = depositDoc.data() as Deposit;
    if (deposit.status !== 'completed') continue;
    const eventDate = toDateValue(deposit.createdAt || deposit.processedAt);
    if (!eventDate || eventDate < startDate || eventDate >= endDate) continue;
    const point = points.get(getBucketStart(eventDate, granularity).toISOString());
    if (!point) continue;
    const amount = Number(deposit.amountUsd ?? deposit.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    point.deposits += amount;
    totalDeposits += amount;
  }

  for (const withdrawalDoc of withdrawalsSnapshot.docs) {
    const withdrawal = withdrawalDoc.data() as WithdrawalRequest;
    if (withdrawal.status !== 'completed') continue;
    const eventDate = toDateValue(withdrawal.requestedAt || withdrawal.processedAt);
    if (!eventDate || eventDate < startDate || eventDate >= endDate) continue;
    const point = points.get(getBucketStart(eventDate, granularity).toISOString());
    if (!point) continue;
    const amount = Number(withdrawal.amountUsd ?? withdrawal.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    point.withdrawals += amount;
    totalWithdrawals += amount;
  }

  for (const expenseDoc of expensesSnapshot.docs) {
    const expense = expenseDoc.data() as Expense;
    const eventDate = toDateValue(expense.createdAt);
    if (!eventDate || eventDate < startDate || eventDate >= endDate) continue;
    const point = points.get(getBucketStart(eventDate, granularity).toISOString());
    if (!point) continue;
    const amount = Number(expense.amountUsd ?? expense.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    point.expenses += amount;
    totalExpenses += amount;
  }

  const series = Array.from(points.values()).map((point) => ({
    ...point,
    deposits: Number(point.deposits.toFixed(2)),
    withdrawals: Number(point.withdrawals.toFixed(2)),
    expenses: Number(point.expenses.toFixed(2)),
    net: Number((point.deposits - point.withdrawals - point.expenses).toFixed(2)),
  }));

  return {
    totalDeposits: Number(totalDeposits.toFixed(2)),
    totalWithdrawals: Number(totalWithdrawals.toFixed(2)),
    totalExpenses: Number(totalExpenses.toFixed(2)),
    netFlow: Number((totalDeposits - totalWithdrawals - totalExpenses).toFixed(2)),
    series,
    startDateIso: startDate.toISOString(),
    endDateIso: endDate.toISOString(),
    granularity,
  };
}

export async function GET(request: NextRequest) {
  try {
    await verifyAdmin(request);

    const range = (request.nextUrl.searchParams.get('range') as FinanceRange | null) || 'today';
    const rangeDays = getRangeDays(range);

    const [stats, finance] = await Promise.all([
      getDashboardStats(),
      getFinancialFlowAnalytics(rangeDays),
    ]);

    return NextResponse.json({ success: true, stats, finance });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    const status = message === 'Unauthorized request.' ? 401 : message === 'Forbidden.' ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}