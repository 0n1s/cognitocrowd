
"use client";

import { useState, useEffect } from "react";
import Link from 'next/link';
import { AdminUser, CountryPartner } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Loader2, Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAdminUsers, getCountryPartners } from "@/lib/database";
import { createCountryPartner, updateCountryPartner, deleteCountryPartner } from "@/lib/actions";
import { COUNTRIES } from "@/lib/countries";

function AddPartnerDialog({ open, onOpenChange, onPartnerCreated, users }: { open: boolean; onOpenChange: (open: boolean) => void; onPartnerCreated: () => void; users: AdminUser[] }) {
  const { toast } = useToast();
  const [userId, setUserId] = useState("");
  const [country, setCountry] = useState("");
  const [depositFee, setDepositFee] = useState("2.5");
  const [withdrawalFee, setWithdrawalFee] = useState("2.5");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!userId || !country) {
      toast({ title: "Error", description: "Please select a user and a country.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const result = await createCountryPartner({
        userId,
        country,
        depositFeePercent: parseFloat(depositFee),
        withdrawalFeePercent: parseFloat(withdrawalFee),
    });
    
    if (result.success) {
        toast({ title: "Success", description: result.message });
        onOpenChange(false);
        onPartnerCreated();
    } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Country Partner</DialogTitle>
          <DialogDescription>Assign an existing user as a partner for a specific country.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="user">User</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger>
              <SelectContent>
                {users.filter(u => u.role === 'user').map(user => (
                  <SelectItem key={user.id} value={user.id}>{user.name} ({user.email})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue placeholder="Select a country" /></SelectTrigger>
              <SelectContent className="max-h-60">
                {COUNTRIES.map(c => (
                  <SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="deposit-fee">Deposit Fee (%)</Label>
            <Input id="deposit-fee" type="number" value={depositFee} onChange={e => setDepositFee(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="withdrawal-fee">Withdrawal Fee (%)</Label>
            <Input id="withdrawal-fee" type="number" value={withdrawalFee} onChange={e => setWithdrawalFee(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Partner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditPartnerDialog({ partner, open, onOpenChange, onPartnerUpdated }: { partner: CountryPartner; open: boolean; onOpenChange: (open: boolean) => void; onPartnerUpdated: () => void; }) {
    const { toast } = useToast();
    const [country, setCountry] = useState(partner.country);
    const [depositFee, setDepositFee] = useState(String(partner.depositFeePercent));
    const [withdrawalFee, setWithdrawalFee] = useState(String(partner.withdrawalFeePercent));
    const [isActive, setIsActive] = useState(partner.isActive);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        const result = await updateCountryPartner(partner.id, {
            country,
            depositFeePercent: parseFloat(depositFee),
            withdrawalFeePercent: parseFloat(withdrawalFee),
            isActive,
        });
        
        if (result.success) {
            toast({ title: "Success", description: result.message });
            onOpenChange(false);
            onPartnerUpdated();
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setIsSubmitting(false);
    };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Partner: {partner.name}</DialogTitle>
          <DialogDescription>Update fees, country, and status.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
           <div className="space-y-2">
            <Label htmlFor="country-edit">Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue placeholder="Select a country" /></SelectTrigger>
              <SelectContent className="max-h-60">
                {COUNTRIES.map(c => ( <SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="deposit-fee-edit">Deposit Fee (%)</Label>
            <Input id="deposit-fee-edit" type="number" value={depositFee} onChange={e => setDepositFee(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="withdrawal-fee-edit">Withdrawal Fee (%)</Label>
            <Input id="withdrawal-fee-edit" type="number" value={withdrawalFee} onChange={e => setWithdrawalFee(e.target.value)} />
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="active-status" checked={isActive} onCheckedChange={setIsActive} />
            <Label htmlFor="active-status">Active</Label>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeletePartnerDialog({ partner, open, onOpenChange, onPartnerDeleted }: { partner: CountryPartner; open: boolean; onOpenChange: (open: boolean) => void; onPartnerDeleted: () => void; }) {
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        const result = await deleteCountryPartner(partner.id);
        if (result.success) {
            toast({ title: "Success", description: result.message });
            onOpenChange(false);
            onPartnerDeleted();
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
                        This will remove {partner.name} as a partner and set their role back to a regular user. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className={buttonVariants({ variant: 'destructive' })} disabled={isDeleting}>
                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete Partner
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
              <TableHead>Deposit Fee</TableHead>
              <TableHead>Withdrawal Fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {[...Array(3)].map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-24" /></TableCell>
                </TableRow>
            ))}
        </TableBody>
    </Table>
);


export function PartnerList() {
    const [partners, setPartners] = useState<CountryPartner[]>([]);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingPartner, setEditingPartner] = useState<CountryPartner | null>(null);
    const [deletingPartner, setDeletingPartner] = useState<CountryPartner | null>(null);

    const fetchData = async () => {
      setLoading(true);
      try {
        const [fetchedPartners, fetchedUsers] = await Promise.all([
            getCountryPartners(),
            getAdminUsers()
        ]);
        setPartners(fetchedPartners);
        setUsers(fetchedUsers);
      } catch (error) {
        console.error("Failed to fetch partners:", error);
      } finally {
        setLoading(false);
      }
    };
    
    useEffect(() => {
        fetchData();
    }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle>All Partners</CardTitle>
        <Button onClick={() => setIsAddDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Partner
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? <LoadingSkeleton /> : (
            <>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Country</TableHead>
                            <TableHead>Deposit Fee</TableHead>
                            <TableHead>Withdrawal Fee</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {partners.map((p) => (
                            <TableRow key={p.id}>
                                <TableCell className="font-medium">
                                    <Link href={`/admin/partners/${p.id}`} className="hover:underline">
                                        {p.name}
                                    </Link>
                                    <div className="text-xs text-muted-foreground">{p.email}</div>
                                </TableCell>
                                <TableCell>{p.country}</TableCell>
                                <TableCell>{p.depositFeePercent}%</TableCell>
                                <TableCell>{p.withdrawalFeePercent}%</TableCell>
                                <TableCell>
                                    <Badge variant={p.isActive ? "secondary" : "outline"}>
                                        {p.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => setEditingPartner(p)}>
                                            <Edit className="h-3 w-3 mr-1" /> Edit
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeletingPartner(p)}>
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Delete</span>
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {partners.length === 0 && (
                    <div className="text-center p-8 text-muted-foreground">
                        No country partners found.
                    </div>
                )}
            </>
        )}
      </CardContent>
       <AddPartnerDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onPartnerCreated={fetchData} users={users} />
       {editingPartner && (
        <EditPartnerDialog
            partner={editingPartner}
            open={!!editingPartner}
            onOpenChange={(open) => !open && setEditingPartner(null)}
            onPartnerUpdated={() => {
                setEditingPartner(null);
                fetchData();
            }}
        />
       )}
       {deletingPartner && (
        <DeletePartnerDialog
            partner={deletingPartner}
            open={!!deletingPartner}
            onOpenChange={(open) => !open && setDeletingPartner(null)}
            onPartnerDeleted={() => {
                setDeletingPartner(null);
                fetchData();
            }}
        />
       )}
    </Card>
  );
}
