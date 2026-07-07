"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Deposit } from "@/lib/types";
import { getAllDeposits } from "@/lib/database";
import { updateDepositStatus } from "@/lib/admin-api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

const statusColors: Record<Deposit['status'], string> = {
  pending: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  completed: "bg-green-500/20 text-green-700 border-green-500/30",
  failed: "bg-red-500/20 text-red-700 border-red-500/30",
};

const LoadingSkeleton = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>User</TableHead>
        <TableHead>Amount</TableHead>
        <TableHead>Method</TableHead>
        <TableHead>Provider</TableHead>
        <TableHead>Submitted Data</TableHead>
        <TableHead>Receipt</TableHead>
        <TableHead>Date</TableHead>
        <TableHead>Status</TableHead>
        <TableHead className="text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {[...Array(5)].map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-5 w-36" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
          <TableCell><Skeleton className="h-5 w-44" /></TableCell>
          <TableCell><Skeleton className="h-8 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
          <TableCell><Skeleton className="h-6 w-20" /></TableCell>
          <TableCell><Skeleton className="h-8 w-48 ml-auto" /></TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

function formatDate(value: any) {
  if (!value) return 'N/A';
  if (typeof value === 'string') return new Date(value).toLocaleString();
  if (typeof value?.toDate === 'function') return value.toDate().toLocaleString();
  return 'N/A';
}

function formatFieldValues(values?: Record<string, string>) {
  if (!values || Object.keys(values).length === 0) return 'N/A';
  return Object.entries(values)
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`)
    .join(' • ');
}

function extractScreenshotUrl(values?: Record<string, string>) {
  if (!values) return null;
  for (const value of Object.values(values)) {
    const trimmed = String(value || '').trim();
    if (!trimmed.startsWith('http')) continue;
    const lower = trimmed.toLowerCase();
    if (lower.includes('firebasestorage.googleapis.com') || lower.includes('storage.googleapis.com') || lower.includes('firebase')) {
      return trimmed;
    }
  }
  return null;
}

function statusActionLabel(status: Deposit['status']) {
  if (status === 'completed') return 'Approve';
  if (status === 'failed') return 'Mark Failed';
  return 'Set Pending';
}

export function DepositList() {
  const { toast } = useToast();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    depositId: string;
    nextStatus: Deposit['status'];
    amount: number;
  } | null>(null);

  const fetchDeposits = async () => {
    setLoading(true);
    try {
      const fetched = await getAllDeposits();
      setDeposits(fetched);
    } catch (error) {
      console.error('Failed to fetch deposits:', error);
      toast({ title: 'Error', description: 'Failed to load deposits.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeposits();
  }, []);

  const applyStatusChange = async (depositId: string, status: Deposit['status']) => {
    setUpdatingId(depositId);
    const result = await updateDepositStatus(depositId, status);
    if (result.success) {
      toast({ title: 'Success', description: result.message });
      await fetchDeposits();
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive' });
    }
    setUpdatingId(null);
  };

  const requestStatusChange = (depositId: string, nextStatus: Deposit['status'], amount: number) => {
    setPendingStatusChange({ depositId, nextStatus, amount });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deposit Requests</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Submitted Data</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deposits.map((deposit) => (
                  <TableRow key={deposit.id}>
                    <TableCell className="font-medium">
                      <div>{deposit.userName || deposit.userId}</div>
                      <div className="text-xs text-muted-foreground">{deposit.userEmail || deposit.userId}</div>
                    </TableCell>
                    <TableCell>${Number(deposit.amount || 0).toFixed(2)}</TableCell>
                    <TableCell>{deposit.method || 'N/A'}</TableCell>
                    <TableCell>{deposit.depositMethodProvider || deposit.externalProvider || 'N/A'}</TableCell>
                    <TableCell className="max-w-md">
                      <div className="text-xs text-muted-foreground line-clamp-2">{formatFieldValues(deposit.fieldValues)}</div>
                      {deposit.externalInvoiceUrl ? (
                        <Link href={deposit.externalInvoiceUrl} target="_blank" className="text-xs text-primary hover:underline">
                          Open invoice
                        </Link>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {extractScreenshotUrl(deposit.fieldValues) ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setScreenshotUrl(extractScreenshotUrl(deposit.fieldValues))}
                        >
                          View
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(deposit.createdAt)}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[deposit.status]}>{deposit.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {updatingId === deposit.id ? (
                        <div className="flex justify-end">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : (
                        <div className="flex justify-end items-center gap-2">
                          <Button
                            type="button"
                            variant={deposit.status === 'completed' ? 'secondary' : 'default'}
                            size="sm"
                            disabled={deposit.status === 'completed'}
                            onClick={() => requestStatusChange(deposit.id, 'completed', Number(deposit.amount || 0))}
                          >
                            Approve
                          </Button>
                          <Button
                            type="button"
                            variant={deposit.status === 'pending' ? 'secondary' : 'outline'}
                            size="sm"
                            disabled={deposit.status === 'pending'}
                            onClick={() => requestStatusChange(deposit.id, 'pending', Number(deposit.amount || 0))}
                          >
                            Pending
                          </Button>
                          <Button
                            type="button"
                            variant={deposit.status === 'failed' ? 'secondary' : 'destructive'}
                            size="sm"
                            disabled={deposit.status === 'failed'}
                            onClick={() => requestStatusChange(deposit.id, 'failed', Number(deposit.amount || 0))}
                          >
                            Fail
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {deposits.length === 0 && (
              <div className="text-center p-8 text-muted-foreground">No deposits found.</div>
            )}

            <Dialog open={Boolean(screenshotUrl)} onOpenChange={(open) => {
              if (!open) setScreenshotUrl(null);
            }}>
              <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Receipt Screenshot</DialogTitle>
                  <DialogDescription>Review the uploaded proof before updating status.</DialogDescription>
                </DialogHeader>
                {screenshotUrl ? (
                  <div className="space-y-3">
                    <img
                      src={screenshotUrl}
                      alt="Deposit receipt screenshot"
                      className="max-h-[70vh] w-full rounded-md border object-contain"
                    />
                    <div>
                      <Link href={screenshotUrl} target="_blank" className="text-sm text-primary hover:underline">
                        Open original in new tab
                      </Link>
                    </div>
                  </div>
                ) : null}
              </DialogContent>
            </Dialog>

            <AlertDialog open={Boolean(pendingStatusChange)} onOpenChange={(open) => {
              if (!open) setPendingStatusChange(null);
            }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Status Update</AlertDialogTitle>
                  <AlertDialogDescription>
                    {pendingStatusChange
                      ? `Are you sure you want to ${statusActionLabel(pendingStatusChange.nextStatus).toLowerCase()} this deposit of $${pendingStatusChange.amount.toFixed(2)}?`
                      : 'Confirm this status change.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      if (!pendingStatusChange) return;
                      await applyStatusChange(pendingStatusChange.depositId, pendingStatusChange.nextStatus);
                      setPendingStatusChange(null);
                    }}
                  >
                    Confirm
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </CardContent>
    </Card>
  );
}
