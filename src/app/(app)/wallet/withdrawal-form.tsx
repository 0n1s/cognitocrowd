"use client";

import { useEffect, useState } from "react";
import type { AppSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { requestWithdrawal } from "@/lib/user-api";
import { auth } from "@/lib/firebase";
import { useSessionCurrency } from "@/hooks/use-session-currency";
import { useDisplayCurrency } from "@/hooks/use-display-currency";

type WithdrawalFormProps = {
    userId: string;
    settings: AppSettings;
    currentBalance: number;
    minWithdrawalAmount?: number;
    maxWithdrawalAmount?: number;
    withdrawalsAllowed?: boolean;
    onWithdrawal: () => void;
};

export function WithdrawalForm({ userId, settings, currentBalance, minWithdrawalAmount = 0, maxWithdrawalAmount = 0, withdrawalsAllowed = true, onWithdrawal }: WithdrawalFormProps) {
    const { toast } = useToast();
    const { currency, applyCurrencyConfig } = useSessionCurrency();
    const { formatAmount } = useDisplayCurrency();
    const [amount, setAmount] = useState("");
    const [methodId, setMethodId] = useState("");
    const [details, setDetails] = useState("");
    const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
    const [uploadingFieldKeys, setUploadingFieldKeys] = useState<Record<string, boolean>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const configuredMethods = (settings.withdrawalMethods && settings.withdrawalMethods.length > 0)
        ? settings.withdrawalMethods
        : (settings.paymentMethods || []).map((method) => ({
            id: method.id,
            name: method.name,
            provider: 'custom' as const,
            enabled: true,
            processingMode: 'admin_verified' as const,
            customFields: [],
        }));
    const enabledMethods = configuredMethods.filter((method) => method.enabled !== false);
    const selectedMethod = enabledMethods.find((method) => method.id === methodId) || null;
    const selectedCustomFields = selectedMethod?.customFields || [];
    const shouldUseLegacyDetailsField = selectedCustomFields.length === 0;

    useEffect(() => {
        applyCurrencyConfig(settings.defaultCurrency, settings.supportedCurrencies);
    }, [applyCurrencyConfig, settings.defaultCurrency, settings.supportedCurrencies]);

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
            toast({ title: 'Uploaded', description: 'Your image has been attached to the withdrawal request.' });
        } catch (error) {
            toast({ title: 'Upload Failed', description: error instanceof Error ? error.message : 'An unexpected error occurred.', variant: 'destructive' });
        } finally {
            setUploadingFieldKeys((current) => ({ ...current, [fieldKey]: false }));
        }
    };

    const scheduleParts = [];
    if (settings.withdrawalDays && settings.withdrawalDays.length > 0) {
        scheduleParts.push(`Weekly processing is available on ${settings.withdrawalDays.join(', ')}.`);
    }
    if (settings.withdrawalScheduleInfo) {
        scheduleParts.push(settings.withdrawalScheduleInfo);
    }
    const scheduleDescription = scheduleParts.join(' ') || "Withdrawal processing times are configured by the admin.";

    const currentWeekday = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).format(new Date());
    const normalizedToday = currentWeekday.trim().toLowerCase();
    const normalizedAllowedDays = (settings.withdrawalDays || []).map((day) => day.trim().toLowerCase());
    const isWithdrawalDayAllowed = normalizedAllowedDays.length === 0 || normalizedAllowedDays.includes(normalizedToday);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isWithdrawalDayAllowed) {
            toast({
                title: "Withdrawals Unavailable Today",
                description: settings.withdrawalDays?.length
                    ? `Withdrawals are only processed on ${settings.withdrawalDays.join(', ')}.`
                    : "Withdrawals are currently unavailable today.",
                variant: "destructive",
            });
            return;
        }

        if (!withdrawalsAllowed) {
            toast({
                title: "Withdrawals Disabled",
                description: "Withdrawals are not available on your current package.",
                variant: "destructive",
            });
            return;
        }

        const withdrawalAmount = parseFloat(amount);

        if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
            toast({ title: "Invalid Amount", description: "Please enter a valid amount.", variant: "destructive" });
            return;
        }
        if (withdrawalAmount > currentBalance) {
            toast({ title: "Insufficient Balance", description: "You don't have enough funds in your earnings balance to withdraw that amount.", variant: "destructive" });
            return;
        }
        const isUsdInput = currency === 'USD';
        if (isUsdInput && minWithdrawalAmount > 0 && withdrawalAmount < minWithdrawalAmount) {
            toast({ title: "Below Minimum", description: `Minimum withdrawal amount is ${formatAmount(minWithdrawalAmount, 'USD')}.`, variant: "destructive" });
            return;
        }
        if (isUsdInput && maxWithdrawalAmount > 0 && withdrawalAmount > maxWithdrawalAmount) {
            toast({ title: "Above Maximum", description: `Maximum withdrawal amount is ${formatAmount(maxWithdrawalAmount, 'USD')}.`, variant: "destructive" });
            return;
        }
        if (!methodId || !selectedMethod) {
            toast({ title: "No Method Selected", description: "Please select a payment method.", variant: "destructive" });
            return;
        }

        const missingField = selectedCustomFields.find((field) => field.required && !String(fieldValues[field.key] || '').trim());
        if (missingField) {
            toast({ title: "Missing Field", description: `${missingField.label} is required.`, variant: "destructive" });
            return;
        }

        if (Object.values(uploadingFieldKeys).some(Boolean)) {
            toast({ title: 'Please wait', description: 'An image upload is still in progress.', variant: 'destructive' });
            return;
        }

        if (shouldUseLegacyDetailsField && !details.trim()) {
            toast({ title: "Payment Details Required", description: "Please enter your payment details.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        const payloadFields = shouldUseLegacyDetailsField
            ? { details: details.trim() }
            : fieldValues;
        const result = await requestWithdrawal(userId, withdrawalAmount, methodId, payloadFields, currency);

        if (result.success) {
            toast({ title: "Success", description: "Your redemption request has been submitted." });
            setAmount("");
            setMethodId("");
            setDetails("");
            setFieldValues({});
            onWithdrawal();
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setIsSubmitting(false);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Redeem Earnings</CardTitle>
                <CardDescription>
                    {scheduleDescription}
                    {(minWithdrawalAmount > 0 || maxWithdrawalAmount > 0) && (
                        <span className="block mt-2">
                            Withdrawal limits: {minWithdrawalAmount > 0 ? `Min ${formatAmount(minWithdrawalAmount, 'USD')}` : 'No min'} / {maxWithdrawalAmount > 0 ? `Max ${formatAmount(maxWithdrawalAmount, 'USD')}` : 'No max'}
                        </span>
                    )}
                    {!withdrawalsAllowed && (
                        <span className="block mt-2 text-destructive">
                            Withdrawals are disabled on your current package.
                        </span>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount ({currency})</Label>
                        <Input
                            id="amount"
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder={`Max ${formatAmount(currentBalance, 'USD')}`}
                            max={maxWithdrawalAmount > 0 ? Math.min(currentBalance, maxWithdrawalAmount) : currentBalance}
                            min={minWithdrawalAmount > 0 ? minWithdrawalAmount : 0.01}
                            step="0.01"
                            disabled={isSubmitting}
                        />
                        <p className="text-xs text-muted-foreground">Session currency is set from the header picker.</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="method">Payment Method</Label>
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
                    {selectedCustomFields.length > 0 ? (
                        <div className="space-y-3 rounded-md border p-3">
                            {selectedCustomFields.map((field) => (
                                <div key={field.key} className="space-y-2">
                                    <Label htmlFor={`withdrawal-field-${field.key}`}>{field.label}{field.required ? ' *' : ''}</Label>
                                    {field.inputType === 'image' ? (
                                        <div className="space-y-2">
                                            <Input
                                                id={`withdrawal-field-${field.key}`}
                                                type="file"
                                                accept="image/*"
                                                disabled={isSubmitting || uploadingFieldKeys[field.key] === true}
                                                onChange={(e) => {
                                                    void handleFieldFileChange(field.key, e.target.files?.[0]);
                                                }}
                                            />
                                            {uploadingFieldKeys[field.key] ? <p className="text-xs text-muted-foreground">Uploading...</p> : null}
                                            {fieldValues[field.key] ? <p className="text-xs text-muted-foreground">Uploaded successfully.</p> : null}
                                        </div>
                                    ) : field.inputType === 'textarea' ? (
                                        <Textarea
                                            id={`withdrawal-field-${field.key}`}
                                            value={fieldValues[field.key] || ''}
                                            onChange={(e) => setFieldValue(field.key, e.target.value)}
                                            placeholder={field.placeholder || ''}
                                            rows={3}
                                            disabled={isSubmitting}
                                        />
                                    ) : (
                                        <Input
                                            id={`withdrawal-field-${field.key}`}
                                            value={fieldValues[field.key] || ''}
                                            onChange={(e) => setFieldValue(field.key, e.target.value)}
                                            placeholder={field.placeholder || ''}
                                            type={field.inputType || 'text'}
                                            disabled={isSubmitting}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="details">Payment Details</Label>
                            <Textarea
                                id="details"
                                value={details}
                                onChange={(e) => setDetails(e.target.value)}
                                placeholder="Enter your payout account details"
                                rows={3}
                                disabled={isSubmitting}
                            />
                        </div>
                    )}
                    <Button type="submit" className="w-full" disabled={isSubmitting || !isWithdrawalDayAllowed || !withdrawalsAllowed}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit Request
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
