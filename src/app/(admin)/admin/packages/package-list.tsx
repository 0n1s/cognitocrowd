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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createAdminPackage } from "@/lib/actions";
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
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const result = await createAdminPackage({
        name,
        price,
        features: features.filter(f => f.trim() !== ''),
        isPrimary,
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

const LoadingSkeleton = () => (
    <Table>
        <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Primary</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {[...Array(3)].map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                </TableRow>
            ))}
        </TableBody>
    </Table>
)


export function PackageList() {
    const [packages, setPackages] = useState<Package[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

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
                    <TableHead>Features</TableHead>
                    <TableHead>Primary</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {packages.map((pkg) => (
                    <TableRow key={pkg.id}>
                        <TableCell className="font-medium">{pkg.name}</TableCell>
                        <TableCell>{pkg.price}</TableCell>
                        <TableCell>{pkg.features.length}</TableCell>
                        <TableCell>
                        {pkg.isPrimary && <Badge variant="secondary">Yes</Badge>}
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
    </Card>
  );
}
