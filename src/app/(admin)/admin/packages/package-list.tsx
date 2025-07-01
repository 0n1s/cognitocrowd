"use client";

import { useState, useEffect } from "react";
import { Package } from "@/lib/types";
import { Button } from "@/components/ui/button";
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
import { PlusCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createAdminPackage, updateAdminPackage } from "@/lib/actions";
import { getPackages } from "@/lib/database";

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
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const result = await createAdminPackage({
        name,
        price,
        features: features.filter(f => f.trim() !== ''),
        isPrimary,
        taskLimit: parseInt(taskLimit, 10) || 0,
        expiryPeriod: `${expiryNumber} ${expiryNumber === 1 ? expiryUnit.slice(0,-1) : expiryUnit}`
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
            <Label htmlFor="taskLimit" className="text-right">Task Limit</Label>
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
    const [taskLimit, setTaskLimit] = useState(String(pkg.taskLimit));
    
    const [initialExpiryValue, initialExpiryUnitName] = pkg.expiryPeriod.split(' ');
    const initialExpiryNumber = parseInt(initialExpiryValue, 10);
    const initialExpiryUnit = initialExpiryUnitName.startsWith('week') ? 'weeks' : 'months';

    const [expiryNumber, setExpiryNumber] = useState(initialExpiryNumber);
    const [expiryUnit, setExpiryUnit] = useState<"weeks" | "months">(initialExpiryUnit);
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
            expiryPeriod: `${expiryNumber} ${expiryNumber === 1 ? expiryUnit.slice(0,-1) : expiryUnit}`
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
            <Label htmlFor="name" className="text-right">Name</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" placeholder="e.g., Pro" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="price" className="text-right">Price</Label>
            <Input id="price" value={price} onChange={e => setPrice(e.target.value)} className="col-span-3" placeholder="e.g., $10/mo or Free" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="taskLimit" className="text-right">Task Limit</Label>
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
                <Label htmlFor="isPrimary" className="text-right">Primary?</Label>
                <div className="col-span-3 flex items-center">
                    <Checkbox id="isPrimary" checked={isPrimary} onCheckedChange={checked => setIsPrimary(checked as boolean)} />
                    <Label htmlFor="isPrimary" className="ml-2 font-normal text-sm text-muted-foreground">Make this the highlighted package.</Label>
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


const LoadingSkeleton = () => (
    <Table>
        <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Task Limit</TableHead>
              <TableHead>Expiry</TableHead>
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
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-16" /></TableCell>
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
                    <TableHead>Task Limit</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Primary</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {packages.map((pkg) => (
                    <TableRow key={pkg.id}>
                        <TableCell className="font-medium">{pkg.name}</TableCell>
                        <TableCell>{pkg.price}</TableCell>
                        <TableCell>{pkg.taskLimit}</TableCell>
                        <TableCell>{pkg.expiryPeriod}</TableCell>
                        <TableCell>
                        {pkg.isPrimary && <Badge variant="secondary">Yes</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => setEditingPackage(pkg)}>
                            Edit
                          </Button>
                        </TableCell>
                    </TableRow>
                    ))}
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
    </Card>
  );
}
