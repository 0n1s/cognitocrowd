
"use client";

import { useState, useEffect } from "react";
import { WithdrawalRequest } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateWithdrawalRequestStatus } from "@/lib/actions";
import { getWithdrawalRequests } from "@/lib/database";

const statusColors: Record<WithdrawalRequest['status'], string> = {
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
              <TableHead>Details</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                </TableRow>
            ))}
        </TableBody>
    </Table>
)

export function WithdrawalList() {
    const { toast } = useToast();
    const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Requests</CardTitle>
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
                          <TableHead>Details</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Status</TableHead>
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
                            <TableCell className="max-w-xs truncate">{req.paymentDetails}</TableCell>
                            <TableCell>{formatDate(req.requestedAt)}</TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end items-center">
                                    {updatingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                                        <Select value={req.status} onValueChange={(v) => handleStatusChange(req.id, v as any)}>
                                            <SelectTrigger className="w-[120px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="pending">Pending</SelectItem>
                                                <SelectItem value="completed">Completed</SelectItem>
                                                <SelectItem value="failed">Failed</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
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
            </>
        )}
      </CardContent>
    </Card>
  );
}
