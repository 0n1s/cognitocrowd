
"use client";

import { useState, useEffect } from "react";
import { AppSettings, PaymentMethod } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAdminAppSettings, updateAppSettings } from "@/lib/admin-api";
import { v4 as uuidv4 } from "uuid";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { AVAILABLE_MODELS } from "@/ai/models";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DepositMethodsManager } from "@/components/admin/deposit-methods-manager";


const LoadingSkeleton = () => (
    <Card>
        <CardContent className="pt-6 space-y-6">
            <div>
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-10 w-full" />
            </div>
            <div>
                <Skeleton className="h-5 w-40 mb-2" />
                <Skeleton className="h-20 w-full" />
            </div>
             <div>
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-10 w-full" />
            </div>
        </CardContent>
    </Card>
)

export function SettingsForm() {
    const { toast } = useToast();
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            try {
                const result = await getAdminAppSettings();
                if (!result.success || !result.settings) {
                    throw new Error(result.message || 'Failed to load settings.');
                }
                const fetchedSettings = result.settings;
                fetchedSettings.withdrawalMinimumAmount = Number(fetchedSettings.withdrawalMinimumAmount || 0);
                fetchedSettings.withdrawalMaximumAmount = Number(fetchedSettings.withdrawalMaximumAmount || 0);
                setSettings(fetchedSettings);
            } catch (error) {
                toast({ title: "Error", description: "Failed to load settings.", variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [toast]);

    const handleFieldChange = (field: keyof AppSettings, value: any) => {
        if (!settings) return;
        setSettings({ ...settings, [field]: value });
    };

    const handleAddMethod = (type: 'withdrawal' | 'deposit') => {
        if (!settings) return;
        const newMethod = { id: uuidv4(), name: "" };
        if (type === 'withdrawal') {
            setSettings({
                ...settings,
                paymentMethods: [...settings.paymentMethods, newMethod],
            });
        } else {
            setSettings({
                ...settings,
                depositMethods: [...(settings.depositMethods || []), newMethod],
            });
        }
    };

    const handleRemoveMethod = (id: string, type: 'withdrawal' | 'deposit') => {
        if (!settings) return;
        if (type === 'withdrawal') {
            setSettings({
                ...settings,
                paymentMethods: settings.paymentMethods.filter((m) => m.id !== id),
            });
        } else {
            setSettings({
                ...settings,
                depositMethods: (settings.depositMethods || []).filter((m) => m.id !== id),
            });
        }
    };

    const handleMethodNameChange = (id: string, name: string, type: 'withdrawal' | 'deposit') => {
        if (!settings) return;
        if (type === 'withdrawal') {
            setSettings({
                ...settings,
                paymentMethods: settings.paymentMethods.map((m) =>
                    m.id === id ? { ...m, name } : m
                ),
            });
        } else {
             setSettings({
                ...settings,
                depositMethods: (settings.depositMethods || []).map((m) =>
                    m.id === id ? { ...m, name } : m
                ),
            });
        }
    };
    
     const handleDayChange = (day: string, checked: boolean) => {
        if (!settings) return;
        const currentDays = settings.withdrawalDays || [];
        const newDays = checked
            ? [...currentDays, day]
            : currentDays.filter((d) => d !== day);
        handleFieldChange('withdrawalDays', newDays);
    };
    
    const handleSubmit = async () => {
        if (!settings) return;
        setIsSubmitting(true);
        const settingsToSave = {
            ...settings,
            paymentMethods: settings.paymentMethods.filter(m => m.name.trim() !== ''),
            depositMethods: (settings.depositMethods || []).filter(m => m.name.trim() !== ''),
        };

        const result = await updateAppSettings(settingsToSave);
        if (result.success) {
            toast({ title: "Success", description: result.message });
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setIsSubmitting(false);
    };

    if (loading) return <LoadingSkeleton />;
    if (!settings) return <p>Could not load settings.</p>;

    return (
        <Card>
            <CardContent className="pt-6 space-y-12">
                
                <div>
                    <h3 className="text-lg font-semibold">AI Model Settings</h3>
                    <h3 className="text-lg font-semibold">Withdrawal Settings</h3>
                    <p className="text-sm text-muted-foreground">Manage payment methods and the withdrawal schedule for users.</p>
                </div>
                <div className="space-y-4">
                    <Label className="text-base font-semibold">Withdrawal Payment Methods</Label>
                    <div className="space-y-2">
                        {settings.paymentMethods.map((method) => (
                            <div key={method.id} className="flex items-center gap-2">
                                <Input
                                    value={method.name}
                                    onChange={(e) => handleMethodNameChange(method.id, e.target.value, 'withdrawal')}
                                    placeholder="e.g., PayPal"
                                />
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveMethod(method.id, 'withdrawal')}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleAddMethod('withdrawal')}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Method
                    </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="withdrawal-min-amount" className="text-base font-semibold">Global Minimum Withdrawal (USD)</Label>
                        <Input
                            id="withdrawal-min-amount"
                            type="number"
                            min="0"
                            step="0.01"
                            value={settings.withdrawalMinimumAmount ?? 0}
                            onChange={(e) => handleFieldChange('withdrawalMinimumAmount', Number(e.target.value) || 0)}
                            placeholder="0"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="withdrawal-max-amount" className="text-base font-semibold">Global Maximum Withdrawal (USD)</Label>
                        <Input
                            id="withdrawal-max-amount"
                            type="number"
                            min="0"
                            step="0.01"
                            value={settings.withdrawalMaximumAmount ?? 0}
                            onChange={(e) => handleFieldChange('withdrawalMaximumAmount', Number(e.target.value) || 0)}
                            placeholder="0"
                        />
                        <p className="text-xs text-muted-foreground">Set to 0 for no maximum.</p>
                    </div>
                </div>
                
                <div className="space-y-4">
                    <Label className="text-base font-semibold">Weekly Withdrawal Days</Label>
                    <p className="text-sm text-muted-foreground">
                        Select specific days of the week for processing withdrawals. This will be shown to users.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-2">
                        {weekdays.map((day) => (
                            <div key={day} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`day-${day}`}
                                    checked={settings.withdrawalDays?.includes(day)}
                                    onCheckedChange={(checked) => handleDayChange(day, checked as boolean)}
                                />
                                <Label htmlFor={`day-${day}`} className="font-normal">{day}</Label>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="schedule" className="text-base font-semibold">
                        Custom Schedule Information
                    </Label>
                    <Textarea
                        id="schedule"
                        value={settings.withdrawalScheduleInfo}
                        onChange={(e) => handleFieldChange('withdrawalScheduleInfo', e.target.value)}
                        placeholder="e.g., Withdrawals are also processed on the 1st and 15th of each month."
                    />
                    <p className="text-xs text-muted-foreground">
                        This text is shown to users in addition to any weekly schedule. Use for non-weekday schedules.
                    </p>
                </div>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Settings
                </Button>
            </CardFooter>
        </Card>
    );
}
