
"use client";

import { useState } from "react";
import { AppSettings } from "@/lib/types";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type DepositDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    settings: AppSettings;
};

export function DepositDialog({ open, onOpenChange, settings }: DepositDialogProps) {
    const { toast } = useToast();
    const [amount, setAmount] = useState("");
    const [method, setMethod] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const depositAmount = parseFloat(amount);

        if (isNaN(depositAmount) || depositAmount <= 0) {
            toast({ title: "Invalid Amount", description: "Please enter a valid positive amount.", variant: "destructive" });
            return;
        }
        if (!method) {
            toast({ title: "No Method Selected", description: "Please select a deposit method.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        
        // This is a placeholder for the actual deposit logic.
        // In a real app, you would call a server action to interact with a payment provider API.
        try {
            // Fake delay to simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const result = { success: true, redirectUrl: method.toLowerCase().includes('plisio') ? 'https://plisio.net' : null };

            if (result.success) {
                toast({ title: "Deposit Initiated", description: `Follow the instructions to complete your deposit of $${depositAmount.toFixed(2)}.` });
                if (result.redirectUrl) {
                    window.location.href = result.redirectUrl;
                } else {
                    onOpenChange(false);
                }
            } else {
                toast({ title: "Error", description: "Could not initiate deposit.", variant: "destructive" });
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
                            <Select value={method} onValueChange={setMethod} disabled={isSubmitting}>
                                <SelectTrigger id="method">
                                    <SelectValue placeholder="Select a method" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(settings.depositMethods || []).map((m) => (
                                        <SelectItem key={m.id} value={m.name}>
                                            {m.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
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
