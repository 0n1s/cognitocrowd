
"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Trash2, Edit, RefreshCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateAdminUser, deleteAdminUser, clearAdminUserTransactions } from "@/lib/admin-api";
import { getAdminUsers, getPackages } from "@/lib/database";

const BASE_EXPERTISE_OPTIONS = [
  'General Knowledge',
  'Mathematics',
  'Science (Physics, Chemistry, Biology)',
  'Software Development & Code',
  'History & Humanities',
  'Creative Writing & Literature',
  'Art & Design',
  'Business & Finance',
  'Health & Medicine',
];

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
    const [selectedExpertise, setSelectedExpertise] = useState<string[]>(user.expertise || []);
    const expertiseOptions = Array.from(new Set([...BASE_EXPERTISE_OPTIONS, ...(user.expertise || [])]));

    const toggleExpertise = (expertise: string) => {
      setSelectedExpertise((prev) =>
        prev.includes(expertise)
          ? prev.filter((item) => item !== expertise)
          : [...prev, expertise]
      );
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        const result = await updateAdminUser(user.id, {
            role,
            packageId: packageId === 'null' ? null : packageId,
            earningsBalance,
            depositBalance,
          expertise: selectedExpertise,
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
                    <SelectItem value="null">(No Package)</SelectItem>
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
              <Label className="text-right pt-1">Expertise</Label>
              <div className="col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {expertiseOptions.map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={`list-expertise-${option}`}
                      checked={selectedExpertise.includes(option)}
                      onCheckedChange={() => toggleExpertise(option)}
                    />
                    <Label htmlFor={`list-expertise-${option}`} className="font-normal text-sm">{option}</Label>
                  </div>
                ))}
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
            This will permanently delete the account for "{user.name}", including their sign-in access. This action cannot be undone.
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

type ClearTransactionsDialogProps = {
  user: AdminUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated: () => void;
};

function ClearTransactionsDialog({ user, open, onOpenChange, onUserUpdated }: ClearTransactionsDialogProps) {
  const { toast } = useToast();
  const [isClearing, setIsClearing] = useState(false);

  const handleClear = async () => {
    setIsClearing(true);
    const result = await clearAdminUserTransactions(user.id);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      onUserUpdated();
      onOpenChange(false);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsClearing(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear User Transactions?</AlertDialogTitle>
          <AlertDialogDescription>
            This will clear transactions and activity history for "{user.name}" (responses, withdrawals, deposits, generated media, chats) and reset usage counters. The account will remain active.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleClear} disabled={isClearing} className={buttonVariants({ variant: "destructive" })}>
            {isClearing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Clear Transactions
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
        <TableHead>Country</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Package</TableHead>
        <TableHead>Balances</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
          <TableCell className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </TableCell>
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
    const [clearingUser, setClearingUser] = useState<AdminUser | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [packageFilter, setPackageFilter] = useState('all');
    const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'super_user_alpha_7'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [registrationIpFilter, setRegistrationIpFilter] = useState('');
    const [minEarnings, setMinEarnings] = useState('');
    const [maxEarnings, setMaxEarnings] = useState('');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'earnings_desc' | 'earnings_asc' | 'name_asc'>('newest');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

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

    const formatExpiryDate = (value: any) => {
      if (!value) return 'N/A';
      if (typeof value?.toDate === 'function') {
        return value.toDate().toLocaleDateString();
      }
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleDateString();
    };

  const filteredUsers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const normalizedRegistrationIp = registrationIpFilter.trim().toLowerCase();
    const min = minEarnings.trim() === '' ? Number.NEGATIVE_INFINITY : Number(minEarnings);
    const max = maxEarnings.trim() === '' ? Number.POSITIVE_INFINITY : Number(maxEarnings);

    const base = users.filter((user) => {
      const matchesSearch = !normalizedQuery || user.name.toLowerCase().includes(normalizedQuery) || user.email.toLowerCase().includes(normalizedQuery);
      const matchesPackage = packageFilter === 'all'
        ? true
        : packageFilter === 'none'
        ? !user.packageId
        : user.packageId === packageFilter;
      const matchesRole = roleFilter === 'all' ? true : user.role === roleFilter;
      const userStatus = (user.onboardingStatus || 'pending') as 'pending' | 'approved' | 'rejected';
      const matchesStatus = statusFilter === 'all' ? true : userStatus === statusFilter;
      const ipSources = [
        String(user.registrationIp || '').toLowerCase(),
        String(user.ipAddress || '').toLowerCase(),
        ...(Array.isArray(user.ipHistory) ? user.ipHistory.map((item) => String(item).toLowerCase()) : []),
      ];
      const matchesRegistrationIp = !normalizedRegistrationIp || ipSources.some((value) => value.includes(normalizedRegistrationIp));
      const earnings = Number(user.earningsBalance || 0);
      const matchesEarnings = earnings >= min && earnings <= max;

      return matchesSearch && matchesPackage && matchesRole && matchesStatus && matchesRegistrationIp && matchesEarnings;
    });

    return [...base].sort((a, b) => {
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'earnings_asc') return (a.earningsBalance || 0) - (b.earningsBalance || 0);
      if (sortBy === 'earnings_desc') return (b.earningsBalance || 0) - (a.earningsBalance || 0);

      const aDate = Date.parse(String(a.createdAt || '')) || 0;
      const bDate = Date.parse(String(b.createdAt || '')) || 0;
      return sortBy === 'oldest' ? aDate - bDate : bDate - aDate;
    });
  }, [users, searchQuery, packageFilter, roleFilter, statusFilter, registrationIpFilter, minEarnings, maxEarnings, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, packageFilter, roleFilter, statusFilter, registrationIpFilter, minEarnings, maxEarnings, sortBy, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedUsers = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, safePage, pageSize]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Users</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <LoadingSkeleton /> : (
            <>
                <div className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <Label htmlFor="users-search">Search by Name / Email</Label>
                    <Input id="users-search" placeholder="Type a name or email" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="users-package-filter">Package</Label>
                    <Select value={packageFilter} onValueChange={setPackageFilter}>
                      <SelectTrigger id="users-package-filter"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Packages</SelectItem>
                        <SelectItem value="none">No Package</SelectItem>
                        {packages.map((pkg) => (
                          <SelectItem key={pkg.id} value={pkg.id}>{pkg.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="users-role-filter">Role</Label>
                    <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as 'all' | 'user' | 'super_user_alpha_7')}>
                      <SelectTrigger id="users-role-filter"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="super_user_alpha_7">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="users-status-filter">Onboarding Status</Label>
                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | 'pending' | 'approved' | 'rejected')}>
                      <SelectTrigger id="users-status-filter"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="users-registration-ip-filter">Registration IP</Label>
                    <Input
                      id="users-registration-ip-filter"
                      placeholder="e.g. 192.168.1.10"
                      value={registrationIpFilter}
                      onChange={(e) => setRegistrationIpFilter(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="users-min-earnings">Min Earnings</Label>
                    <Input id="users-min-earnings" type="number" value={minEarnings} onChange={(e) => setMinEarnings(e.target.value)} placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="users-max-earnings">Max Earnings</Label>
                    <Input id="users-max-earnings" type="number" value={maxEarnings} onChange={(e) => setMaxEarnings(e.target.value)} placeholder="1000" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="users-sort">Sort</Label>
                    <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'newest' | 'oldest' | 'earnings_desc' | 'earnings_asc' | 'name_asc')}>
                      <SelectTrigger id="users-sort"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest First</SelectItem>
                        <SelectItem value="oldest">Oldest First</SelectItem>
                        <SelectItem value="earnings_desc">Earnings High to Low</SelectItem>
                        <SelectItem value="earnings_asc">Earnings Low to High</SelectItem>
                        <SelectItem value="name_asc">Name A-Z</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="users-page-size">Rows per page</Label>
                    <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                      <SelectTrigger id="users-page-size"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Table>
                <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Balances</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user) => (
                    <TableRow key={user.id}>
                        <TableCell className="font-medium">
                            <Link href={`/admin/users/${user.id}`} className="hover:underline">
                                {user.name}
                            </Link>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          <div className="text-xs text-muted-foreground">Reg IP: {user.registrationIp || user.ipAddress || 'N/A'}</div>
                        </TableCell>
                        <TableCell>{user.country || 'N/A'}</TableCell>
                        <TableCell>
                            <Badge variant={user.role === 'admin' ? "default" : "secondary"}>{user.role === 'super_user_alpha_7' ? 'Admin' : 'User'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>{user.packageName || 'No Package'}</div>
                          <div className="text-xs text-muted-foreground">Expires: {formatExpiryDate(user.accountExpiresAt)}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>Earnings: ${Number(user.earningsBalance || 0).toFixed(2)}</div>
                          <div>Deposits: ${Number(user.depositBalance || 0).toFixed(2)}</div>
                          <div>Referrals: ${Number(user.referralBalance || 0).toFixed(2)}</div>
                        </TableCell>
                        <TableCell>{formatDate(user.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setEditingUser(user)}>
                              <Edit className="h-3 w-3 mr-1"/> Edit
                            </Button>
                            <Button variant="ghost" size="icon" className="text-amber-600 hover:bg-amber-100/60 hover:text-amber-700" onClick={() => setClearingUser(user)} title="Clear transactions">
                               <RefreshCcw className="h-4 w-4" />
                               <span className="sr-only">Clear transactions</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeletingUser(user)}
                              disabled={user.role === 'super_user_alpha_7'}
                              title={user.role === 'super_user_alpha_7' ? 'Admin accounts cannot be deleted' : 'Delete user'}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
                {filteredUsers.length === 0 && (
                    <div className="text-center p-8 text-muted-foreground">
                        No users match the current filters.
                    </div>
                )}
                {filteredUsers.length > 0 && (
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Showing {(safePage - 1) * pageSize + 1} - {Math.min(safePage * pageSize, filteredUsers.length)} of {filteredUsers.length} users
                    </p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}>Previous</Button>
                      <span className="text-sm text-muted-foreground">Page {safePage} of {totalPages}</span>
                      <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}>Next</Button>
                    </div>
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
           {clearingUser && (
          <ClearTransactionsDialog
            user={clearingUser}
            open={!!clearingUser}
            onOpenChange={(open) => !open && setClearingUser(null)}
            onUserUpdated={() => {
              setClearingUser(null);
              fetchData();
            }}
          />
           )}
    </Card>
  );
}
