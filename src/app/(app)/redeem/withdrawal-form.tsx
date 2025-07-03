
"use client";

import { useState } from "react";
import type { User, AppSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { requestWithdrawal } from "@/lib/actions";

type WithdrawalFormProps = {
    user: User;
    settings: AppSettings;
    currentBalance: number;
    onWithdrawal: () => void;
};

export function WithdrawalForm({ user, settings, currentBalance, onWithdrawal }: WithdrawalFormProps) {
    const { toast } = useToast();
    const [amount, setAmount] = useState("");
    const [method, setMethod] = useState("");
    const [details, setDetails] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const scheduleParts = [];
    if (settings.withdrawalDays && settings.withdrawalDays.length > 0) {
        scheduleParts.push(`Weekly processing is available on ${settings.withdrawalDays.join(', ')}.`);
    }
    if (settings.withdrawalScheduleInfo) {
        scheduleParts.push(settings.withdrawalScheduleInfo);
    }
    const scheduleDescription = scheduleParts.join(' ') || "Withdrawal processing times are configured by the admin.";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const withdrawalAmount = parseFloat(amount);

        if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
            toast({ title: "Invalid Amount", description: "Please enter a valid amount.", variant: "destructive" });
            return;
        }
        if (withdrawalAmount > currentBalance) {
            toast({ title: "Insufficient Balance", description: "You don't have enough funds in your earnings balance to withdraw that amount.", variant: "destructive" });
            return;
        }
        if (!method) {
            toast({ title: "No Method Selected", description: "Please select a payment method.", variant: "destructive" });
            return;
        }
        if (!details.trim()) {
            toast({ title: "Payment Details Required", description: "Please enter your payment details.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        const result = await requestWithdrawal(user.id, withdrawalAmount, method, details);

        if (result.success) {
            toast({ title: "Success", description: "Your redemption request has been submitted." });
            setAmount("");
            setMethod("");
            setDetails("");
            onWithdrawal();
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setIsSubmitting(false);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>New Redemption Request</CardTitle>
                <CardDescription>
                    {scheduleDescription}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount (USD)</Label>
                        <Input
                            id="amount"
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder={`Max $${currentBalance.toFixed(2)}`}
                            max={currentBalance}
                            min="0.01"
                            step="0.01"
                            disabled={isSubmitting}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="method">Payment Method</Label>
                        <Select value={method} onValueChange={setMethod} disabled={isSubmitting}>
                            <SelectTrigger id="method">
                                <SelectValue placeholder="Select a method" />
                            </SelectTrigger>
                            <SelectContent>
                                {settings.paymentMethods.map((m) => (
                                    <SelectItem key={m.id} value={m.name}>
                                        {m.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="details">Payment Details</Label>
                        <Textarea
                            id="details"
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            placeholder="e.g., your PayPal email or bank account info"
                            rows={3}
                            disabled={isSubmitting}
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit Request
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
