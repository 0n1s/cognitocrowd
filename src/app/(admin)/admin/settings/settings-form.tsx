

"use client";

import { useState, useEffect } from "react";
import { AppSettings, PaymentMethod, OnboardingStep } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Trash2, Loader2, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateAppSettings } from "@/lib/actions";
import { getAppSettings } from "@/lib/database";
import { v4 as uuidv4 } from "uuid";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { AVAILABLE_MODELS } from "@/ai/models";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


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
                const fetchedSettings = await getAppSettings();
                if (fetchedSettings.onboardingCourseSteps && !fetchedSettings.onboardingCourseSteps.every(s => s.id)) {
                    fetchedSettings.onboardingCourseSteps = fetchedSettings.onboardingCourseSteps.map(s => ({...s, id: uuidv4()}));
                }
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
    
    const handleAddCourseStep = () => {
        if (!settings) return;
        const newSteps = [...(settings.onboardingCourseSteps || []), { id: uuidv4(), title: '', content: '' }];
        handleFieldChange('onboardingCourseSteps', newSteps);
    };

    const handleRemoveCourseStep = (id: string) => {
        if (!settings) return;
        const newSteps = (settings.onboardingCourseSteps || []).filter(step => step.id !== id);
        handleFieldChange('onboardingCourseSteps', newSteps);
    };

    const handleCourseStepChange = (id: string, field: 'title' | 'content', value: string) => {
        if (!settings) return;
        const newSteps = (settings.onboardingCourseSteps || []).map(step =>
            step.id === id ? { ...step, [field]: value } : step
        );
        handleFieldChange('onboardingCourseSteps', newSteps);
    };

    const handleSubmit = async () => {
        if (!settings) return;
        setIsSubmitting(true);
        const settingsToSave = {
            ...settings,
            paymentMethods: settings.paymentMethods.filter(m => m.name.trim() !== ''),
            depositMethods: (settings.depositMethods || []).filter(m => m.name.trim() !== ''),
            onboardingCourseSteps: (settings.onboardingCourseSteps || []).filter(s => s.title.trim() !== '' && s.content.trim() !== ''),
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

                <Separator />

                <div>
                    <h3 className="text-lg font-semibold">User Approval Settings</h3>
                    <p className="text-sm text-muted-foreground">Automate the qualification test approval process based on user scores.</p>
                </div>
                <div className="space-y-6">
                    <div className="flex items-center space-x-2">
                        <Switch id="auto-approval-enabled" checked={settings.autoApprovalEnabled} onCheckedChange={(checked) => handleFieldChange('autoApprovalEnabled', checked)} />
                        <Label htmlFor="auto-approval-enabled">Enable Auto-Approval</Label>
                    </div>
                    {settings.autoApprovalEnabled && (
                        <div className="grid grid-cols-2 gap-4 pl-8">
                             <div className="space-y-2">
                                <Label htmlFor="auto-approval-threshold">Minimum Score for Approval (%)</Label>
                                <Input 
                                    id="auto-approval-threshold" 
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={settings.autoApprovalThreshold || 90} 
                                    onChange={(e) => handleFieldChange('autoApprovalThreshold', Number(e.target.value))} 
                                />
                                <p className="text-xs text-muted-foreground">Users scoring this or higher will be automatically approved.</p>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center space-x-2">
                        <Switch id="auto-rejection-enabled" checked={settings.autoRejectionEnabled} onCheckedChange={(checked) => handleFieldChange('autoRejectionEnabled', checked)} />
                        <Label htmlFor="auto-rejection-enabled">Enable Auto-Rejection</Label>
                    </div>
                     {settings.autoRejectionEnabled && (
                        <div className="grid grid-cols-2 gap-4 pl-8">
                             <div className="space-y-2">
                                <Label htmlFor="auto-rejection-threshold">Score for Rejection (%)</Label>
                                <Input 
                                    id="auto-rejection-threshold" 
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={settings.autoRejectionThreshold || 50} 
                                    onChange={(e) => handleFieldChange('autoRejectionThreshold', Number(e.target.value))} 
                                />
                                <p className="text-xs text-muted-foreground">Users scoring below this will be automatically rejected.</p>
                            </div>
                        </div>
                    )}
                </div>
                
                 <div>
                    <h3 className="text-lg font-semibold">Onboarding Course Settings</h3>
                    <p className="text-sm text-muted-foreground">Configure the optional course for new users.</p>
                    <div className="mt-6 space-y-6">
                        <div className="flex items-center space-x-2">
                            <Switch id="onboarding-enabled" checked={settings.onboardingCourseEnabled} onCheckedChange={(checked) => handleFieldChange('onboardingCourseEnabled', checked)} />
                            <Label htmlFor="onboarding-enabled">Enable Onboarding Course</Label>
                        </div>
                        
                        {settings.onboardingCourseEnabled && (
                            <div className="space-y-4 pl-4 border-l-2">
                                <div className="space-y-2">
                                    <Label htmlFor="course-title">Course Title</Label>
                                    <Input id="course-title" value={settings.onboardingCourseTitle || ''} onChange={(e) => handleFieldChange('onboardingCourseTitle', e.target.value)} />
                                </div>
                                 <div className="space-y-2">
                                    <Label htmlFor="course-desc">Course Description</Label>
                                    <Textarea id="course-desc" value={settings.onboardingCourseDescription || ''} onChange={(e) => handleFieldChange('onboardingCourseDescription', e.target.value)} />
                                </div>
                                <div>
                                    <Label className="text-base font-semibold">Course Steps</Label>
                                    <div className="space-y-4 mt-2">
                                        {(settings.onboardingCourseSteps || []).map((step, index) => (
                                            <div key={step.id} className="p-4 border rounded-lg space-y-2 bg-muted/50 relative">
                                                <Label htmlFor={`step-title-${index}`}>Step {index + 1} Title</Label>
                                                <Input id={`step-title-${index}`} value={step.title} onChange={(e) => handleCourseStepChange(step.id, 'title', e.target.value)} />
                                                <Label htmlFor={`step-content-${index}`}>Step Content</Label>
                                                <Textarea id={`step-content-${index}`} value={step.content} onChange={(e) => handleCourseStepChange(step.id, 'content', e.target.value)} />
                                                 <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => handleRemoveCourseStep(step.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button variant="outline" size="sm" onClick={handleAddCourseStep}>
                                            <PlusCircle className="mr-2 h-4 w-4" /> Add Step
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <Separator />
                
                <div>
                    <h3 className="text-lg font-semibold">AI Model Settings</h3>
                    <p className="text-sm text-muted-foreground">Configure the default generative model for AI features.</p>
                </div>
                <div className="space-y-4">
                    <Label className="text-base font-semibold">Default Generative AI Model</Label>
                    <p className="text-sm text-muted-foreground">
                        Select the default model to use for features like the AI Assistant and contribution generation.
                        Note: For Groq, add `GROQ_API_KEY` to your .env file. For Ollama, ensure it's running locally.
                    </p>
                    <Select
                        value={settings.defaultGenAiModel}
                        onValueChange={(value) => handleFieldChange('defaultGenAiModel', value)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent>
                            {AVAILABLE_MODELS.map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                    {model.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Separator />

                <div>
                    <h3 className="text-lg font-semibold">Deposit Settings</h3>
                    <p className="text-sm text-muted-foreground">Manage accepted deposit methods.</p>
                </div>
                <div className="space-y-4">
                    <Label className="text-base font-semibold">Deposit Methods</Label>
                    <div className="space-y-2">
                        {(settings.depositMethods || []).map((method) => (
                            <div key={method.id} className="flex items-center gap-2">
                                <Input
                                    value={method.name}
                                    onChange={(e) => handleMethodNameChange(method.id, e.target.value, 'deposit')}
                                    placeholder="e.g., Plisio (Crypto)"
                                />
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveMethod(method.id, 'deposit')}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleAddMethod('deposit')}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Method
                    </Button>
                </div>
                
                <Separator />
                
                <div>
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
