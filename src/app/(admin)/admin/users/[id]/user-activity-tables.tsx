"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Deposit, PackagePurchase, Task, TaskResponse, WithdrawalRequest } from "@/lib/types";

type DatePreset = "all" | "today" | "yesterday" | "this_week" | "this_month" | "this_year";

const PAGE_SIZE = 8;

type FinancialTransaction = {
  id: string;
  type: "deposit" | "withdrawal" | "package_purchase" | "referral_bonus" | "contribution_reward";
  description: string;
  amountUsd: number;
  status: string;
  createdAt: string | null;
};

type ReferralRow = {
  id: string;
  name: string;
  email: string;
  packageName: string;
  firstDepositAmount: number | null;
  bonus: number;
  status: string;
  signupDate: string | null;
  suspicious: boolean;
};

type ReferralTransactionRow = {
  id: string;
  depositAmount: number;
  totalBonus: number;
  status: string;
  reason: string;
  createdAt: string | null;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleDateString();
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleString();
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isWithinDatePreset(value: string | null | undefined, preset: DatePreset): boolean {
  if (preset === "all") return true;
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  const todayStart = startOfDay(now);

  if (preset === "today") {
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    return date >= todayStart && date < tomorrowStart;
  }

  if (preset === "yesterday") {
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    return date >= yesterdayStart && date < todayStart;
  }

  if (preset === "this_week") {
    const weekStart = new Date(todayStart);
    const dayOfWeek = weekStart.getDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    weekStart.setDate(weekStart.getDate() - daysSinceMonday);
    const nextWeekStart = new Date(weekStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    return date >= weekStart && date < nextWeekStart;
  }

  if (preset === "this_month") {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return date >= monthStart && date < nextMonthStart;
  }

  const yearStart = new Date(now.getFullYear(), 0, 1);
  const nextYearStart = new Date(now.getFullYear() + 1, 0, 1);
  return date >= yearStart && date < nextYearStart;
}

function matchesSearch(query: string, haystack: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  return haystack.toLowerCase().includes(trimmed);
}

function TableControls({
  search,
  onSearchChange,
  datePreset,
  onDatePresetChange,
  searchPlaceholder,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  datePreset: DatePreset;
  onDatePresetChange: (value: DatePreset) => void;
  searchPlaceholder: string;
}) {
  return (
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
        className="sm:max-w-sm"
      />
      <Select value={datePreset} onValueChange={(value) => onDatePresetChange(value as DatePreset)}>
        <SelectTrigger className="w-full sm:w-[190px]">
          <SelectValue placeholder="Filter by date" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Time</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="yesterday">Yesterday</SelectItem>
          <SelectItem value="this_week">This Week</SelectItem>
          <SelectItem value="this_month">This Month</SelectItem>
          <SelectItem value="this_year">This Year</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function PaginationControls({
  page,
  totalPages,
  totalItems,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalItems === 0) return null;

  return (
    <div className="mt-4 flex items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">
        Showing page {page} of {totalPages} ({totalItems} results)
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={page <= 1}>
          Previous
        </Button>
        <Button variant="outline" size="sm" onClick={onNext} disabled={page >= totalPages}>
          Next
        </Button>
      </div>
    </div>
  );
}

export function UserActivityTables({
  deposits,
  withdrawals,
  packagePurchases,
  referralTransactions,
  taskResponses,
  referrals,
  completedTasks,
}: {
  deposits: Deposit[];
  withdrawals: WithdrawalRequest[];
  packagePurchases: PackagePurchase[];
  referralTransactions: ReferralTransactionRow[];
  taskResponses: TaskResponse[];
  referrals: ReferralRow[];
  completedTasks: Task[];
}) {
  const financialRows = useMemo<FinancialTransaction[]>(() => {
    return [
      ...deposits.map((item) => ({
        id: `dep_${item.id}`,
        type: "deposit" as const,
        description: `Deposit via ${item.method}`,
        amountUsd: Number(item.amountUsd ?? item.amount ?? 0),
        status: String(item.status || "pending"),
        createdAt: item.createdAt ? String(item.createdAt) : null,
      })),
      ...withdrawals.map((item) => ({
        id: `wd_${item.id}`,
        type: "withdrawal" as const,
        description: `Withdrawal via ${item.paymentMethod}`,
        amountUsd: -Math.abs(Number(item.amountUsd ?? item.amount ?? 0)),
        status: String(item.status || "pending"),
        createdAt: item.requestedAt ? String(item.requestedAt) : null,
      })),
      ...packagePurchases.map((item) => ({
        id: `pkg_${item.id}`,
        type: "package_purchase" as const,
        description: `Package purchase: ${item.packageName}`,
        amountUsd: -Math.abs(Number(item.amountUsd ?? item.amount ?? 0)),
        status: String(item.status || "completed"),
        createdAt: item.createdAt ? String(item.createdAt) : null,
      })),
      ...referralTransactions.map((item) => ({
        id: `ref_${item.id}`,
        type: "referral_bonus" as const,
        description: item.reason || "Referral bonus",
        amountUsd: Number(item.totalBonus || 0),
        status: String(item.status || "pending"),
        createdAt: item.createdAt,
      })),
      ...taskResponses.map((item) => ({
        id: `task_${item.id}`,
        type: "contribution_reward" as const,
        description: "Contribution reward",
        amountUsd: Number(item.pointsEarned || 0) / 100,
        status: "completed",
        createdAt: item.submittedAt ? String(item.submittedAt) : null,
      })),
    ].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [deposits, withdrawals, packagePurchases, referralTransactions, taskResponses]);

  const [financialSearch, setFinancialSearch] = useState("");
  const [financialDatePreset, setFinancialDatePreset] = useState<DatePreset>("all");
  const [financialPage, setFinancialPage] = useState(1);

  const filteredFinancialRows = useMemo(() => {
    return financialRows.filter((item) => {
      const searchable = [item.type, item.description, item.status, String(item.amountUsd), formatDateTime(item.createdAt)].join(" ");
      return matchesSearch(financialSearch, searchable) && isWithinDatePreset(item.createdAt, financialDatePreset);
    });
  }, [financialRows, financialSearch, financialDatePreset]);

  const financialTotalPages = Math.max(1, Math.ceil(filteredFinancialRows.length / PAGE_SIZE));
  const clampedFinancialPage = Math.min(financialPage, financialTotalPages);
  const paginatedFinancialRows = filteredFinancialRows.slice((clampedFinancialPage - 1) * PAGE_SIZE, clampedFinancialPage * PAGE_SIZE);

  useEffect(() => {
    setFinancialPage(1);
  }, [financialSearch, financialDatePreset]);

  useEffect(() => {
    if (financialPage > financialTotalPages) {
      setFinancialPage(financialTotalPages);
    }
  }, [financialPage, financialTotalPages]);

  const [referralsSearch, setReferralsSearch] = useState("");
  const [referralsDatePreset, setReferralsDatePreset] = useState<DatePreset>("all");
  const [referralsPage, setReferralsPage] = useState(1);

  const filteredReferrals = useMemo(() => {
    return referrals.filter((item) => {
      const searchable = [
        item.name,
        item.email,
        item.packageName,
        item.status,
        item.firstDepositAmount == null ? "none" : String(item.firstDepositAmount),
        String(item.bonus),
      ].join(" ");
      return matchesSearch(referralsSearch, searchable) && isWithinDatePreset(item.signupDate, referralsDatePreset);
    });
  }, [referrals, referralsSearch, referralsDatePreset]);

  const referralsTotalPages = Math.max(1, Math.ceil(filteredReferrals.length / PAGE_SIZE));
  const clampedReferralsPage = Math.min(referralsPage, referralsTotalPages);
  const paginatedReferrals = filteredReferrals.slice((clampedReferralsPage - 1) * PAGE_SIZE, clampedReferralsPage * PAGE_SIZE);

  useEffect(() => {
    setReferralsPage(1);
  }, [referralsSearch, referralsDatePreset]);

  useEffect(() => {
    if (referralsPage > referralsTotalPages) {
      setReferralsPage(referralsTotalPages);
    }
  }, [referralsPage, referralsTotalPages]);

  const [referralLogsSearch, setReferralLogsSearch] = useState("");
  const [referralLogsDatePreset, setReferralLogsDatePreset] = useState<DatePreset>("all");
  const [referralLogsPage, setReferralLogsPage] = useState(1);

  const filteredReferralLogs = useMemo(() => {
    return referralTransactions.filter((item) => {
      const searchable = [item.status, item.reason, String(item.depositAmount), String(item.totalBonus)].join(" ");
      return matchesSearch(referralLogsSearch, searchable) && isWithinDatePreset(item.createdAt, referralLogsDatePreset);
    });
  }, [referralTransactions, referralLogsSearch, referralLogsDatePreset]);

  const referralLogsTotalPages = Math.max(1, Math.ceil(filteredReferralLogs.length / PAGE_SIZE));
  const clampedReferralLogsPage = Math.min(referralLogsPage, referralLogsTotalPages);
  const paginatedReferralLogs = filteredReferralLogs.slice((clampedReferralLogsPage - 1) * PAGE_SIZE, clampedReferralLogsPage * PAGE_SIZE);

  useEffect(() => {
    setReferralLogsPage(1);
  }, [referralLogsSearch, referralLogsDatePreset]);

  useEffect(() => {
    if (referralLogsPage > referralLogsTotalPages) {
      setReferralLogsPage(referralLogsTotalPages);
    }
  }, [referralLogsPage, referralLogsTotalPages]);

  const [withdrawalsSearch, setWithdrawalsSearch] = useState("");
  const [withdrawalsDatePreset, setWithdrawalsDatePreset] = useState<DatePreset>("all");
  const [withdrawalsPage, setWithdrawalsPage] = useState(1);

  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter((item) => {
      const searchable = [item.paymentMethod, item.status, String(item.amountUsd ?? item.amount ?? 0), formatDateTime(item.requestedAt)].join(" ");
      return matchesSearch(withdrawalsSearch, searchable) && isWithinDatePreset(item.requestedAt ? String(item.requestedAt) : null, withdrawalsDatePreset);
    });
  }, [withdrawals, withdrawalsSearch, withdrawalsDatePreset]);

  const withdrawalsTotalPages = Math.max(1, Math.ceil(filteredWithdrawals.length / PAGE_SIZE));
  const clampedWithdrawalsPage = Math.min(withdrawalsPage, withdrawalsTotalPages);
  const paginatedWithdrawals = filteredWithdrawals.slice((clampedWithdrawalsPage - 1) * PAGE_SIZE, clampedWithdrawalsPage * PAGE_SIZE);

  useEffect(() => {
    setWithdrawalsPage(1);
  }, [withdrawalsSearch, withdrawalsDatePreset]);

  useEffect(() => {
    if (withdrawalsPage > withdrawalsTotalPages) {
      setWithdrawalsPage(withdrawalsTotalPages);
    }
  }, [withdrawalsPage, withdrawalsTotalPages]);

  const [depositsSearch, setDepositsSearch] = useState("");
  const [depositsDatePreset, setDepositsDatePreset] = useState<DatePreset>("all");
  const [depositsPage, setDepositsPage] = useState(1);

  const filteredDeposits = useMemo(() => {
    return deposits.filter((item) => {
      const searchable = [item.method, item.status, String(item.amountUsd ?? item.amount ?? 0), formatDateTime(item.createdAt)].join(" ");
      return matchesSearch(depositsSearch, searchable) && isWithinDatePreset(item.createdAt ? String(item.createdAt) : null, depositsDatePreset);
    });
  }, [deposits, depositsSearch, depositsDatePreset]);

  const depositsTotalPages = Math.max(1, Math.ceil(filteredDeposits.length / PAGE_SIZE));
  const clampedDepositsPage = Math.min(depositsPage, depositsTotalPages);
  const paginatedDeposits = filteredDeposits.slice((clampedDepositsPage - 1) * PAGE_SIZE, clampedDepositsPage * PAGE_SIZE);

  useEffect(() => {
    setDepositsPage(1);
  }, [depositsSearch, depositsDatePreset]);

  useEffect(() => {
    if (depositsPage > depositsTotalPages) {
      setDepositsPage(depositsTotalPages);
    }
  }, [depositsPage, depositsTotalPages]);

  const [completedTasksSearch, setCompletedTasksSearch] = useState("");
  const [completedTasksDatePreset, setCompletedTasksDatePreset] = useState<DatePreset>("all");
  const [completedTasksPage, setCompletedTasksPage] = useState(1);

  const filteredCompletedTasks = useMemo(() => {
    return completedTasks.filter((item) => {
      const searchable = [item.title, item.type, String(item.points)].join(" ");
      const createdAt = item.createdAt ? String(item.createdAt) : null;
      return matchesSearch(completedTasksSearch, searchable) && isWithinDatePreset(createdAt, completedTasksDatePreset);
    });
  }, [completedTasks, completedTasksSearch, completedTasksDatePreset]);

  const completedTasksTotalPages = Math.max(1, Math.ceil(filteredCompletedTasks.length / PAGE_SIZE));
  const clampedCompletedTasksPage = Math.min(completedTasksPage, completedTasksTotalPages);
  const paginatedCompletedTasks = filteredCompletedTasks.slice((clampedCompletedTasksPage - 1) * PAGE_SIZE, clampedCompletedTasksPage * PAGE_SIZE);

  useEffect(() => {
    setCompletedTasksPage(1);
  }, [completedTasksSearch, completedTasksDatePreset]);

  useEffect(() => {
    if (completedTasksPage > completedTasksTotalPages) {
      setCompletedTasksPage(completedTasksTotalPages);
    }
  }, [completedTasksPage, completedTasksTotalPages]);

  const getTypeLabel = (type: FinancialTransaction["type"]) => {
    if (type === "deposit") return "Deposit";
    if (type === "withdrawal") return "Withdrawal";
    if (type === "package_purchase") return "Package Purchase";
    if (type === "referral_bonus") return "Referral Bonus";
    return "Contribution Reward";
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>All Financial Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <TableControls
            search={financialSearch}
            onSearchChange={setFinancialSearch}
            datePreset={financialDatePreset}
            onDatePresetChange={setFinancialDatePreset}
            searchPlaceholder="Search type, status, description, amount"
          />
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
              {paginatedFinancialRows.length > 0 ? (
                paginatedFinancialRows.map((item) => {
                  const isCredit = item.amountUsd >= 0;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTypeLabel(item.type)}</Badge>
                      </TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === "completed" || item.status === "credited" ? "secondary" : "outline"}>{item.status}</Badge>
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${isCredit ? "text-green-600" : "text-red-600"}`}>
                        {isCredit ? "+" : "-"}${Math.abs(item.amountUsd).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">No transactions found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <PaginationControls
            page={clampedFinancialPage}
            totalPages={financialTotalPages}
            totalItems={filteredFinancialRows.length}
            onPrev={() => setFinancialPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setFinancialPage((prev) => Math.min(financialTotalPages, prev + 1))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Referral Program</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <TableControls
              search={referralsSearch}
              onSearchChange={setReferralsSearch}
              datePreset={referralsDatePreset}
              onDatePresetChange={setReferralsDatePreset}
              searchPlaceholder="Search referred users, email, package, status"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referred user</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>First deposit</TableHead>
                  <TableHead>Bonus</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Signup</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedReferrals.length > 0 ? (
                  paginatedReferrals.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.name}</span>
                          {item.suspicious ? <Badge variant="destructive">Review</Badge> : null}
                        </div>
                        <div className="text-xs text-muted-foreground">{item.email}</div>
                      </TableCell>
                      <TableCell>{item.packageName}</TableCell>
                      <TableCell>{item.firstDepositAmount == null ? "None" : `$${item.firstDepositAmount.toFixed(2)}`}</TableCell>
                      <TableCell>${item.bonus.toFixed(2)}</TableCell>
                      <TableCell><Badge variant="outline">{item.status}</Badge></TableCell>
                      <TableCell>{formatDate(item.signupDate)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">No referred users.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <PaginationControls
              page={clampedReferralsPage}
              totalPages={referralsTotalPages}
              totalItems={filteredReferrals.length}
              onPrev={() => setReferralsPage((prev) => Math.max(1, prev - 1))}
              onNext={() => setReferralsPage((prev) => Math.min(referralsTotalPages, prev + 1))}
            />
          </div>

          <div>
            <h3 className="mb-2 font-semibold">Referral transaction logs</h3>
            <TableControls
              search={referralLogsSearch}
              onSearchChange={setReferralLogsSearch}
              datePreset={referralLogsDatePreset}
              onDatePresetChange={setReferralLogsDatePreset}
              searchPlaceholder="Search reason, status, bonus, deposit"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Deposit</TableHead>
                  <TableHead>Bonus</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedReferralLogs.length > 0 ? (
                  paginatedReferralLogs.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{formatDate(item.createdAt)}</TableCell>
                      <TableCell>${item.depositAmount.toFixed(2)}</TableCell>
                      <TableCell>${item.totalBonus.toFixed(2)}</TableCell>
                      <TableCell><Badge variant="outline">{item.status}</Badge></TableCell>
                      <TableCell>{item.reason || "Automatic referral bonus"}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">No referral transactions.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <PaginationControls
              page={clampedReferralLogsPage}
              totalPages={referralLogsTotalPages}
              totalItems={filteredReferralLogs.length}
              onPrev={() => setReferralLogsPage((prev) => Math.max(1, prev - 1))}
              onNext={() => setReferralLogsPage((prev) => Math.min(referralLogsTotalPages, prev + 1))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Withdrawal History</CardTitle>
        </CardHeader>
        <CardContent>
          <TableControls
            search={withdrawalsSearch}
            onSearchChange={setWithdrawalsSearch}
            datePreset={withdrawalsDatePreset}
            onDatePresetChange={setWithdrawalsDatePreset}
            searchPlaceholder="Search method, status, amount"
          />
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
              {paginatedWithdrawals.length > 0 ? (
                paginatedWithdrawals.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{formatDate(item.requestedAt ? String(item.requestedAt) : null)}</TableCell>
                    <TableCell>${Number(item.amount).toFixed(2)}</TableCell>
                    <TableCell>{item.paymentMethod}</TableCell>
                    <TableCell className="text-right"><Badge variant="outline">{item.status}</Badge></TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">No withdrawal requests found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <PaginationControls
            page={clampedWithdrawalsPage}
            totalPages={withdrawalsTotalPages}
            totalItems={filteredWithdrawals.length}
            onPrev={() => setWithdrawalsPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setWithdrawalsPage((prev) => Math.min(withdrawalsTotalPages, prev + 1))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deposit History</CardTitle>
        </CardHeader>
        <CardContent>
          <TableControls
            search={depositsSearch}
            onSearchChange={setDepositsSearch}
            datePreset={depositsDatePreset}
            onDatePresetChange={setDepositsDatePreset}
            searchPlaceholder="Search method, status, amount"
          />
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
              {paginatedDeposits.length > 0 ? (
                paginatedDeposits.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{formatDate(item.createdAt ? String(item.createdAt) : null)}</TableCell>
                    <TableCell>${Number(item.amount).toFixed(2)}</TableCell>
                    <TableCell>{item.method}</TableCell>
                    <TableCell className="text-right"><Badge variant="outline">{item.status}</Badge></TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">No deposit history found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <PaginationControls
            page={clampedDepositsPage}
            totalPages={depositsTotalPages}
            totalItems={filteredDeposits.length}
            onPrev={() => setDepositsPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setDepositsPage((prev) => Math.min(depositsTotalPages, prev + 1))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Completed Contributions</CardTitle>
        </CardHeader>
        <CardContent>
          <TableControls
            search={completedTasksSearch}
            onSearchChange={setCompletedTasksSearch}
            datePreset={completedTasksDatePreset}
            onDatePresetChange={setCompletedTasksDatePreset}
            searchPlaceholder="Search title, type, points"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedCompletedTasks.length > 0 ? (
                paginatedCompletedTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>{task.title}</TableCell>
                    <TableCell>{task.type}</TableCell>
                    <TableCell>{formatDate(task.createdAt ? String(task.createdAt) : null)}</TableCell>
                    <TableCell className="text-right">{task.points}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">No contributions completed yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <PaginationControls
            page={clampedCompletedTasksPage}
            totalPages={completedTasksTotalPages}
            totalItems={filteredCompletedTasks.length}
            onPrev={() => setCompletedTasksPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setCompletedTasksPage((prev) => Math.min(completedTasksTotalPages, prev + 1))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
