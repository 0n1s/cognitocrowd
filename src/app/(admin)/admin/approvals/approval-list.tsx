
"use client";

import { useState, useEffect } from "react";
import { User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getPendingApprovals } from "@/lib/database";
import { updateUserApprovalStatus } from "@/lib/actions";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

const LoadingSkeleton = () => (
    <Table>
        <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {[...Array(3)].map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-9 w-40" /></TableCell>
                </TableRow>
            ))}
        </TableBody>
    </Table>
);

export function ApprovalList() {
    const { toast } = useToast();
    const [approvals, setApprovals] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const fetchApprovals = async () => {
      setLoading(true);
      try {
        const fetchedApprovals = await getPendingApprovals();
        setApprovals(fetchedApprovals);
      } catch (error) {
        console.error("Failed to fetch pending approvals:", error);
        toast({ title: "Error", description: "Failed to load approval requests.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    
    useEffect(() => {
        fetchApprovals();
    }, []);
    
    const handleApproval = async (userId: string, status: 'approved' | 'rejected') => {
        setUpdatingId(userId);
        try {
            const result = await updateUserApprovalStatus(userId, status);
            if (result.success) {
                toast({ title: "Success", description: `User has been ${status}.` });
                fetchApprovals(); // Refresh list
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        } catch (error) {
             toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
        } finally {
            setUpdatingId(null);
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Applications</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <LoadingSkeleton /> : (
            <>
                <Table>
                    <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {approvals.map((user) => (
                        <TableRow key={user.id}>
                            <TableCell className="font-medium">
                                <Link href={`/admin/users/${user.id}`} className="hover:underline">
                                    {user.name}
                                </Link>
                                <div className="text-xs text-muted-foreground">{user.email}</div>
                            </TableCell>
                            <TableCell>
                                <Badge variant={user.qualificationScore && user.qualificationScore >= 70 ? 'secondary' : 'destructive'}>
                                    {user.qualificationScore?.toFixed(0) || 'N/A'}%
                                </Badge>
                            </TableCell>
                            <TableCell>{formatDate(user.qualificationTestSubmittedAt)}</TableCell>
                            <TableCell className="text-right">
                                {updatingId === user.id ? <Loader2 className="h-4 w-4 animate-spin ml-auto" /> : (
                                    <div className="flex justify-end items-center gap-2">
                                        <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleApproval(user.id, 'rejected')}>
                                            <X className="mr-1 h-4 w-4" /> Reject
                                        </Button>
                                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleApproval(user.id, 'approved')}>
                                            <Check className="mr-1 h-4 w-4" /> Approve
                                        </Button>
                                    </div>
                                )}
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {approvals.length === 0 && (
                    <div className="text-center p-8 text-muted-foreground">
                        There are no pending applications to review.
                    </div>
                )}
            </>
        )}
      </CardContent>
    </Card>
  );
}
