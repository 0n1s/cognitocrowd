
"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Package as TPackage, AdminUser } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { updateAdminUser } from "@/lib/actions";
import { ArrowLeft, Edit, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';


function EditUserDialog({ user, packages, open, onOpenChange, onUserUpdated }: { user: AdminUser; packages: TPackage[]; open: boolean; onOpenChange: (open: boolean) => void; onUserUpdated: () => void; }) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [role, setRole] = useState(user.role || 'user');
    const [packageId, setPackageId] = useState(user.packageId || 'null');
    const [earningsBalance, setEarningsBalance] = useState(user.earningsBalance);
    const [depositBalance, setDepositBalance] = useState(user.depositBalance);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        const result = await updateAdminUser(user.id, {
            role,
            packageId: packageId === 'null' ? null : packageId,
            earningsBalance,
            depositBalance,
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


export function UserPageHeader({ user, packages }: { user: AdminUser, packages: TPackage[] }) {
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const router = useRouter();

    const getInitials = (name: string | null | undefined) => {
        if (!name) return "U";
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }

    return (
        <>
            <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <Button asChild variant="outline" size="icon">
                        <Link href="/admin/users"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <h1 className="text-2xl font-bold font-headline">{user.name}</h1>
                            <p className="text-muted-foreground">{user.email}</p>
                        </div>
                    </div>
                </div>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit User
                </Button>
            </div>
             {isEditDialogOpen && (
                <EditUserDialog 
                    user={user} 
                    packages={packages} 
                    open={isEditDialogOpen} 
                    onOpenChange={setIsEditDialogOpen} 
                    onUserUpdated={() => {
                        setIsEditDialogOpen(false);
                        router.refresh();
                    }} 
                />
            )}
        </>
    );
}
