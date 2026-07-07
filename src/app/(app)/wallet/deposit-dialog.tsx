
"use client";

import { useState } from "react";
import { AppSettings, DepositMethod } from "@/lib/types";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { initiateDeposit } from "@/lib/user-api";
import { auth } from "@/lib/firebase";

type DepositDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    settings: AppSettings;
    userId: string;
    onDeposit: () => void;
};

export function DepositDialog({ open, onOpenChange, settings, userId, onDeposit }: DepositDialogProps) {
    const { toast } = useToast();
    const [amount, setAmount] = useState("");
    const [methodId, setMethodId] = useState("");
    const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
    const [uploadingFieldKeys, setUploadingFieldKeys] = useState<Record<string, boolean>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const enabledMethods = (settings.depositMethods || []).filter((method) => method.enabled !== false);
    const selectedMethod = enabledMethods.find((method) => method.id === methodId) || null;

    const setFieldValue = (key: string, value: string) => {
        setFieldValues((current) => ({ ...current, [key]: value }));
    };

    const uploadFieldImage = async (fieldKey: string, file: File) => {
        if (!auth?.currentUser) {
            throw new Error('You must be logged in.');
        }

        const idToken = await auth.currentUser.getIdToken();
        const formData = new FormData();
        formData.append('purpose', 'deposit-receipt');
        formData.append('file', file);

        const uploadResponse = await fetch('/api/storage/upload', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${idToken}`,
            },
            body: formData,
        });

        const uploadResult = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok || !uploadResult?.downloadUrl) {
            throw new Error(uploadResult?.message || 'Upload failed.');
        }

        setFieldValue(fieldKey, String(uploadResult.downloadUrl));
    };

    const handleFieldFileChange = async (fieldKey: string, file?: File | null) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast({ title: 'Invalid File', description: 'Please select an image file.', variant: 'destructive' });
            return;
        }

        setUploadingFieldKeys((current) => ({ ...current, [fieldKey]: true }));
        try {
            await uploadFieldImage(fieldKey, file);
            toast({ title: 'Uploaded', description: 'Your image has been attached to the deposit request.' });
        } catch (error) {
            toast({ title: 'Upload Failed', description: error instanceof Error ? error.message : 'An unexpected error occurred.', variant: 'destructive' });
        } finally {
            setUploadingFieldKeys((current) => ({ ...current, [fieldKey]: false }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const depositAmount = parseFloat(amount);

        if (isNaN(depositAmount) || depositAmount <= 0) {
            toast({ title: "Invalid Amount", description: "Please enter a valid positive amount.", variant: "destructive" });
            return;
        }
        if (!methodId || !selectedMethod) {
            toast({ title: "No Method Selected", description: "Please select a deposit method.", variant: "destructive" });
            return;
        }

        const minimumAmount = Number(selectedMethod.minimumAmount || 0);
        const maximumAmount = Number(selectedMethod.maximumAmount || 0);
        if (Number.isFinite(minimumAmount) && minimumAmount > 0 && depositAmount < minimumAmount) {
            toast({ title: "Amount Too Low", description: `The minimum for ${selectedMethod.name} is $${minimumAmount.toFixed(2)}.`, variant: "destructive" });
            return;
        }
        if (Number.isFinite(maximumAmount) && maximumAmount > 0 && depositAmount > maximumAmount) {
            toast({ title: "Amount Too High", description: `The maximum for ${selectedMethod.name} is $${maximumAmount.toFixed(2)}.`, variant: "destructive" });
            return;
        }

        const missingField = (selectedMethod.customFields || []).find((field) => field.required && !String(fieldValues[field.key] || '').trim());
        if (missingField) {
            toast({ title: "Missing Field", description: `${missingField.label} is required.`, variant: "destructive" });
            return;
        }

        if (Object.values(uploadingFieldKeys).some(Boolean)) {
            toast({ title: 'Please wait', description: 'An image upload is still in progress.', variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        
        try {
            const result = await initiateDeposit(userId, depositAmount, methodId, fieldValues);

            if (result.success) {
                toast({ title: "Success", description: result.message });
                 if (selectedMethod?.provider === 'plisio' && typeof (result as any).invoiceUrl === 'string') {
                    toast({ title: "Redirecting...", description: `You will be redirected to Plisio to complete your deposit.` });
                    window.location.href = (result as any).invoiceUrl;
                } else {
                    onOpenChange(false);
                }
                onDeposit();
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Make a Deposit</DialogTitle>
                    <DialogDescription>
                        Add funds to your deposit balance. You can use these funds to purchase premium packages.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount">Amount (USD)</Label>
                            <Input
                                id="amount"
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="$10.00"
                                min="1"
                                step="0.01"
                                disabled={isSubmitting}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="method">Deposit Method</Label>
                            <Select value={methodId} onValueChange={(value) => {
                                setMethodId(value);
                                setFieldValues({});
                            }} disabled={isSubmitting}>
                                <SelectTrigger id="method">
                                    <SelectValue placeholder="Select a method" />
                                </SelectTrigger>
                                <SelectContent>
                                    {enabledMethods.map((m) => (
                                        <SelectItem key={m.id} value={m.id}>
                                            {m.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedMethod && (
                            <div className="space-y-3 rounded-md border p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-semibold">{selectedMethod.name}</p>
                                        <p className="text-xs text-muted-foreground">{selectedMethod.description || 'Enter the fields required for this method.'}</p>
                                    </div>
                                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{selectedMethod.provider}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {selectedMethod.provider === 'custom' || selectedMethod.processingMode === 'admin_verified'
                                        ? 'This method is reviewed by an admin after you submit the request.'
                                        : 'This method is processed automatically after submission.'}
                                </p>
                                {(selectedMethod.minimumAmount || selectedMethod.maximumAmount) ? (
                                    <p className="text-xs text-muted-foreground">
                                        {selectedMethod.minimumAmount ? `Min: $${Number(selectedMethod.minimumAmount).toFixed(2)} ` : ''}
                                        {selectedMethod.maximumAmount ? `Max: $${Number(selectedMethod.maximumAmount).toFixed(2)}` : ''}
                                    </p>
                                ) : null}
                                {selectedMethod.customFields && selectedMethod.customFields.length > 0 && (
                                    <div className="space-y-3">
                                        {selectedMethod.customFields.map((field) => (
                                            <div key={field.key} className="space-y-2">
                                                <Label htmlFor={`deposit-field-${field.key}`}>{field.label}{field.required ? ' *' : ''}</Label>
                                                {field.inputType === 'image' ? (
                                                    <div className="space-y-2">
                                                        <Input
                                                            id={`deposit-field-${field.key}`}
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={(event) => void handleFieldFileChange(field.key, event.target.files?.[0] || null)}
                                                            disabled={isSubmitting || uploadingFieldKeys[field.key] === true}
                                                        />
                                                        <p className="text-xs text-muted-foreground">
                                                            {field.placeholder || 'Upload a receipt, cheque, or other image for review.'}
                                                        </p>
                                                        {fieldValues[field.key] ? (
                                                            <p className="text-xs text-muted-foreground">Image uploaded and attached to this request.</p>
                                                        ) : null}
                                                    </div>
                                                ) : field.inputType === 'textarea' ? (
                                                    <Textarea
                                                        id={`deposit-field-${field.key}`}
                                                        value={fieldValues[field.key] || ''}
                                                        onChange={(event) => setFieldValue(field.key, event.target.value)}
                                                        placeholder={field.placeholder || field.label}
                                                        disabled={isSubmitting}
                                                    />
                                                ) : (
                                                    <Input
                                                        id={`deposit-field-${field.key}`}
                                                        value={fieldValues[field.key] || ''}
                                                        onChange={(event) => setFieldValue(field.key, event.target.value)}
                                                        placeholder={field.placeholder || field.label}
                                                        disabled={isSubmitting}
                                                        type={field.inputType || 'text'}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {selectedMethod.provider === 'plisio' && (
                                    <p className="text-xs text-muted-foreground">Plisio payments will open an invoice after submission.</p>
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline" type="button">Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Proceed to Deposit
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

    