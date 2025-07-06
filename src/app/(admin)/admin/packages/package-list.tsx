
"use client";

import { useState, useEffect } from "react";
import { Package } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createAdminPackage, updateAdminPackage, deleteAdminPackage } from "@/lib/actions";
import { getPackages } from "@/lib/database";
import { Separator } from "@/components/ui/separator";

type AddPackageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPackageCreated: () => void;
};

function AddPackageDialog({ open, onOpenChange, onPackageCreated }: AddPackageDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [features, setFeatures] = useState<string[]>([""]);
  const [isPrimary, setIsPrimary] = useState(false);
  const [taskLimit, setTaskLimit] = useState("100");
  const [expiryNumber, setExpiryNumber] = useState(1);
  const [expiryUnit, setExpiryUnit] = useState<"weeks" | "months">("months");
  const [referralBonusPercentage, setReferralBonusPercentage] = useState("0");
  const [referralBonusFixed, setReferralBonusFixed] = useState("0");
  const [allowAiProfilePicture, setAllowAiProfilePicture] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeatureChange = (index: number, value: string) => {
    const newFeatures = [...features];
    newFeatures[index] = value;
    setFeatures(newFeatures);
  };

  const addFeature = () => setFeatures([...features, ""]);
  const removeFeature = (index: number) => {
    if (features.length > 1) {
      setFeatures(features.filter((_, i) => i !== index));
    }
  };
  
  const resetForm = () => {
    setName("");
    setPrice("");
    setFeatures([""]);
    setIsPrimary(false);
    setTaskLimit("100");
    setExpiryNumber(1);
    setExpiryUnit("months");
    setReferralBonusPercentage("0");
    setReferralBonusFixed("0");
    setAllowAiProfilePicture(false);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const result = await createAdminPackage({
        name,
        price,
        features: features.filter(f => f.trim() !== ''),
        isPrimary,
        taskLimit: parseInt(taskLimit, 10) || 0,
        expiryPeriod: `${expiryNumber} ${expiryNumber === 1 ? expiryUnit.slice(0,-1) : expiryUnit}`,
        referralBonusPercentage: parseFloat(referralBonusPercentage) || 0,
        referralBonusFixed: parseFloat(referralBonusFixed) || 0,
        allowAiProfilePicture,
    });
    
    if (result.success) {
        toast({ title: "Success", description: result.message });
        onOpenChange(false);
        resetForm();
        onPackageCreated();
    } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-headline">Add New Package</DialogTitle>
          <DialogDescription>
            Configure the details for the new subscription package.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" placeholder="e.g., Pro" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="price" className="text-right">Price</Label>
            <Input id="price" value={price} onChange={e => setPrice(e.target.value)} className="col-span-3" placeholder="e.g., $10/mo or Free" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="taskLimit" className="text-right">Contribution Limit</Label>
            <Input id="taskLimit" type="number" value={taskLimit} onChange={e => setTaskLimit(e.target.value)} className="col-span-3" placeholder="e.g., 100" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Expiry</Label>
            <div className="col-span-3 grid grid-cols-2 gap-2">
                <Input type="number" value={expiryNumber} onChange={e => setExpiryNumber(Number(e.target.value))} min="1" />
                <Select value={expiryUnit} onValueChange={(v) => setExpiryUnit(v as any)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="weeks">Weeks</SelectItem>
                        <SelectItem value="months">Months</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right pt-2">Features</Label>
              <div className="col-span-3 space-y-2">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={feature}
                      onChange={(e) => handleFeatureChange(index, e.target.value)}
                      placeholder={`Feature ${index + 1}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFeature(index)}
                      disabled={features.length <= 1}
                    >
                      &times;
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addFeature}>
                  Add Feature
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="isPrimary" className="text-right">Primary?</Label>
                <div className="col-span-3 flex items-center">
                    <Checkbox id="isPrimary" checked={isPrimary} onCheckedChange={checked => setIsPrimary(checked as boolean)} />
                    <Label htmlFor="isPrimary" className="ml-2 font-normal text-sm text-muted-foreground">Make this the highlighted package.</Label>
                </div>
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="allowAiProfilePicture" className="text-right">AI Avatar?</Label>
                <div className="col-span-3 flex items-center">
                    <Checkbox id="allowAiProfilePicture" checked={allowAiProfilePicture} onCheckedChange={checked => setAllowAiProfilePicture(checked as boolean)} />
                    <Label htmlFor="allowAiProfilePicture" className="ml-2 font-normal text-sm text-muted-foreground">Allow AI profile picture generation.</Label>
                </div>
          </div>
          <Separator />
           <div className="grid grid-cols-4 items-center gap-4">
             <Label className="text-right">Referral Bonus</Label>
              <div className="col-span-3 grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                     <Label htmlFor="bonus-percentage" className="text-xs text-muted-foreground">Percentage (%)</Label>
                     <Input id="bonus-percentage" type="number" value={referralBonusPercentage} onChange={e => setReferralBonusPercentage(e.target.value)} />
                  </div>
                   <div className="space-y-1">
                     <Label htmlFor="bonus-fixed" className="text-xs text-muted-foreground">Fixed Amount ($)</Label>
                     <Input id="bonus-fixed" type="number" value={referralBonusFixed} onChange={e => setReferralBonusFixed(e.target.value)} />
                  </div>
              </div>
           </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Package
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type EditPackageDialogProps = {
  pkg: Package;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPackageUpdated: () => void;
};

function EditPackageDialog({ pkg, open, onOpenChange, onPackageUpdated }: EditPackageDialogProps) {
    const { toast } = useToast();

    const [name, setName] = useState(pkg.name);
    const [price, setPrice] = useState(pkg.price);
    const [features, setFeatures] = useState(pkg.features.length > 0 ? pkg.features : [""]);
    const [isPrimary, setIsPrimary] = useState(pkg.isPrimary || false);
    const [taskLimit, setTaskLimit] = useState(String(pkg.taskLimit || 100));
    
    const safeExpiryPeriod = pkg.expiryPeriod || "1 months";
    const [initialExpiryValue, initialExpiryUnitName] = safeExpiryPeriod.split(' ');
    const initialExpiryNumber = parseInt(initialExpiryValue, 10);
    const initialExpiryUnit = initialExpiryUnitName.startsWith('week') ? 'weeks' : 'months';

    const [expiryNumber, setExpiryNumber] = useState(initialExpiryNumber);
    const [expiryUnit, setExpiryUnit] = useState<"weeks" | "months">(initialExpiryUnit);
    const [referralBonusPercentage, setReferralBonusPercentage] = useState(String(pkg.referralBonusPercentage || 0));
    const [referralBonusFixed, setReferralBonusFixed] = useState(String(pkg.referralBonusFixed || 0));
    const [allowAiProfilePicture, setAllowAiProfilePicture] = useState(pkg.allowAiProfilePicture || false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleFeatureChange = (index: number, value: string) => {
        const newFeatures = [...features];
        newFeatures[index] = value;
        setFeatures(newFeatures);
    };

    const addFeature = () => setFeatures([...features, ""]);
    const removeFeature = (index: number) => {
        if (features.length > 1) {
        setFeatures(features.filter((_, i) => i !== index));
        }
    };
  
    const handleSubmit = async () => {
        setIsSubmitting(true);
        const result = await updateAdminPackage(pkg.id, {
            name,
            price,
            features: features.filter(f => f.trim() !== ''),
            isPrimary,
            taskLimit: parseInt(taskLimit, 10) || 0,
            expiryPeriod: `${expiryNumber} ${expiryNumber === 1 ? expiryUnit.slice(0,-1) : expiryUnit}`,
            referralBonusPercentage: parseFloat(referralBonusPercentage) || 0,
            referralBonusFixed: parseFloat(referralBonusFixed) || 0,
            allowAiProfilePicture,
        });
        
        if (result.success) {
            toast({ title: "Success", description: result.message });
            onOpenChange(false);
            onPackageUpdated();
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setIsSubmitting(false);
    };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-headline">Edit Package</DialogTitle>
          <DialogDescription>
            Update the details for the subscription package.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name-edit" className="text-right">Name</Label>
            <Input id="name-edit" value={name} onChange={e => setName(e.target.value)} className="col-span-3" placeholder="e.g., Pro" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="price-edit" className="text-right">Price</Label>
            <Input id="price-edit" value={price} onChange={e => setPrice(e.target.value)} className="col-span-3" placeholder="e.g., $10/mo or Free" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="taskLimit-edit" className="text-right">Contribution Limit</Label>
            <Input id="taskLimit-edit" type="number" value={taskLimit} onChange={e => setTaskLimit(e.target.value)} className="col-span-3" placeholder="e.g., 100" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Expiry</Label>
            <div className="col-span-3 grid grid-cols-2 gap-2">
                <Input type="number" value={expiryNumber} onChange={e => setExpiryNumber(Number(e.target.value))} min="1" />
                <Select value={expiryUnit} onValueChange={(v) => setExpiryUnit(v as any)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="weeks">Weeks</SelectItem>
                        <SelectItem value="months">Months</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right pt-2">Features</Label>
              <div className="col-span-3 space-y-2">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={feature}
                      onChange={(e) => handleFeatureChange(index, e.target.value)}
                      placeholder={`Feature ${index + 1}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFeature(index)}
                      disabled={features.length <= 1 && features[0] === ""}
                    >
                      &times;
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addFeature}>
                  Add Feature
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="isPrimary-edit" className="text-right">Primary?</Label>
                <div className="col-span-3 flex items-center">
                    <Checkbox id="isPrimary-edit" checked={isPrimary} onCheckedChange={checked => setIsPrimary(checked as boolean)} />
                    <Label htmlFor="isPrimary-edit" className="ml-2 font-normal text-sm text-muted-foreground">Make this the highlighted package.</Label>
                </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="allowAiProfilePicture-edit" className="text-right">AI Avatar?</Label>
                <div className="col-span-3 flex items-center">
                    <Checkbox id="allowAiProfilePicture-edit" checked={allowAiProfilePicture} onCheckedChange={checked => setAllowAiProfilePicture(checked as boolean)} />
                    <Label htmlFor="allowAiProfilePicture-edit" className="ml-2 font-normal text-sm text-muted-foreground">Allow AI profile picture generation.</Label>
                </div>
            </div>
             <Separator />
             <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Referral Bonus</Label>
                <div className="col-span-3 grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <Label htmlFor="bonus-percentage-edit" className="text-xs text-muted-foreground">Percentage (%)</Label>
                        <Input id="bonus-percentage-edit" type="number" value={referralBonusPercentage} onChange={e => setReferralBonusPercentage(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="bonus-fixed-edit" className="text-xs text-muted-foreground">Fixed Amount ($)</Label>
                        <Input id="bonus-fixed-edit" type="number" value={referralBonusFixed} onChange={e => setReferralBonusFixed(e.target.value)} />
                    </div>
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

type DeletePackageDialogProps = {
  pkg: Package;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPackageDeleted: () => void;
};

function DeletePackageDialog({ pkg, open, onOpenChange, onPackageDeleted }: DeletePackageDialogProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await deleteAdminPackage(pkg.id);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      onPackageDeleted();
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
            This action cannot be undone. This will permanently delete the "{pkg.name}" package.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className={buttonVariants({ variant: "destructive" })}>
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
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
              <TableHead>Price</TableHead>
              <TableHead>Contribution Limit</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Referral Bonus</TableHead>
              <TableHead>Primary</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {[...Array(3)].map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-24" /></TableCell>
                </TableRow>
            ))}
        </TableBody>
    </Table>
)


export function PackageList() {
    const [packages, setPackages] = useState<Package[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingPackage, setEditingPackage] = useState<Package | null>(null);
    const [deletingPackage, setDeletingPackage] = useState<Package | null>(null);

    const fetchPackages = async () => {
      setLoading(true);
      try {
        const fetchedPackages = await getPackages();
        setPackages(fetchedPackages);
      } catch (error) {
        console.error("Failed to fetch packages:", error);
      } finally {
        setLoading(false);
      }
    };
    
    useEffect(() => {
        fetchPackages();
    }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle>All Packages</CardTitle>
        <div className="flex gap-2">
            <Button onClick={() => setIsAddDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Package
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <LoadingSkeleton /> : (
            <>
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Contribution Limit</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Referral Bonus</TableHead>
                    <TableHead>Primary</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {packages.map((pkg) => {
                      const bonusParts = [];
                      if (pkg.referralBonusPercentage) {
                          bonusParts.push(`${pkg.referralBonusPercentage}%`);
                      }
                      if (pkg.referralBonusFixed) {
                          bonusParts.push(`$${pkg.referralBonusFixed.toFixed(2)}`);
                      }
                      const bonusText = bonusParts.join(' + ') || 'N/A';

                      return (
                        <TableRow key={pkg.id}>
                            <TableCell className="font-medium">{pkg.name}</TableCell>
                            <TableCell>{pkg.price}</TableCell>
                            <TableCell>{pkg.taskLimit}</TableCell>
                            <TableCell>{pkg.expiryPeriod}</TableCell>
                            <TableCell>{bonusText}</TableCell>
                            <TableCell>
                            {pkg.isPrimary && <Badge variant="secondary">Yes</Badge>}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => setEditingPackage(pkg)}>
                                  Edit
                                </Button>
                                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeletingPackage(pkg)}>
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </div>
                            </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
                </Table>
                {packages.length === 0 && (
                    <div className="text-center p-8 text-muted-foreground">
                        No packages found. Click 'Add Package' to create one.
                    </div>
                )}
            </>
        )}
      </CardContent>
       <AddPackageDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onPackageCreated={fetchPackages} />
       {editingPackage && (
        <EditPackageDialog
            pkg={editingPackage}
            open={!!editingPackage}
            onOpenChange={(open) => !open && setEditingPackage(null)}
            onPackageUpdated={() => {
                setEditingPackage(null);
                fetchPackages();
            }}
        />
       )}
       {deletingPackage && (
        <DeletePackageDialog
            pkg={deletingPackage}
            open={!!deletingPackage}
            onOpenChange={(open) => !open && setDeletingPackage(null)}
            onPackageDeleted={() => {
                setDeletingPackage(null);
                fetchPackages();
            }}
        />
       )}
    </Card>
  );
}
