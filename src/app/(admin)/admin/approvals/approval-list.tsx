
"use client";

import { useState, useEffect } from "react";
import { User } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getPendingApprovals } from "@/lib/database";
import { updateUserApprovalStatus, bulkUpdateUserApprovalStatus } from "@/lib/actions";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

const LoadingSkeleton = () => (
    <Table>
        <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"><Checkbox disabled /></TableHead>
              <TableHead>User</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {[...Array(3)].map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Checkbox disabled /></TableCell>
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
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{ action: 'approve' | 'reject', scope: 'all' } | null>(null);

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
    
    const handleBulkAction = async (ids: string[] | 'all', status: 'approved' | 'rejected') => {
        setIsBulkUpdating(true);
        try {
            const result = await bulkUpdateUserApprovalStatus(ids, status);
             if (result.success) {
                toast({ title: "Success", description: result.message });
                fetchApprovals(); // Refresh list
                setSelectedIds([]);
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "An unexpected error occurred during bulk update.", variant: "destructive" });
        } finally {
            setIsBulkUpdating(false);
            setConfirmAction(null);
            setIsConfirmOpen(false);
        }
    };
    
    const openConfirmDialog = (action: 'approve' | 'reject') => {
        setConfirmAction({ action, scope: 'all' });
        setIsConfirmOpen(true);
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(approvals.map(a => a.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        setSelectedIds(prev => 
            checked ? [...prev, id] : prev.filter(rowId => rowId !== id)
        );
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Pending Applications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
              <Button size="sm" onClick={() => handleBulkAction(selectedIds, 'approved')} disabled={selectedIds.length === 0 || isBulkUpdating || loading}>
                  Approve Selected ({selectedIds.length})
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleBulkAction(selectedIds, 'rejected')} disabled={selectedIds.length === 0 || isBulkUpdating || loading}>
                  Reject Selected ({selectedIds.length})
              </Button>
              <div className="ml-auto flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => openConfirmDialog('approve')} disabled={approvals.length === 0 || isBulkUpdating || loading}>
                      Approve All
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => openConfirmDialog('reject')} disabled={approvals.length === 0 || isBulkUpdating || loading}>
                      Reject All
                  </Button>
              </div>
          </div>
          {isBulkUpdating && <Loader2 className="h-5 w-5 animate-spin my-2" />}
          {loading ? <LoadingSkeleton /> : (
              <>
                  <Table>
                      <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">
                              <Checkbox
                                  checked={selectedIds.length === approvals.length && approvals.length > 0}
                                  onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                                  disabled={approvals.length === 0}
                                  aria-label="Select all"
                              />
                            </TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Score</TableHead>
                            <TableHead>Submitted</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {approvals.map((user) => (
                          <TableRow key={user.id} data-state={selectedIds.includes(user.id) ? "selected" : ""}>
                              <TableCell>
                                <Checkbox
                                    checked={selectedIds.includes(user.id)}
                                    onCheckedChange={(checked) => handleSelectRow(user.id, checked as boolean)}
                                    aria-label={`Select user ${user.name}`}
                                />
                              </TableCell>
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
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will {confirmAction?.action} ALL {approvals.length} pending applications. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleBulkAction('all', confirmAction!.action)}
              className={buttonVariants({ variant: confirmAction?.action === 'reject' ? 'destructive' : 'default' })}
            >
              Yes, {confirmAction?.action} all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
