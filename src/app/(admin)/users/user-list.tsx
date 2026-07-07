
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AdminUser, Package } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateAdminUser, deleteAdminUser } from "@/lib/admin-api";
import { getAdminUsers, getPackages } from "@/lib/database";

type EditUserDialogProps = {
  user: AdminUser;
  packages: Package[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated: () => void;
};

function EditUserDialog({ user, packages, open, onOpenChange, onUserUpdated }: EditUserDialogProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [role, setRole] = useState(user.role || 'user');
    const [packageId, setPackageId] = useState(user.packageId || 'null');
    const [earningsBalance, setEarningsBalance] = useState(user.earningsBalance);
    const [depositBalance, setDepositBalance] = useState(user.depositBalance);
    const [expertiseText, setExpertiseText] = useState((user.expertise || []).join(', '));

    const handleSubmit = async () => {
        setIsSubmitting(true);
        const result = await updateAdminUser(user.id, {
            role,
            packageId: packageId === 'null' ? null : packageId,
            earningsBalance,
            depositBalance,
            expertise: expertiseText
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean),
        });
        
        if (result.success) {
            toast({ title: "Success", description: result.message });
            onOpenChange(false);
            onUserUpdated();
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setIsSubmitting(false);
    };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">Edit User: {user.name}</DialogTitle>
          <DialogDescription>
            Update user role, package, and balances.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role" className="text-right">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="super_user_alpha_7">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="package" className="text-right">Package</Label>
             <Select value={packageId} onValueChange={setPackageId}>
                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="null">None (Free Tier)</SelectItem>
                    {packages.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="earnings" className="text-right">Earnings</Label>
            <Input id="earnings" type="number" value={earningsBalance} onChange={e => setEarningsBalance(Number(e.target.value))} className="col-span-3" />
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="deposits" className="text-right">Deposits</Label>
            <Input id="deposits" type="number" value={depositBalance} onChange={e => setDepositBalance(Number(e.target.value))} className="col-span-3" />
          </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="expertise" className="text-right pt-2">Expertise</Label>
              <div className="col-span-3 space-y-1">
                <Input
                  id="expertise"
                  value={expertiseText}
                  onChange={e => setExpertiseText(e.target.value)}
                  placeholder="General, Writing, Coding"
                />
                <p className="text-xs text-muted-foreground">Comma-separated expertise areas used for contribution matching.</p>
              </div>
            </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DeleteUserDialogProps = {
  user: AdminUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserDeleted: () => void;
};

function DeleteUserDialog({ user, open, onOpenChange, onUserDeleted }: DeleteUserDialogProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await deleteAdminUser(user.id);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      onUserDeleted();
      onOpenChange(false);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsDeleting(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the user record for "{user.name}". This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className={buttonVariants({ variant: "destructive" })}>
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete User
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const LoadingSkeleton = () => (
    <Table>
        <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Earnings</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-24" /></TableCell>
                </TableRow>
            ))}
        </TableBody>
    </Table>
)

export function UserList() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [packages, setPackages] = useState<Package[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
    const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);

    const fetchData = async () => {
      setLoading(true);
      try {
        const [fetchedUsers, fetchedPackages] = await Promise.all([
          getAdminUsers(),
          getPackages()
        ]);
        setUsers(fetchedUsers);
        setPackages(fetchedPackages);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    useEffect(() => {
        fetchData();
    }, []);

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString();
    };

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Users</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <LoadingSkeleton /> : (
            <>
                <Table>
                <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Earnings</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map((user) => (
                    <TableRow key={user.id}>
                        <TableCell className="font-medium">
                            <Link href={`/admin/users/${user.id}`} className="hover:underline">
                                {user.name}
                            </Link>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                        </TableCell>
                        <TableCell>
                            <Badge variant={user.role === 'admin' ? "default" : "secondary"}>{user.role === 'super_user_alpha_7' ? 'Admin' : 'User'}</Badge>
                        </TableCell>
                        <TableCell>{user.packageName}</TableCell>
                        <TableCell>${user.earningsBalance.toFixed(2)}</TableCell>
                        <TableCell>{formatDate(user.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setEditingUser(user)}>
                              <Edit className="h-3 w-3 mr-1"/> Edit
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeletingUser(user)}>
                               <Trash2 className="h-4 w-4" />
                               <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
                {users.length === 0 && (
                    <div className="text-center p-8 text-muted-foreground">
                        No users found.
                    </div>
                )}
            </>
        )}
      </CardContent>
       {editingUser && (
        <EditUserDialog
            user={editingUser}
            packages={packages}
            open={!!editingUser}
            onOpenChange={(open) => !open && setEditingUser(null)}
            onUserUpdated={() => {
                setEditingUser(null);
                fetchData();
            }}
        />
       )}
       {deletingUser && (
        <DeleteUserDialog
            user={deletingUser}
            open={!!deletingUser}
            onOpenChange={(open) => !open && setDeletingUser(null)}
            onUserDeleted={() => {
                setDeletingUser(null);
                fetchData();
            }}
        />
       )}
    </Card>
  );
}
