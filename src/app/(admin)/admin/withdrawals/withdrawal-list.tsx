
"use client";

import { useState, useEffect } from "react";
import { WithdrawalRequest } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cancelWithdrawalRequest, updateWithdrawalRequestStatus } from "@/lib/admin-api";
import { getWithdrawalRequests } from "@/lib/database";

const statusColors: Record<WithdrawalRequest['status'], string> = {
  pending: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  completed: "bg-green-500/20 text-green-700 border-green-500/30",
  failed: "bg-red-500/20 text-red-700 border-red-500/30",
    canceled: "bg-slate-500/20 text-slate-700 border-slate-500/30",
};

const LoadingSkeleton = () => (
    <Table>
        <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
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
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-48 ml-auto" /></TableCell>
                </TableRow>
            ))}
        </TableBody>
    </Table>
)

function formatFieldValues(values?: Record<string, string>) {
    if (!values || Object.keys(values).length === 0) return 'N/A';
    return Object.entries(values)
        .slice(0, 3)
        .map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`)
        .join(' • ');
}

function extractReceiptUrl(req: WithdrawalRequest) {
    const checkValue = (value?: string) => {
        const trimmed = String(value || '').trim();
        if (!trimmed.startsWith('http')) return null;
        const lower = trimmed.toLowerCase();
        if (lower.includes('firebasestorage.googleapis.com') || lower.includes('storage.googleapis.com') || lower.includes('firebase')) {
            return trimmed;
        }
        return null;
    };

    if (req.fieldValues) {
        for (const value of Object.values(req.fieldValues)) {
            const hit = checkValue(value);
            if (hit) return hit;
        }
    }

    const details = String(req.paymentDetails || '');
    const matches = details.match(/https?:\/\/\S+/g) || [];
    for (const match of matches) {
        const hit = checkValue(match);
        if (hit) return hit;
    }

    return null;
}

export function WithdrawalList() {
    const { toast } = useToast();
    const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
    const [pendingAction, setPendingAction] = useState<{
      requestId: string;
      action: 'completed' | 'failed' | 'pending' | 'canceled';
      amount: number;
    } | null>(null);

    const fetchRequests = async () => {
      setLoading(true);
      try {
        const fetchedRequests = await getWithdrawalRequests();
        setRequests(fetchedRequests);
      } catch (error) {
        console.error("Failed to fetch withdrawal requests:", error);
        toast({ title: "Error", description: "Failed to load withdrawal requests.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    
    useEffect(() => {
        fetchRequests();
    }, []);
    
    const handleStatusChange = async (id: string, status: WithdrawalRequest['status']) => {
        setUpdatingId(id);
        const result = await updateWithdrawalRequestStatus(id, status);
        if (result.success) {
            toast({ title: "Success", description: result.message });
            fetchRequests(); // Refresh list
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setUpdatingId(null);
    };

    const handleCancelRequest = async (id: string) => {
        setUpdatingId(id);
        const result = await cancelWithdrawalRequest(id);
        if (result.success) {
            toast({ title: "Success", description: result.message });
            fetchRequests();
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setUpdatingId(null);
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'N/A';
        if (typeof timestamp === 'string') {
            return new Date(timestamp).toLocaleString();
        }
        if (timestamp && typeof timestamp.toDate === 'function') {
            return timestamp.toDate().toLocaleString();
        }
        return 'N/A';
    };

        const actionLabel = (action: 'completed' | 'failed' | 'pending' | 'canceled') => {
                if (action === 'completed') return 'approve';
                if (action === 'failed') return 'mark as failed';
                if (action === 'pending') return 'set to pending';
                return 'cancel';
        };

  return (
    <Card>
      <CardHeader>
                <CardTitle>Withdrawal Requests</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <LoadingSkeleton /> : (
            <>
                <Table>
                    <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Method</TableHead>
                                                    <TableHead>Submitted Data</TableHead>
                                                    <TableHead>Receipt</TableHead>
                          <TableHead>Date</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {requests.map((req) => (
                        <TableRow key={req.id}>
                            <TableCell className="font-medium">
                                <div>{req.userName}</div>
                                <div className="text-xs text-muted-foreground">{req.userEmail}</div>
                            </TableCell>
                            <TableCell>${req.amount.toFixed(2)}</TableCell>
                            <TableCell>{req.paymentMethod}</TableCell>
                            <TableCell className="max-w-xs">
                                <div className="text-xs text-muted-foreground line-clamp-2">{formatFieldValues(req.fieldValues)}</div>
                                <div className="text-xs text-muted-foreground line-clamp-2">{req.paymentDetails || 'N/A'}</div>
                            </TableCell>
                            <TableCell>
                                {extractReceiptUrl(req) ? (
                                    <Button type="button" variant="outline" size="sm" onClick={() => setReceiptUrl(extractReceiptUrl(req))}>
                                        View
                                    </Button>
                                ) : (
                                    <span className="text-xs text-muted-foreground">None</span>
                                )}
                            </TableCell>
                            <TableCell>{formatDate(req.requestedAt)}</TableCell>
                            <TableCell>
                                <Badge className={statusColors[req.status]}>{req.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                {updatingId === req.id ? (
                                    <div className="flex justify-end">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    </div>
                                ) : (
                                    <div className="flex justify-end items-center gap-2">
                                        <Button
                                            type="button"
                                            variant={req.status === 'completed' ? 'secondary' : 'default'}
                                            size="sm"
                                            disabled={req.status === 'completed'}
                                            onClick={() => setPendingAction({ requestId: req.id, action: 'completed', amount: Number(req.amount || 0) })}
                                        >
                                            Approve
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={req.status === 'pending' ? 'secondary' : 'outline'}
                                            size="sm"
                                            disabled={req.status === 'pending'}
                                            onClick={() => setPendingAction({ requestId: req.id, action: 'pending', amount: Number(req.amount || 0) })}
                                        >
                                            Pending
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={req.status === 'failed' ? 'secondary' : 'destructive'}
                                            size="sm"
                                            disabled={req.status === 'failed'}
                                            onClick={() => setPendingAction({ requestId: req.id, action: 'failed', amount: Number(req.amount || 0) })}
                                        >
                                            Fail
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={req.status === 'canceled' ? 'secondary' : 'outline'}
                                            size="sm"
                                            disabled={req.status === 'canceled'}
                                            onClick={() => setPendingAction({ requestId: req.id, action: 'canceled', amount: Number(req.amount || 0) })}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                )}
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {requests.length === 0 && (
                    <div className="text-center p-8 text-muted-foreground">
                        No withdrawal requests found.
                    </div>
                )}

                <Dialog open={Boolean(receiptUrl)} onOpenChange={(open) => {
                    if (!open) setReceiptUrl(null);
                }}>
                    <DialogContent className="sm:max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Withdrawal Receipt</DialogTitle>
                            <DialogDescription>Review uploaded proof before approving the request.</DialogDescription>
                        </DialogHeader>
                        {receiptUrl ? (
                            <div className="space-y-3">
                                <img src={receiptUrl} alt="Withdrawal receipt" className="max-h-[70vh] w-full rounded-md border object-contain" />
                            </div>
                        ) : null}
                    </DialogContent>
                </Dialog>

                <AlertDialog open={Boolean(pendingAction)} onOpenChange={(open) => {
                    if (!open) setPendingAction(null);
                }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirm Withdrawal Update</AlertDialogTitle>
                            <AlertDialogDescription>
                                {pendingAction
                                    ? `Are you sure you want to ${actionLabel(pendingAction.action)} this withdrawal request of $${pendingAction.amount.toFixed(2)}?`
                                    : 'Confirm this change.'}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={async () => {
                                    if (!pendingAction) return;
                                    if (pendingAction.action === 'canceled') {
                                        await handleCancelRequest(pendingAction.requestId);
                                    } else {
                                        await handleStatusChange(pendingAction.requestId, pendingAction.action);
                                    }
                                    setPendingAction(null);
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
