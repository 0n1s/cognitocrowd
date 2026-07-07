
"use client";

import { useState, useEffect, useMemo } from "react";
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
import { createAdminPackage, updateAdminPackage, deleteAdminPackage } from "@/lib/admin-api";
import { getPackages } from "@/lib/database";
import { Separator } from "@/components/ui/separator";
import { formatPackageLegacyPrice, getPackageMoney, normalizeCurrencyCode, SUPPORTED_CURRENCIES } from "@/lib/currency";

function buildAllowedModelTypesFromEntitlements(values: {
  allowChatNormal: boolean;
  allowChatUncensored: boolean;
  allowChatCoding: boolean;
  allowChatHacking: boolean;
  allowImageNormal: boolean;
  allowImageUncensored: boolean;
  allowVideoGeneration: boolean;
  allowMusicGeneration: boolean;
}) {
  const modelTypes: string[] = [];
  if (values.allowChatNormal || values.allowChatUncensored || values.allowChatCoding || values.allowChatHacking) modelTypes.push('text');
  if (values.allowImageNormal || values.allowImageUncensored) modelTypes.push('image');
  if (values.allowVideoGeneration) modelTypes.push('video');
  if (values.allowMusicGeneration) modelTypes.push('music');
  if (values.allowChatUncensored || values.allowImageUncensored) modelTypes.push('uncensored');
  if (values.allowChatCoding) modelTypes.push('coding');
  if (values.allowChatHacking) modelTypes.push('hacking');
  return modelTypes;
}

function sanitizePriceAmount(amountText: string): number {
  const parsed = Number.parseFloat(amountText);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

type AddPackageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPackageCreated: () => void;
};

function AddPackageDialog({ open, onOpenChange, onPackageCreated }: AddPackageDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [priceAmount, setPriceAmount] = useState("");
  const [priceCurrency, setPriceCurrency] = useState<string>('USD');
  const [features, setFeatures] = useState<string[]>([""]);
  const [isPrimary, setIsPrimary] = useState(false);
  const [taskLimit, setTaskLimit] = useState("100");
  const [allowWithdrawals, setAllowWithdrawals] = useState(true);
  const [withdrawalMinimumAmount, setWithdrawalMinimumAmount] = useState("0");
  const [withdrawalMaximumAmount, setWithdrawalMaximumAmount] = useState("0");
  const [imageGenerationLimit, setImageGenerationLimit] = useState("0");
  const [imageGenerationLimitType, setImageGenerationLimitType] = useState<'daily' | 'lifetime'>('daily');
  const [allowChatNormal, setAllowChatNormal] = useState(true);
  const [allowChatUncensored, setAllowChatUncensored] = useState(false);
  const [allowChatCoding, setAllowChatCoding] = useState(false);
  const [allowChatHacking, setAllowChatHacking] = useState(false);
  const [allowImageNormal, setAllowImageNormal] = useState(true);
  const [allowImageUncensored, setAllowImageUncensored] = useState(false);
  const [allowMusicGeneration, setAllowMusicGeneration] = useState(false);
  const [aiRankedPayoutEnabled, setAiRankedPayoutEnabled] = useState(true);
  const [allowMusicGenerationAssist, setAllowMusicGenerationAssist] = useState(false);
  const [allowMusicStyleProfiles, setAllowMusicStyleProfiles] = useState(false);
  const [musicGenerationLimit, setMusicGenerationLimit] = useState("0");
  const [musicGenerationLimitType, setMusicGenerationLimitType] = useState<'daily' | 'lifetime'>('daily');
  const [allowVideoGeneration, setAllowVideoGeneration] = useState(true);
  const [videoGenerationLimit, setVideoGenerationLimit] = useState("0");
  const [videoGenerationLimitType, setVideoGenerationLimitType] = useState<'daily' | 'lifetime'>('daily');
  const [expiryNumber, setExpiryNumber] = useState(1);
  const [expiryUnit, setExpiryUnit] = useState<"weeks" | "months">("months");
  const [referralBonusPercentage, setReferralBonusPercentage] = useState("0");
  const [referralBonusFixed, setReferralBonusFixed] = useState("0");
  const [referralBonusMinimumDeposit, setReferralBonusMinimumDeposit] = useState("0");
  const [referralBonusMaximum, setReferralBonusMaximum] = useState("0");
  const [referralBonusFirstDepositOnly, setReferralBonusFirstDepositOnly] = useState(true);
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
    setPriceAmount("");
    setPriceCurrency('USD');
    setFeatures([""]);
    setIsPrimary(false);
    setTaskLimit("100");
    setAllowWithdrawals(true);
    setWithdrawalMinimumAmount("0");
    setWithdrawalMaximumAmount("0");
    setImageGenerationLimit("0");
    setImageGenerationLimitType('daily');
    setAllowChatNormal(true);
    setAllowChatUncensored(false);
    setAllowChatCoding(false);
    setAllowChatHacking(false);
    setAllowImageNormal(true);
    setAllowImageUncensored(false);
    setAllowMusicGeneration(false);
    setAiRankedPayoutEnabled(true);
    setAllowMusicGenerationAssist(false);
    setAllowMusicStyleProfiles(false);
    setMusicGenerationLimit("0");
    setMusicGenerationLimitType('daily');
    setAllowVideoGeneration(true);
    setExpiryNumber(1);
    setExpiryUnit("months");
    setReferralBonusPercentage("0");
    setReferralBonusFixed("0");
    setReferralBonusMinimumDeposit("0");
    setReferralBonusMaximum("0");
    setReferralBonusFirstDepositOnly(true);
    setAllowAiProfilePicture(false);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const allowedModelTypes = buildAllowedModelTypesFromEntitlements({
      allowChatNormal,
      allowChatUncensored,
      allowChatCoding,
      allowChatHacking,
      allowImageNormal,
      allowImageUncensored,
      allowVideoGeneration,
      allowMusicGeneration,
    });
    const normalizedPriceAmount = sanitizePriceAmount(priceAmount);
    const normalizedPriceCurrency = normalizeCurrencyCode(priceCurrency, 'USD');
    const result = await createAdminPackage({
        name,
      price: formatPackageLegacyPrice(normalizedPriceAmount, normalizedPriceCurrency),
        priceAmount: normalizedPriceAmount,
        priceCurrency: normalizedPriceCurrency,
        features: features.filter(f => f.trim() !== ''),
        isPrimary,
        taskLimit: parseInt(taskLimit, 10) || 0,
        allowWithdrawals,
        withdrawalMinimumAmount: parseFloat(withdrawalMinimumAmount) || 0,
        withdrawalMaximumAmount: parseFloat(withdrawalMaximumAmount) || 0,
        imageGenerationLimit: parseInt(imageGenerationLimit, 10) || 0,
        imageGenerationLimitType,
        allowChatNormal,
        allowChatUncensored,
        allowChatCoding,
        allowChatHacking,
        allowImageNormal,
        allowImageUncensored,
        allowedModelTypes,
        allowUncensoredImageGeneration: allowImageUncensored,
        allowMusicGeneration,
        aiRankedPayoutEnabled,
        allowMusicGenerationAssist,
        allowMusicStyleProfiles,
        musicGenerationLimit: parseInt(musicGenerationLimit, 10) || 0,
        musicGenerationLimitType,
        allowVideoGeneration,
        videoGenerationLimit: parseInt(videoGenerationLimit, 10) || 0,
        videoGenerationLimitType,
        expiryPeriod: `${expiryNumber} ${expiryNumber === 1 ? expiryUnit.slice(0,-1) : expiryUnit}`,
        referralBonusPercentage: parseFloat(referralBonusPercentage) || 0,
        referralBonusFixed: parseFloat(referralBonusFixed) || 0,
        referralBonusMinimumDeposit: parseFloat(referralBonusMinimumDeposit) || 0,
        referralBonusMaximum: parseFloat(referralBonusMaximum) || 0,
        referralBonusFirstDepositOnly,
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-headline">Add New Package</DialogTitle>
          <DialogDescription>
            Configure the details for the new subscription package.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[calc(90vh-10rem)] overflow-y-auto pr-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" placeholder="e.g., Pro" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="price" className="text-right">Price</Label>
            <div className="col-span-3 grid grid-cols-2 gap-2">
              <Input id="price" type="number" min="0" step="0.01" value={priceAmount} onChange={e => setPriceAmount(e.target.value)} placeholder="e.g., 10" />
              <Select value={priceCurrency} onValueChange={setPriceCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((currencyCode) => (
                    <SelectItem key={currencyCode} value={currencyCode}>{currencyCode}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="taskLimit" className="text-right">Contribution Limit</Label>
            <Input id="taskLimit" type="number" value={taskLimit} onChange={e => setTaskLimit(e.target.value)} className="col-span-3" placeholder="e.g., 100" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="allowWithdrawals" className="text-right">Withdrawals</Label>
            <div className="col-span-3 flex items-center">
              <Checkbox id="allowWithdrawals" checked={allowWithdrawals} onCheckedChange={checked => setAllowWithdrawals(checked as boolean)} />
              <Label htmlFor="allowWithdrawals" className="ml-2 font-normal text-sm text-muted-foreground">Allow users on this package to request withdrawals.</Label>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Withdrawal Limit</Label>
            <div className="col-span-3 grid grid-cols-2 gap-2">
              <Input type="number" min="0" step="0.01" value={withdrawalMinimumAmount} onChange={e => setWithdrawalMinimumAmount(e.target.value)} placeholder="Min (USD)" />
              <Input type="number" min="0" step="0.01" value={withdrawalMaximumAmount} onChange={e => setWithdrawalMaximumAmount(e.target.value)} placeholder="Max (USD, 0 = none)" />
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Chat Models</Label>
            <div className="col-span-3 grid grid-cols-2 gap-2 rounded-md border p-3">
              <div className="flex items-center gap-2"><Checkbox id="allowChatNormal" checked={allowChatNormal} onCheckedChange={(checked) => setAllowChatNormal(Boolean(checked))} /><Label htmlFor="allowChatNormal" className="text-sm font-normal">Normal</Label></div>
              <div className="flex items-center gap-2"><Checkbox id="allowChatUncensored" checked={allowChatUncensored} onCheckedChange={(checked) => setAllowChatUncensored(Boolean(checked))} /><Label htmlFor="allowChatUncensored" className="text-sm font-normal">Uncensored</Label></div>
              <div className="flex items-center gap-2"><Checkbox id="allowChatCoding" checked={allowChatCoding} onCheckedChange={(checked) => setAllowChatCoding(Boolean(checked))} /><Label htmlFor="allowChatCoding" className="text-sm font-normal">Coding</Label></div>
              <div className="flex items-center gap-2"><Checkbox id="allowChatHacking" checked={allowChatHacking} onCheckedChange={(checked) => setAllowChatHacking(Boolean(checked))} /><Label htmlFor="allowChatHacking" className="text-sm font-normal">Hacking</Label></div>
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Image Models</Label>
            <div className="col-span-3 space-y-3 rounded-md border p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2"><Checkbox id="allowImageNormal" checked={allowImageNormal} onCheckedChange={(checked) => setAllowImageNormal(Boolean(checked))} /><Label htmlFor="allowImageNormal" className="text-sm font-normal">Normal</Label></div>
                <div className="flex items-center gap-2"><Checkbox id="allowImageUncensored" checked={allowImageUncensored} onCheckedChange={(checked) => setAllowImageUncensored(Boolean(checked))} /><Label htmlFor="allowImageUncensored" className="text-sm font-normal">Uncensored</Label></div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="imageGenerationLimit" className="text-xs text-muted-foreground">Generation Limit</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input id="imageGenerationLimit" type="number" value={imageGenerationLimit} onChange={e => setImageGenerationLimit(e.target.value)} placeholder="e.g., 10" />
                  <Select value={imageGenerationLimitType} onValueChange={(v) => setImageGenerationLimitType(v as 'daily' | 'lifetime')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="daily">Per Day</SelectItem><SelectItem value="lifetime">Per Package</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Music Generation</Label>
            <div className="col-span-3 space-y-3 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Checkbox id="allowMusicGeneration" checked={allowMusicGeneration} onCheckedChange={(checked) => setAllowMusicGeneration(Boolean(checked))} />
                <Label htmlFor="allowMusicGeneration" className="text-sm font-normal">Enabled</Label>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="musicGenerationLimit" className="text-xs text-muted-foreground">Generation Limit</Label>
                <div className="grid grid-cols-2 gap-2">
                <Input id="musicGenerationLimit" type="number" value={musicGenerationLimit} onChange={e => setMusicGenerationLimit(e.target.value)} placeholder="e.g., 5" />
                <Select value={musicGenerationLimitType} onValueChange={(v) => setMusicGenerationLimitType(v as any)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="daily">Per Day</SelectItem>
                        <SelectItem value="lifetime">Per Package</SelectItem>
                    </SelectContent>
                </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="allowMusicGenerationAssist" checked={allowMusicGenerationAssist} onCheckedChange={(checked) => setAllowMusicGenerationAssist(Boolean(checked))} />
                <Label htmlFor="allowMusicGenerationAssist" className="text-sm font-normal">AI lyrics and caption assistance</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="allowMusicStyleProfiles" checked={allowMusicStyleProfiles} onCheckedChange={(checked) => setAllowMusicStyleProfiles(Boolean(checked))} />
                <Label htmlFor="allowMusicStyleProfiles" className="text-sm font-normal">Reusable music style profiles</Label>
              </div>
            </div>
          </div>






          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Video Generation</Label>
            <div className="col-span-3 space-y-3 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Checkbox id="allowVideoGeneration" checked={allowVideoGeneration} onCheckedChange={(checked) => setAllowVideoGeneration(Boolean(checked))} />
                <Label htmlFor="allowVideoGeneration" className="text-sm font-normal">Enabled</Label>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="videoGenerationLimit" className="text-xs text-muted-foreground">Generation Limit</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input id="videoGenerationLimit" type="number" value={videoGenerationLimit} onChange={e => setVideoGenerationLimit(e.target.value)} placeholder="e.g., 5" />
                  <Select value={videoGenerationLimitType} onValueChange={(v) => setVideoGenerationLimitType(v as 'daily' | 'lifetime')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="daily">Per Day</SelectItem><SelectItem value="lifetime">Per Package</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            </div>
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





          <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="aiRankedPayoutEnabled" className="text-right">AI ranked payout?</Label>
              <div className="col-span-3 flex items-center gap-2">
                <Checkbox id="aiRankedPayoutEnabled" checked={aiRankedPayoutEnabled} onCheckedChange={(checked) => setAiRankedPayoutEnabled(Boolean(checked))} />
                <Label htmlFor="aiRankedPayoutEnabled" className="ml-2 font-normal text-sm text-muted-foreground">AI-ranked payout (when global mode is per package)</Label>
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
                  <div className="space-y-1">
                     <Label htmlFor="bonus-minimum" className="text-xs text-muted-foreground">Minimum Deposit ($)</Label>
                     <Input id="bonus-minimum" type="number" min="0" value={referralBonusMinimumDeposit} onChange={e => setReferralBonusMinimumDeposit(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                     <Label htmlFor="bonus-maximum" className="text-xs text-muted-foreground">Maximum Bonus ($, 0 = none)</Label>
                     <Input id="bonus-maximum" type="number" min="0" value={referralBonusMaximum} onChange={e => setReferralBonusMaximum(e.target.value)} />
                  </div>
                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <Checkbox id="bonus-first-only" checked={referralBonusFirstDepositOnly} onCheckedChange={(checked) => setReferralBonusFirstDepositOnly(Boolean(checked))} />
                    <Label htmlFor="bonus-first-only" className="text-sm font-normal">Apply to first successful deposit only</Label>
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
    const packageMoney = getPackageMoney(pkg);

    const [name, setName] = useState(pkg.name);
  const [priceAmount, setPriceAmount] = useState(String(packageMoney.amount || 0));
    const [priceCurrency, setPriceCurrency] = useState(packageMoney.currency || 'USD');
    const [features, setFeatures] = useState(pkg.features.length > 0 ? pkg.features : [""]);
    const [isPrimary, setIsPrimary] = useState(pkg.isPrimary || false);
    const [taskLimit, setTaskLimit] = useState(String(pkg.taskLimit || 100));
    const [allowWithdrawals, setAllowWithdrawals] = useState(pkg.allowWithdrawals !== false);
    const [withdrawalMinimumAmount, setWithdrawalMinimumAmount] = useState(String(pkg.withdrawalMinimumAmount || 0));
    const [withdrawalMaximumAmount, setWithdrawalMaximumAmount] = useState(String(pkg.withdrawalMaximumAmount || 0));
    const [imageGenerationLimit, setImageGenerationLimit] = useState(String(pkg.imageGenerationLimit || 0));
    const [imageGenerationLimitType, setImageGenerationLimitType] = useState<'daily' | 'lifetime'>(pkg.imageGenerationLimitType || 'daily');
    const legacyTypes = pkg.allowedModelTypes || [];
    const [allowChatNormal, setAllowChatNormal] = useState(pkg.allowChatNormal ?? legacyTypes.includes('text'));
    const [allowChatUncensored, setAllowChatUncensored] = useState(pkg.allowChatUncensored ?? legacyTypes.includes('uncensored'));
    const [allowChatCoding, setAllowChatCoding] = useState(pkg.allowChatCoding ?? legacyTypes.includes('coding'));
    const [allowChatHacking, setAllowChatHacking] = useState(pkg.allowChatHacking ?? legacyTypes.includes('hacking'));
    const [allowImageNormal, setAllowImageNormal] = useState(pkg.allowImageNormal ?? legacyTypes.includes('image'));
    const [allowImageUncensored, setAllowImageUncensored] = useState(pkg.allowImageUncensored ?? pkg.allowUncensoredImageGeneration ?? legacyTypes.includes('uncensored'));
    const [allowMusicGeneration, setAllowMusicGeneration] = useState(pkg.allowMusicGeneration || false);
    const [aiRankedPayoutEnabled, setAiRankedPayoutEnabled] = useState(pkg.aiRankedPayoutEnabled ?? true);
    const [allowMusicGenerationAssist, setAllowMusicGenerationAssist] = useState(pkg.allowMusicGenerationAssist || false);
    const [allowMusicStyleProfiles, setAllowMusicStyleProfiles] = useState(pkg.allowMusicStyleProfiles || false);
    const [musicGenerationLimit, setMusicGenerationLimit] = useState(String(pkg.musicGenerationLimit || 0));
    const [musicGenerationLimitType, setMusicGenerationLimitType] = useState<'daily' | 'lifetime'>(pkg.musicGenerationLimitType || 'daily');
    const [allowVideoGeneration, setAllowVideoGeneration] = useState(pkg.allowVideoGeneration ?? true);
    const [videoGenerationLimit, setVideoGenerationLimit] = useState(String(pkg.videoGenerationLimit || 0));
    const [videoGenerationLimitType, setVideoGenerationLimitType] = useState<'daily' | 'lifetime'>(pkg.videoGenerationLimitType || 'daily');
    
    const safeExpiryPeriod = pkg.expiryPeriod || "1 months";
    const [initialExpiryValue, initialExpiryUnitName] = safeExpiryPeriod.split(' ');
    const initialExpiryNumber = parseInt(initialExpiryValue, 10);
    const initialExpiryUnit = initialExpiryUnitName.startsWith('week') ? 'weeks' : 'months';

    const [expiryNumber, setExpiryNumber] = useState(initialExpiryNumber);
    const [expiryUnit, setExpiryUnit] = useState<"weeks" | "months">(initialExpiryUnit);
    const [referralBonusPercentage, setReferralBonusPercentage] = useState(String(pkg.referralBonusPercentage || 0));
    const [referralBonusFixed, setReferralBonusFixed] = useState(String(pkg.referralBonusFixed || 0));
    const [referralBonusMinimumDeposit, setReferralBonusMinimumDeposit] = useState(String(pkg.referralBonusMinimumDeposit || 0));
    const [referralBonusMaximum, setReferralBonusMaximum] = useState(String(pkg.referralBonusMaximum || 0));
    const [referralBonusFirstDepositOnly, setReferralBonusFirstDepositOnly] = useState(pkg.referralBonusFirstDepositOnly !== false);
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
      const allowedModelTypes = buildAllowedModelTypesFromEntitlements({
        allowChatNormal,
        allowChatUncensored,
        allowChatCoding,
        allowChatHacking,
        allowImageNormal,
        allowImageUncensored,
        allowVideoGeneration,
        allowMusicGeneration,
      });
        const normalizedPriceAmount = sanitizePriceAmount(priceAmount);
        const normalizedPriceCurrency = normalizeCurrencyCode(priceCurrency, 'USD');
        const result = await updateAdminPackage(pkg.id, {
            name,
          price: formatPackageLegacyPrice(normalizedPriceAmount, normalizedPriceCurrency),
            priceAmount: normalizedPriceAmount,
            priceCurrency: normalizedPriceCurrency,
            features: features.filter(f => f.trim() !== ''),
            isPrimary,
            taskLimit: parseInt(taskLimit, 10) || 0,
            allowWithdrawals,
            withdrawalMinimumAmount: parseFloat(withdrawalMinimumAmount) || 0,
            withdrawalMaximumAmount: parseFloat(withdrawalMaximumAmount) || 0,
            imageGenerationLimit: parseInt(imageGenerationLimit, 10) || 0,
            imageGenerationLimitType,
            allowChatNormal,
            allowChatUncensored,
            allowChatCoding,
            allowChatHacking,
            allowImageNormal,
            allowImageUncensored,
            allowedModelTypes,
            allowUncensoredImageGeneration: allowImageUncensored,
            allowMusicGeneration,
            aiRankedPayoutEnabled,
            allowMusicGenerationAssist,
            allowMusicStyleProfiles,
            musicGenerationLimit: parseInt(musicGenerationLimit, 10) || 0,
            musicGenerationLimitType,
            allowVideoGeneration,
            videoGenerationLimit: parseInt(videoGenerationLimit, 10) || 0,
            videoGenerationLimitType,
            expiryPeriod: `${expiryNumber} ${expiryNumber === 1 ? expiryUnit.slice(0,-1) : expiryUnit}`,
            referralBonusPercentage: parseFloat(referralBonusPercentage) || 0,
            referralBonusFixed: parseFloat(referralBonusFixed) || 0,
            referralBonusMinimumDeposit: parseFloat(referralBonusMinimumDeposit) || 0,
            referralBonusMaximum: parseFloat(referralBonusMaximum) || 0,
            referralBonusFirstDepositOnly,
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-headline">Edit Package</DialogTitle>
          <DialogDescription>
            Update the details for the subscription package.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[calc(90vh-10rem)] overflow-y-auto pr-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name-edit" className="text-right">Name</Label>
            <Input id="name-edit" value={name} onChange={e => setName(e.target.value)} className="col-span-3" placeholder="e.g., Pro" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="price-edit" className="text-right">Price</Label>
            <div className="col-span-3 grid grid-cols-2 gap-2">
              <Input id="price-edit" type="number" min="0" step="0.01" value={priceAmount} onChange={e => setPriceAmount(e.target.value)} placeholder="e.g., 10" />
              <Select value={priceCurrency} onValueChange={setPriceCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((currencyCode) => (
                    <SelectItem key={currencyCode} value={currencyCode}>{currencyCode}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="taskLimit-edit" className="text-right">Contribution Limit</Label>
            <Input id="taskLimit-edit" type="number" value={taskLimit} onChange={e => setTaskLimit(e.target.value)} className="col-span-3" placeholder="e.g., 100" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="allowWithdrawals-edit" className="text-right">Withdrawals</Label>
            <div className="col-span-3 flex items-center">
              <Checkbox id="allowWithdrawals-edit" checked={allowWithdrawals} onCheckedChange={checked => setAllowWithdrawals(checked as boolean)} />
              <Label htmlFor="allowWithdrawals-edit" className="ml-2 font-normal text-sm text-muted-foreground">Allow users on this package to request withdrawals.</Label>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Withdrawal Limit</Label>
            <div className="col-span-3 grid grid-cols-2 gap-2">
              <Input type="number" min="0" step="0.01" value={withdrawalMinimumAmount} onChange={e => setWithdrawalMinimumAmount(e.target.value)} placeholder="Min (USD)" />
              <Input type="number" min="0" step="0.01" value={withdrawalMaximumAmount} onChange={e => setWithdrawalMaximumAmount(e.target.value)} placeholder="Max (USD, 0 = none)" />
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Chat Models</Label>
            <div className="col-span-3 grid grid-cols-2 gap-2 rounded-md border p-3">
              <div className="flex items-center gap-2"><Checkbox id="allowChatNormal-edit" checked={allowChatNormal} onCheckedChange={(checked) => setAllowChatNormal(Boolean(checked))} /><Label htmlFor="allowChatNormal-edit" className="text-sm font-normal">Normal</Label></div>
              <div className="flex items-center gap-2"><Checkbox id="allowChatUncensored-edit" checked={allowChatUncensored} onCheckedChange={(checked) => setAllowChatUncensored(Boolean(checked))} /><Label htmlFor="allowChatUncensored-edit" className="text-sm font-normal">Uncensored</Label></div>
              <div className="flex items-center gap-2"><Checkbox id="allowChatCoding-edit" checked={allowChatCoding} onCheckedChange={(checked) => setAllowChatCoding(Boolean(checked))} /><Label htmlFor="allowChatCoding-edit" className="text-sm font-normal">Coding</Label></div>
              <div className="flex items-center gap-2"><Checkbox id="allowChatHacking-edit" checked={allowChatHacking} onCheckedChange={(checked) => setAllowChatHacking(Boolean(checked))} /><Label htmlFor="allowChatHacking-edit" className="text-sm font-normal">Hacking</Label></div>
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Image Models</Label>
            <div className="col-span-3 space-y-3 rounded-md border p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2"><Checkbox id="allowImageNormal-edit" checked={allowImageNormal} onCheckedChange={(checked) => setAllowImageNormal(Boolean(checked))} /><Label htmlFor="allowImageNormal-edit" className="text-sm font-normal">Normal</Label></div>
                <div className="flex items-center gap-2"><Checkbox id="allowImageUncensored-edit" checked={allowImageUncensored} onCheckedChange={(checked) => setAllowImageUncensored(Boolean(checked))} /><Label htmlFor="allowImageUncensored-edit" className="text-sm font-normal">Uncensored</Label></div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="imageGenerationLimit-edit" className="text-xs text-muted-foreground">Generation Limit</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input id="imageGenerationLimit-edit" type="number" value={imageGenerationLimit} onChange={e => setImageGenerationLimit(e.target.value)} placeholder="e.g., 10" />
                  <Select value={imageGenerationLimitType} onValueChange={(v) => setImageGenerationLimitType(v as 'daily' | 'lifetime')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="daily">Per Day</SelectItem><SelectItem value="lifetime">Per Package</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Music Generation</Label>
            <div className="col-span-3 space-y-3 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Checkbox id="allowMusicGeneration-edit" checked={allowMusicGeneration} onCheckedChange={(checked) => setAllowMusicGeneration(Boolean(checked))} />
                <Label htmlFor="allowMusicGeneration-edit" className="text-sm font-normal">Enabled</Label>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="musicGenerationLimit-edit" className="text-xs text-muted-foreground">Generation Limit</Label>
                <div className="grid grid-cols-2 gap-2">
                <Input id="musicGenerationLimit-edit" type="number" value={musicGenerationLimit} onChange={e => setMusicGenerationLimit(e.target.value)} placeholder="e.g., 5" />
                <Select value={musicGenerationLimitType} onValueChange={(v) => setMusicGenerationLimitType(v as any)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="daily">Per Day</SelectItem>
                        <SelectItem value="lifetime">Per Package</SelectItem>
                    </SelectContent>
                </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="allowMusicGenerationAssist-edit" checked={allowMusicGenerationAssist} onCheckedChange={(checked) => setAllowMusicGenerationAssist(Boolean(checked))} />
                <Label htmlFor="allowMusicGenerationAssist-edit" className="text-sm font-normal">AI lyrics and caption assistance</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="allowMusicStyleProfiles-edit" checked={allowMusicStyleProfiles} onCheckedChange={(checked) => setAllowMusicStyleProfiles(Boolean(checked))} />
                <Label htmlFor="allowMusicStyleProfiles-edit" className="text-sm font-normal">Reusable music style profiles</Label>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Video Generation</Label>
            <div className="col-span-3 space-y-3 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Checkbox id="allowVideoGeneration-edit" checked={allowVideoGeneration} onCheckedChange={(checked) => setAllowVideoGeneration(Boolean(checked))} />
                <Label htmlFor="allowVideoGeneration-edit" className="text-sm font-normal">Enabled</Label>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="videoGenerationLimit-edit" className="text-xs text-muted-foreground">Generation Limit</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input id="videoGenerationLimit-edit" type="number" value={videoGenerationLimit} onChange={e => setVideoGenerationLimit(e.target.value)} placeholder="e.g., 5" />
                  <Select value={videoGenerationLimitType} onValueChange={(v) => setVideoGenerationLimitType(v as 'daily' | 'lifetime')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="daily">Per Day</SelectItem><SelectItem value="lifetime">Per Package</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            </div>
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
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="aiRankedPayoutEnabled-edit" className="text-right">AI ranked payout?</Label>
                <div className="col-span-3 flex items-center gap-2">
                    <Checkbox id="aiRankedPayoutEnabled-edit" checked={aiRankedPayoutEnabled} onCheckedChange={(checked) => setAiRankedPayoutEnabled(Boolean(checked))} />
                    <Label htmlFor="aiRankedPayoutEnabled-edit" className="font-normal text-sm text-muted-foreground">AI-ranked payout (when global mode is per package)</Label>
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
                    <div className="space-y-1">
                        <Label htmlFor="bonus-minimum-edit" className="text-xs text-muted-foreground">Minimum Deposit ($)</Label>
                        <Input id="bonus-minimum-edit" type="number" min="0" value={referralBonusMinimumDeposit} onChange={e => setReferralBonusMinimumDeposit(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="bonus-maximum-edit" className="text-xs text-muted-foreground">Maximum Bonus ($, 0 = none)</Label>
                        <Input id="bonus-maximum-edit" type="number" min="0" value={referralBonusMaximum} onChange={e => setReferralBonusMaximum(e.target.value)} />
                    </div>
                    <div className="col-span-2 flex items-center gap-2 pt-1">
                        <Checkbox id="bonus-first-only-edit" checked={referralBonusFirstDepositOnly} onCheckedChange={(checked) => setReferralBonusFirstDepositOnly(Boolean(checked))} />
                        <Label htmlFor="bonus-first-only-edit" className="text-sm font-normal">Apply to first successful deposit only</Label>
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
              <TableHead>Features</TableHead>
              <TableHead>Contribution Limit</TableHead>
              <TableHead>Image Limit</TableHead>
              <TableHead>Music Limit</TableHead>
              <TableHead>Withdrawals</TableHead>
              <TableHead>Withdrawal Limit</TableHead>
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
                    <TableCell><Skeleton className="h-12 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
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

    const sortedPackages = useMemo(() => {
      const numericPrice = (price: string) => {
        if (price.trim().toLowerCase() === 'free') return 0;
        const match = price.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
        return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
      };

      return [...packages].sort((a, b) => {
        const priceDifference = numericPrice(a.price) - numericPrice(b.price);
        return priceDifference || a.name.localeCompare(b.name);
      });
    }, [packages]);

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
                    <TableHead className="min-w-[240px]">Features</TableHead>
                    <TableHead>Contribution Limit</TableHead>
                    <TableHead>Image Limit</TableHead>
                    <TableHead>Music Limit</TableHead>
                    <TableHead>Withdrawals</TableHead>
                    <TableHead>Withdrawal Limit</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Referral Bonus</TableHead>
                    <TableHead>Primary</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedPackages.map((pkg) => {
                      const bonusParts = [];
                      if (pkg.referralBonusPercentage) {
                          bonusParts.push(`${pkg.referralBonusPercentage}%`);
                      }
                      if (pkg.referralBonusFixed) {
                          bonusParts.push(`$${pkg.referralBonusFixed.toFixed(2)}`);
                      }
                      const bonusText = bonusParts.join(' + ') || 'N/A';
                      const limitText = (pkg.imageGenerationLimit ?? 0) > 0 
                        ? `${pkg.imageGenerationLimit} / ${pkg.imageGenerationLimitType === 'lifetime' ? 'pkg' : 'day'}`
                        : 'N/A';

                      return (
                        <TableRow key={pkg.id}>
                            <TableCell className="font-medium">{pkg.name}</TableCell>
                            <TableCell>{pkg.price}</TableCell>
                            <TableCell>
                              {(pkg.features || []).length > 0 ? (
                                <div className="flex max-w-sm flex-wrap gap-1.5">
                                  {(pkg.features || []).map((feature, index) => (
                                    <Badge key={`${pkg.id}-feature-${index}`} variant="outline" className="whitespace-normal text-left font-normal">
                                      {feature}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">No features listed</span>
                              )}
                            </TableCell>
                            <TableCell>{pkg.taskLimit}</TableCell>
                            <TableCell>{limitText}</TableCell>
                            <TableCell>{(pkg.musicGenerationLimit ?? 0) > 0 ? `${pkg.musicGenerationLimit} / ${pkg.musicGenerationLimitType === 'lifetime' ? 'pkg' : 'day'}` : 'N/A'}</TableCell>
                            <TableCell>{pkg.allowWithdrawals === false ? 'Disabled' : 'Enabled'}</TableCell>
                            <TableCell>{(pkg.withdrawalMinimumAmount ?? 0) > 0 || (pkg.withdrawalMaximumAmount ?? 0) > 0 ? `$${(pkg.withdrawalMinimumAmount ?? 0).toFixed(2)} - ${pkg.withdrawalMaximumAmount && pkg.withdrawalMaximumAmount > 0 ? `$${pkg.withdrawalMaximumAmount.toFixed(2)}` : 'No Max'}` : 'N/A'}</TableCell>
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
