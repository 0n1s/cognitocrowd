
"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Package as TPackage, AdminUser } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from '@/components/ui/badge';
import { useToast } from "@/hooks/use-toast";
import { adjustReferralBalance, updateAdminUser, verifyUserEmail } from "@/lib/admin-api";
import { ArrowLeft, Edit, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

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


function EditUserDialog({ user, packages, open, onOpenChange, onUserUpdated }: { user: AdminUser; packages: TPackage[]; open: boolean; onOpenChange: (open: boolean) => void; onUserUpdated: () => void; }) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [role, setRole] = useState(user.role || 'user');
    const [packageId, setPackageId] = useState(user.packageId || 'null');
    const [earningsBalance, setEarningsBalance] = useState(user.earningsBalance);
    const [depositBalance, setDepositBalance] = useState(user.depositBalance);
    const [selectedExpertise, setSelectedExpertise] = useState<string[]>(user.expertise || []);
    const [referralEligible, setReferralEligible] = useState(user.referralEligible !== false);
    const [referralAdjustment, setReferralAdjustment] = useState(0);
    const [referralAdjustmentReason, setReferralAdjustmentReason] = useState('');
    const expertiseOptions = Array.from(new Set([...BASE_EXPERTISE_OPTIONS, ...(user.expertise || [])]));

    const toggleExpertise = (expertise: string) => {
      setSelectedExpertise((prev) =>
        prev.includes(expertise)
          ? prev.filter((item) => item !== expertise)
          : [...prev, expertise]
      );
    };

    const handleSubmit = async () => {
        if (referralAdjustment !== 0 && !referralAdjustmentReason.trim()) {
          toast({ title: "Reason required", description: "Explain the referral balance adjustment.", variant: "destructive" });
          return;
        }
        setIsSubmitting(true);
        const result = await updateAdminUser(user.id, {
            role,
            packageId: packageId === 'null' ? null : packageId,
            earningsBalance,
            depositBalance,
          expertise: selectedExpertise,
          referralEligible,
        });

        if (result.success && referralAdjustment !== 0) {
          const adjustmentResult = await adjustReferralBalance(user.id, referralAdjustment, referralAdjustmentReason);
          if (!adjustmentResult.success) {
            toast({ title: "Referral adjustment failed", description: adjustmentResult.message, variant: "destructive" });
            setIsSubmitting(false);
            return;
          }
        }
        
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
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="referral-eligible" className="text-right">Referrals</Label>
            <div className="col-span-3 flex items-center gap-2"><Checkbox id="referral-eligible" checked={referralEligible} onCheckedChange={(checked) => setReferralEligible(Boolean(checked))} /><Label htmlFor="referral-eligible" className="font-normal">Eligible to earn referral bonuses</Label></div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="referral-adjustment" className="text-right">Adjustment</Label>
            <Input id="referral-adjustment" type="number" step="0.01" value={referralAdjustment} onChange={e => setReferralAdjustment(Number(e.target.value))} className="col-span-3" placeholder="Positive or negative amount" />
          </div>
          {referralAdjustment !== 0 && <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="referral-reason" className="text-right">Reason</Label><Input id="referral-reason" value={referralAdjustmentReason} onChange={e => setReferralAdjustmentReason(e.target.value)} className="col-span-3" required /></div>}
              <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right pt-1">Expertise</Label>
              <div className="col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {expertiseOptions.map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={`detail-expertise-${option}`}
                      checked={selectedExpertise.includes(option)}
                      onCheckedChange={() => toggleExpertise(option)}
                    />
                    <Label htmlFor={`detail-expertise-${option}`} className="font-normal text-sm">{option}</Label>
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


export function UserPageHeader({ user, packages }: { user: AdminUser, packages: TPackage[] }) {
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
    const [verifying, setVerifying] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    // Fetch email verification status from Firebase Auth
    useEffect(() => {
      const fetchStatus = async () => {
        try {
          const { getUserEmailStatus } = await import('@/lib/admin-api');
          const result = await getUserEmailStatus(user.id);
          if (result.success) {
            setEmailVerified(result.emailVerified);
          }
        } catch {
          // Ignore errors — fallback to null
        }
      };
      fetchStatus();
    }, [user.id]);

    const handleVerifyEmail = async () => {
      setVerifying(true);
      try {
        const result = await verifyUserEmail(user.id);
        if (result.success) {
          setEmailVerified(true);
          toast({ title: "Success", description: "Email marked as verified." });
        } else {
          toast({ title: "Error", description: result.message || "Failed to verify email.", variant: "destructive" });
        }
      } catch (error) {
        toast({ title: "Error", description: "Failed to verify email.", variant: "destructive" });
      } finally {
        setVerifying(false);
      }
    };

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
                            <div className="flex items-center gap-2 mt-1">
                              {emailVerified === true ? (
                                <Badge variant="default" className="flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" /> Email Verified
                                </Badge>
                              ) : emailVerified === false ? (
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="flex items-center gap-1">
                                    <XCircle className="h-3 w-3" /> Not Verified
                                  </Badge>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleVerifyEmail}
                                    disabled={verifying}
                                  >
                                    {verifying && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                                    Verify Manually
                                  </Button>
                                </div>
                              ) : null}
                              {emailVerified === null && (
                                <Badge variant="outline">Checking...</Badge>
                              )}
                            </div>
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
