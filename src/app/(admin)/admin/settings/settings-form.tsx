
"use client";

import { useState, useEffect } from "react";
import { AppSettings, PaymentMethod } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateAppSettings } from "@/lib/actions";
import { getAppSettings } from "@/lib/database";
import { v4 as uuidv4 } from "uuid";
import { Checkbox } from "@/components/ui/checkbox";

const LoadingSkeleton = () => (
    <Card>
        <CardHeader>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-6">
            <div>
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-10 w-full" />
            </div>
            <div>
                <Skeleton className="h-5 w-40 mb-2" />
                <Skeleton className="h-20 w-full" />
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
                const fetchedSettings = await getAppSettings();
                setSettings(fetchedSettings);
            } catch (error) {
                toast({ title: "Error", description: "Failed to load settings.", variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [toast]);

    const handleAddMethod = () => {
        if (!settings) return;
        const newMethod = { id: uuidv4(), name: "" };
        setSettings({
            ...settings,
            paymentMethods: [...settings.paymentMethods, newMethod],
        });
    };

    const handleRemoveMethod = (id: string) => {
        if (!settings) return;
        setSettings({
            ...settings,
            paymentMethods: settings.paymentMethods.filter((m) => m.id !== id),
        });
    };

    const handleMethodNameChange = (id: string, name: string) => {
        if (!settings) return;
        setSettings({
            ...settings,
            paymentMethods: settings.paymentMethods.map((m) =>
                m.id === id ? { ...m, name } : m
            ),
        });
    };

    const handleScheduleChange = (info: string) => {
        if (!settings) return;
        setSettings({ ...settings, withdrawalScheduleInfo: info });
    };

    const handleDayChange = (day: string, checked: boolean) => {
        if (!settings) return;
        const currentDays = settings.withdrawalDays || [];
        const newDays = checked
            ? [...currentDays, day]
            : currentDays.filter((d) => d !== day);
        setSettings({ ...settings, withdrawalDays: newDays });
    };

    const handleSubmit = async () => {
        if (!settings) return;
        setIsSubmitting(true);
        const result = await updateAppSettings({
            ...settings,
            paymentMethods: settings.paymentMethods.filter(m => m.name.trim() !== '')
        });
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
            <CardHeader>
                <CardTitle>Withdrawal Settings</CardTitle>
                <CardDescription>
                    Manage payment methods and the withdrawal schedule for users.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="space-y-4">
                    <Label className="text-base font-semibold">Payment Methods</Label>
                    <div className="space-y-2">
                        {settings.paymentMethods.map((method) => (
                            <div key={method.id} className="flex items-center gap-2">
                                <Input
                                    value={method.name}
                                    onChange={(e) => handleMethodNameChange(method.id, e.target.value)}
                                    placeholder="e.g., PayPal"
                                />
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveMethod(method.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={handleAddMethod}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Method
                    </Button>
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
                        onChange={(e) => handleScheduleChange(e.target.value)}
                        placeholder="e.g., Withdrawals are also processed on the 1st and 15th of each month."
                    />
                    <p className="text-xs text-muted-foreground">
                        This text is shown to users in addition to any weekly schedule. Use for non-weekday schedules.
                    </p>
                </div>

                <div>
                     <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Settings
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
