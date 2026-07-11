

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AiProviderConfig, AppSettings, OnboardingStep, type PublicPageKey } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Trash2, Loader2, GripVertical, RefreshCw, Copy, Check, ChevronDown, Sparkles, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { discoverOpenAiCompatibleModels, generateFaqItems, generatePublicTrustPage, improveLandingPageText } from "@/lib/actions";
import { auth } from "@/lib/firebase";
import { getAdminAppSettings, testAdminModel } from "@/lib/admin-api";
import { v4 as uuidv4 } from "uuid";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AVAILABLE_MODELS, type ModelModality, type ModelOption } from "@/ai/models";
import { DepositMethodsManager } from "@/components/admin/deposit-methods-manager";
import { WithdrawalMethodsManager } from "@/components/admin/withdrawal-methods-manager";
import { plainTextToTrustPageHtml, sanitizeTrustPageHtml } from "@/lib/trust-page-html";

type CustomModelType = 'uncensored' | 'vision' | 'hacking' | 'coding';

type TomSelectOption = {
    id: string;
    name: string;
};

type DiscoveredModel = {
    id: string;
    modalities?: ModelModality[];
};

type DiscoverModelsResponse = {
    success: boolean;
    message: string;
    models?: (string | { id?: string; modalities?: string[] })[];
};

type TomSelectInstance = {
    destroy: () => void;
    clearOptions: () => void;
    addOption: (option: { value: string; text: string } | Array<{ value: string; text: string }>) => void;
    refreshOptions: (triggerDropdown: boolean) => void;
    setValue: (value: string, silent?: boolean) => void;
    on: (event: string, cb: (value: string) => void) => void;
};

function getTimeZoneOffsetLabel(timeZone: string): string {
    try {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZoneName: "shortOffset",
        }).formatToParts(new Date());
        const zonePart = parts.find((part) => part.type === "timeZoneName")?.value || "UTC";
        return zonePart.replace("GMT", "UTC");
    } catch {
        return "UTC";
    }
}

function SearchableModelSelect({
    id,
    label,
    placeholder,
    options,
    value,
    onChange,
}: {
    id: string;
    label: string;
    placeholder: string;
    options: TomSelectOption[];
    value?: string;
    onChange: (value: string) => void;
}) {
    const selectRef = useRef<HTMLSelectElement | null>(null);
    const tomSelectRef = useRef<TomSelectInstance | null>(null);

    const syncTomSelectOptions = (instance: TomSelectInstance, optionList: TomSelectOption[], selectedValue?: string) => {
        const optionMap = new Map(optionList.map((option) => [option.id, option.name]));

        const allOptions = Array.from(optionMap.entries()).map(([idValue, nameValue]) => ({
            value: idValue,
            text: nameValue,
        }));

        instance.clearOptions();
        instance.addOption(allOptions);
        if (selectedValue && optionMap.has(selectedValue)) {
            instance.setValue(selectedValue, true);
        } else {
            instance.setValue('', true);
        }
        instance.refreshOptions(false);
    };

    useEffect(() => {
        let isMounted = true;

        const setup = async () => {
            if (!selectRef.current) return;
            const TomSelect = (await import("tom-select")).default;
            if (!isMounted || !selectRef.current) return;

            const instance = new TomSelect(selectRef.current, {
                maxItems: 1,
                create: false,
                valueField: "value",
                labelField: "text",
                searchField: ["text", "value"],
                sortField: [{ field: "text", direction: "asc" }],
                placeholder,
            }) as unknown as TomSelectInstance;

            instance.on("change", (selectedValue: string) => {
                onChange(selectedValue || "");
            });

            syncTomSelectOptions(instance, options, value);
            tomSelectRef.current = instance;
        };

        setup();

        return () => {
            isMounted = false;
            tomSelectRef.current?.destroy();
            tomSelectRef.current = null;
        };
    }, [onChange, placeholder]);

    useEffect(() => {
        const instance = tomSelectRef.current;
        if (!instance) return;
        syncTomSelectOptions(instance, options, value);
    }, [options, value]);

    return (
        <div className="space-y-2">
            <Label htmlFor={id} className="text-base font-semibold">{label}</Label>
            <select id={id} ref={selectRef} defaultValue={value || ""} className="w-full" />
            <p className="text-xs text-muted-foreground">Selected: {value || "None"}</p>
        </div>
    );
}

function TrustPageRichTextEditor({
    id,
    value,
    onChange,
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
}) {
    const editorRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor || document.activeElement === editor) return;
        editor.innerHTML = sanitizeTrustPageHtml(value || '');
    }, [value]);

    const commitEditorValue = () => {
        const editor = editorRef.current;
        if (!editor) return;
        const nextValue = sanitizeTrustPageHtml(editor.innerHTML);
        if (nextValue !== editor.innerHTML) {
            editor.innerHTML = nextValue;
        }
        onChange(nextValue);
    };

    const runCommand = (command: string, commandValue?: string) => {
        editorRef.current?.focus();
        document.execCommand(command, false, commandValue);
        commitEditorValue();
    };

    const insertHtml = (html: string) => {
        editorRef.current?.focus();
        document.execCommand('insertHTML', false, sanitizeTrustPageHtml(html));
        commitEditorValue();
    };

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-2 rounded-md border bg-muted/30 p-2">
                <Button type="button" variant="outline" size="sm" onClick={() => runCommand('formatBlock', 'h2')}>H2</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => runCommand('formatBlock', 'h3')}>H3</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => runCommand('bold')}>Bold</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => runCommand('italic')}>Italic</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => runCommand('insertUnorderedList')}>List</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => insertHtml('<section class="trust-section"><h2>Section title</h2><p>Write the details here.</p></section>')}>Section</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => insertHtml('<div class="trust-callout"><p>Important note for users.</p></div>')}>Callout</Button>
            </div>
            <div
                id={id}
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="trust-content min-h-72 rounded-md border bg-background p-4 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onInput={commitEditorValue}
                onBlur={commitEditorValue}
                onPaste={(event) => {
                    event.preventDefault();
                    const pastedHtml = event.clipboardData.getData('text/html');
                    const pastedText = event.clipboardData.getData('text/plain');
                    insertHtml(pastedHtml ? sanitizeTrustPageHtml(pastedHtml) : plainTextToTrustPageHtml(pastedText));
                }}
            />
        </div>
    );
}


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
    const [discoveringProviderId, setDiscoveringProviderId] = useState<string | null>(null);
    const [testingModality, setTestingModality] = useState<ModelModality | null>(null);
    const [isUserApprovalSettingsOpen, setIsUserApprovalSettingsOpen] = useState(false);
    const [isDepositWithdrawalSettingsOpen, setIsDepositWithdrawalSettingsOpen] = useState(false);
    const [isEmailNotificationSettingsOpen, setIsEmailNotificationSettingsOpen] = useState(false);
    const [isOnboardingSettingsOpen, setIsOnboardingSettingsOpen] = useState(false);
    const [isFaqSettingsOpen, setIsFaqSettingsOpen] = useState(false);
    const [isSupportSettingsOpen, setIsSupportSettingsOpen] = useState(false);
    const [isPublicPagesOpen, setIsPublicPagesOpen] = useState(false);
    const [isAiModelSettingsOpen, setIsAiModelSettingsOpen] = useState(false);
    const [faqAiAction, setFaqAiAction] = useState<string | null>(null);
    const [publicTrustAiAction, setPublicTrustAiAction] = useState<PublicPageKey | null>(null);
    const [testEmailDialogOpen, setTestEmailDialogOpen] = useState(false);
    const [testEmailTo, setTestEmailTo] = useState('');
    const [testEmailSubject, setTestEmailSubject] = useState('');
    const [testEmailBody, setTestEmailBody] = useState('');
    const [testResults, setTestResults] = useState<Record<ModelModality, {
        message?: string;
        text?: string;
        imageUrl?: string;
        videoUrl?: string;
        thumbnailUrl?: string;
        audioUrl?: string;
        simulated?: boolean;
        error?: string;
    }>>({
        text: {},
        image: {},
        video: {},
        audio: {},
    });
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const publicPageOptions: Array<{ key: PublicPageKey; label: string }> = [
        { key: 'about', label: 'About' },
        { key: 'contact', label: 'Contact' },
        { key: 'privacy', label: 'Privacy Policy' },
        { key: 'terms', label: 'Terms of Service' },
        { key: 'refund', label: 'Refund / Deposit Policy' },
        { key: 'guidelines', label: 'Contributor Guidelines' },
    ];

    const createProvider = (): AiProviderConfig => ({
        id: `provider-${uuidv4().slice(0, 8)}`,
        name: 'New Provider',
        baseUrl: '',
        apiKey: '',
        supportsText: true,
        supportsImage: false,
        supportsVideo: false,
        supportsAudio: false,
        discoveredModels: [],
        discoveredModelModalities: {},
        discoveredModelTypes: {},
    });

    const isUsableDiscoveredModelId = (modelId: unknown): modelId is string => {
        if (typeof modelId !== 'string') return false;
        const normalized = modelId.trim();
        if (!normalized) return false;
        const lower = normalized.toLowerCase();
        if (lower === 'unknown' || lower === 'n/a' || lower === 'none') return false;
        if (lower.includes('unknown')) return false;
        return true;
    };

    const sanitizeProviderDiscoveredModels = (provider: AiProviderConfig): AiProviderConfig => {
        const providerHasEndpoint = Boolean((provider.baseUrl || '').trim());
        if (!providerHasEndpoint) {
            return {
                ...provider,
                discoveredModels: [],
                discoveredModelModalities: {},
                discoveredModelTypes: {},
            };
        }

        const discoveredModels = (provider.discoveredModels || []).filter(isUsableDiscoveredModelId);
        const discoveredModelSet = new Set(discoveredModels);

        const discoveredModelModalities = Object.fromEntries(
            Object.entries(provider.discoveredModelModalities || {}).filter(([modelId]) => discoveredModelSet.has(modelId))
        );
        const discoveredModelTypes = Object.fromEntries(
            Object.entries(provider.discoveredModelTypes || {}).filter(([modelId]) => discoveredModelSet.has(modelId))
        );

        return {
            ...provider,
            discoveredModels,
            discoveredModelModalities,
            discoveredModelTypes,
        };
    };

    const getValidModelIds = (candidateSettings: AppSettings): Set<string> => {
        const staticIds = AVAILABLE_MODELS.map((model) => model.id);
        const discoveredIds = (candidateSettings.aiProviders || []).flatMap((provider) =>
            (provider.discoveredModels || [])
                .filter(isUsableDiscoveredModelId)
                .map((modelId) => `${provider.id}/${modelId}`)
        );
        return new Set([...staticIds, ...discoveredIds]);
    };

    const normalizeModelId = (value: string | undefined, validIds: Set<string>, fallback: string | ''): string => {
        if (!value) return fallback;
        return validIds.has(value) ? value : fallback;
    };

    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            try {
                const result = await getAdminAppSettings();
                if (!result.success || !result.settings) {
                    throw new Error(result.message || 'Failed to load settings.');
                }
                const fetchedSettings = result.settings;
                if (fetchedSettings.onboardingCourseSteps && !fetchedSettings.onboardingCourseSteps.every(s => s.id)) {
                    fetchedSettings.onboardingCourseSteps = fetchedSettings.onboardingCourseSteps.map(s => ({...s, id: uuidv4()}));
                }
                fetchedSettings.faqEnabled = fetchedSettings.faqEnabled === true;
                fetchedSettings.faqTitle = String(fetchedSettings.faqTitle || 'Frequently Asked Questions');
                fetchedSettings.faqSubtitle = String(fetchedSettings.faqSubtitle || 'Everything you need to know before joining TrainlyLabs.');
                fetchedSettings.faqItems = (fetchedSettings.faqItems || []).map((item) => ({
                    ...item,
                    id: item.id || uuidv4(),
                    enabled: item.enabled !== false,
                }));
                fetchedSettings.supportWidgetEnabled = fetchedSettings.supportWidgetEnabled === true;
                fetchedSettings.supportWidgetProvider = fetchedSettings.supportWidgetProvider || 'none';
                fetchedSettings.supportWidgetTawkPropertyId = String(fetchedSettings.supportWidgetTawkPropertyId || '');
                fetchedSettings.supportWidgetTawkWidgetId = String(fetchedSettings.supportWidgetTawkWidgetId || 'default');
                fetchedSettings.supportWidgetCrispWebsiteId = String(fetchedSettings.supportWidgetCrispWebsiteId || '');
                fetchedSettings.supportWidgetScriptUrl = String(fetchedSettings.supportWidgetScriptUrl || '');
                fetchedSettings.supportWidgetCustomScript = String(fetchedSettings.supportWidgetCustomScript || '');
                fetchedSettings.publicPages = fetchedSettings.publicPages || {};
                fetchedSettings.publicTrustCompanyContext = String(
                    fetchedSettings.publicTrustCompanyContext ||
                    'TrainlyLabs is an AI training and creative tools platform where contributors can qualify for paid tasks, use AI workspace tools, manage wallet activity, and participate in community programs. The platform values clear rules, transparent payments, contributor quality, data privacy, and responsive support.'
                );
                fetchedSettings.publicTrustPageAiModel = fetchedSettings.publicTrustPageAiModel || fetchedSettings.defaultTextGenAiModel || fetchedSettings.defaultGenAiModel || '';
                fetchedSettings.aiProviders = fetchedSettings.aiProviders || [];
                fetchedSettings.aiProviders = (fetchedSettings.aiProviders || []).map(sanitizeProviderDiscoveredModels);
                fetchedSettings.defaultTextGenAiModel = fetchedSettings.defaultTextGenAiModel || fetchedSettings.defaultGenAiModel || '';
                fetchedSettings.defaultImageGenAiModel = fetchedSettings.defaultImageGenAiModel || '';
                fetchedSettings.defaultVideoGenAiModel = fetchedSettings.defaultVideoGenAiModel || '';
                fetchedSettings.defaultAudioGenAiModel = fetchedSettings.defaultAudioGenAiModel || '';
                fetchedSettings.defaultUncensoredAiModel = fetchedSettings.defaultUncensoredAiModel || '';
                fetchedSettings.defaultVisionAiModel = fetchedSettings.defaultVisionAiModel || '';
                fetchedSettings.defaultHackingAiModel = fetchedSettings.defaultHackingAiModel || '';
                fetchedSettings.defaultCodingAiModel = fetchedSettings.defaultCodingAiModel || '';
                fetchedSettings.aiRankedPayoutMode = fetchedSettings.aiRankedPayoutMode || 'on';
                fetchedSettings.earnPerScoreEnabled = fetchedSettings.earnPerScoreEnabled !== false;
                fetchedSettings.leaderboardEnabled = fetchedSettings.leaderboardEnabled !== false;
                fetchedSettings.withdrawalMinimumAmount = Number(fetchedSettings.withdrawalMinimumAmount || 0);
                fetchedSettings.withdrawalMaximumAmount = Number(fetchedSettings.withdrawalMaximumAmount || 0);
                fetchedSettings.processingTimeZone = String(fetchedSettings.processingTimeZone || 'UTC').trim() || 'UTC';
                fetchedSettings.plisioApiKey = String(fetchedSettings.plisioApiKey || '');
                fetchedSettings.plisioPublicBaseUrl = String(fetchedSettings.plisioPublicBaseUrl || '');
                fetchedSettings.qualificationTestAntiCopyEnabled = fetchedSettings.qualificationTestAntiCopyEnabled !== false;
                fetchedSettings.qualificationTestCopyAttemptLimit = Math.max(
                    1,
                    Number.isFinite(Number(fetchedSettings.qualificationTestCopyAttemptLimit))
                        ? Math.floor(Number(fetchedSettings.qualificationTestCopyAttemptLimit))
                        : 5
                );
                fetchedSettings.qualificationTestQuestionLimit = Math.max(
                    1,
                    Number.isFinite(Number(fetchedSettings.qualificationTestQuestionLimit))
                        ? Math.floor(Number(fetchedSettings.qualificationTestQuestionLimit))
                        : 10
                );

                const validModelIds = getValidModelIds(fetchedSettings);
                fetchedSettings.defaultTextGenAiModel = normalizeModelId(
                    fetchedSettings.defaultTextGenAiModel,
                    validModelIds,
                    ''
                );
                fetchedSettings.defaultImageGenAiModel = normalizeModelId(
                    fetchedSettings.defaultImageGenAiModel,
                    validModelIds,
                    ''
                );
                fetchedSettings.defaultVideoGenAiModel = normalizeModelId(
                    fetchedSettings.defaultVideoGenAiModel,
                    validModelIds,
                    ''
                );
                fetchedSettings.defaultAudioGenAiModel = normalizeModelId(
                    fetchedSettings.defaultAudioGenAiModel,
                    validModelIds,
                    ''
                );
                fetchedSettings.defaultUncensoredAiModel = normalizeModelId(
                    fetchedSettings.defaultUncensoredAiModel,
                    validModelIds,
                    ''
                );
                fetchedSettings.defaultVisionAiModel = normalizeModelId(
                    fetchedSettings.defaultVisionAiModel,
                    validModelIds,
                    ''
                );
                fetchedSettings.defaultHackingAiModel = normalizeModelId(
                    fetchedSettings.defaultHackingAiModel,
                    validModelIds,
                    ''
                );
                fetchedSettings.defaultCodingAiModel = normalizeModelId(
                    fetchedSettings.defaultCodingAiModel,
                    validModelIds,
                    ''
                );
                fetchedSettings.publicTrustPageAiModel = normalizeModelId(
                    fetchedSettings.publicTrustPageAiModel,
                    validModelIds,
                    ''
                );
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

    const handleAddFaqItem = () => {
        if (!settings) return;
        const newItems = [...(settings.faqItems || []), { id: uuidv4(), question: '', answer: '', enabled: true }];
        handleFieldChange('faqItems', newItems);
    };

    const handleRemoveFaqItem = (id: string) => {
        if (!settings) return;
        handleFieldChange('faqItems', (settings.faqItems || []).filter((item) => item.id !== id));
    };

    const handleFaqItemChange = (id: string, field: 'question' | 'answer' | 'enabled', value: string | boolean) => {
        if (!settings) return;
        const newItems = (settings.faqItems || []).map((item) =>
            item.id === id ? { ...item, [field]: value } : item
        );
        handleFieldChange('faqItems', newItems);
    };

    const parseFaqSuggestions = (rawText: string) => {
        const trimmed = rawText.trim();
        const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
        const candidate = jsonMatch?.[0] || trimmed;
        const parsed = JSON.parse(candidate) as Array<{ question?: unknown; answer?: unknown }>;
        return parsed
            .map((item) => ({
                id: uuidv4(),
                question: String(item.question || '').trim(),
                answer: String(item.answer || '').trim(),
                enabled: true,
            }))
            .filter((item) => item.question && item.answer)
            .slice(0, 8);
    };

    const handleGenerateFaqWithAi = async () => {
        if (!settings || faqAiAction) return;
        setFaqAiAction('generate');
        try {
            const result = await generateFaqItems(6);

            if (!result.success || !result.items) {
                throw new Error(result.message || 'AI did not return FAQ suggestions.');
            }

            const suggestions = parseFaqSuggestions(JSON.stringify(result.items));
            if (suggestions.length === 0) {
                throw new Error('AI did not return usable FAQ items.');
            }

            setSettings({
                ...settings,
                faqEnabled: true,
                faqTitle: settings.faqTitle || 'Frequently Asked Questions',
                faqSubtitle: settings.faqSubtitle || 'Answers to common questions about earning, qualifying, and using TrainlyLabs.',
                faqItems: suggestions,
            });
            toast({ title: 'FAQ generated', description: `${suggestions.length} FAQ items were added. Review them before saving.` });
        } catch (error) {
            toast({
                title: 'FAQ AI failed',
                description: error instanceof Error ? error.message : 'Could not generate FAQ items.',
                variant: 'destructive',
            });
        } finally {
            setFaqAiAction(null);
        }
    };

    const handleImproveFaqField = async (
        actionKey: string,
        value: string,
        context: string,
        onImproved: (value: string) => void
    ) => {
        if (!value.trim()) {
            toast({ title: 'Nothing to improve', description: 'Enter text first, then ask AI to improve it.', variant: 'destructive' });
            return;
        }

        setFaqAiAction(actionKey);
        try {
            const result = await improveLandingPageText(value, context);
            if (!result.success || !result.improvedText) {
                throw new Error(result.message || 'AI did not return improved text.');
            }
            onImproved(result.improvedText);
            toast({ title: 'FAQ improved', description: 'AI updated the selected FAQ text.' });
        } catch (error) {
            toast({
                title: 'FAQ AI failed',
                description: error instanceof Error ? error.message : 'Could not improve FAQ text.',
                variant: 'destructive',
            });
        } finally {
            setFaqAiAction(null);
        }
    };

    const handlePublicPageChange = (key: PublicPageKey, field: 'title' | 'subtitle' | 'content' | 'contentHtml' | 'enabled', value: string | boolean) => {
        if (!settings) return;
        const current = settings.publicPages?.[key] || { title: '', subtitle: '', content: '', enabled: true };
        handleFieldChange('publicPages', {
            ...(settings.publicPages || {}),
            [key]: {
                ...current,
                [field]: value,
            },
        });
    };

    const handleGeneratePublicTrustPage = async (key: PublicPageKey) => {
        if (!settings || publicTrustAiAction) return;
        const current = settings.publicPages?.[key] || { title: '', subtitle: '', content: '', contentHtml: '', enabled: true };
        setPublicTrustAiAction(key);
        try {
            const result = await generatePublicTrustPage({
                pageKey: key,
                companyContext: settings.publicTrustCompanyContext || '',
                currentTitle: current.title || '',
                currentSubtitle: current.subtitle || '',
                currentContent: current.contentHtml || current.content || '',
                model: settings.publicTrustPageAiModel || settings.defaultTextGenAiModel || settings.defaultGenAiModel || '',
            });

            if (!result.success || !result.page) {
                throw new Error(result.message || 'AI did not return a trust page draft.');
            }

            handleFieldChange('publicPages', {
                ...(settings.publicPages || {}),
                [key]: {
                    ...current,
                    title: result.page.title,
                    subtitle: result.page.subtitle,
                    content: result.page.content,
                    contentHtml: sanitizeTrustPageHtml(result.page.contentHtml),
                    enabled: true,
                },
            });
            toast({ title: 'Trust page generated', description: `${publicPageOptions.find((page) => page.key === key)?.label || 'Page'} draft is ready for review.` });
        } catch (error) {
            toast({
                title: 'AI generation failed',
                description: error instanceof Error ? error.message : 'Could not generate this trust page.',
                variant: 'destructive',
            });
        } finally {
            setPublicTrustAiAction(null);
        }
    };

    const sanitizePublicPagesForSave = (pages: AppSettings['publicPages']) => {
        return Object.fromEntries(
            Object.entries(pages || {}).map(([key, page]) => [
                key,
                {
                    ...page,
                    contentHtml: sanitizeTrustPageHtml(page?.contentHtml || plainTextToTrustPageHtml(page?.content || '')),
                    content: String(page?.content || '').trim(),
                },
            ])
        ) as AppSettings['publicPages'];
    };

    const handleSubmit = async () => {
        if (!settings) return;
        setIsSubmitting(true);
        if (!auth?.currentUser) {
            toast({ title: "Error", description: "You must be logged in as admin.", variant: "destructive" });
            setIsSubmitting(false);
            return;
        }

        const sanitizedProviders = (settings.aiProviders || []).map(sanitizeProviderDiscoveredModels);
        const normalizedSettings: AppSettings = {
            ...settings,
            aiProviders: sanitizedProviders,
            supportWidgetTawkPropertyId: String(settings.supportWidgetTawkPropertyId || '').trim(),
            supportWidgetTawkWidgetId: String(settings.supportWidgetTawkWidgetId || '').trim() || 'default',
            supportWidgetCrispWebsiteId: String(settings.supportWidgetCrispWebsiteId || '').trim(),
            supportWidgetScriptUrl: String(settings.supportWidgetScriptUrl || '').trim(),
            supportWidgetCustomScript: String(settings.supportWidgetCustomScript || '').trim(),
            publicTrustCompanyContext: String(settings.publicTrustCompanyContext || '').trim(),
        };
        const validModelIds = getValidModelIds(normalizedSettings);
        normalizedSettings.defaultTextGenAiModel = normalizeModelId(normalizedSettings.defaultTextGenAiModel, validModelIds, '');
        normalizedSettings.defaultImageGenAiModel = normalizeModelId(normalizedSettings.defaultImageGenAiModel, validModelIds, '');
        normalizedSettings.defaultVideoGenAiModel = normalizeModelId(normalizedSettings.defaultVideoGenAiModel, validModelIds, '');
        normalizedSettings.defaultAudioGenAiModel = normalizeModelId(normalizedSettings.defaultAudioGenAiModel, validModelIds, '');
        normalizedSettings.defaultUncensoredAiModel = normalizeModelId(normalizedSettings.defaultUncensoredAiModel, validModelIds, '');
        normalizedSettings.defaultVisionAiModel = normalizeModelId(normalizedSettings.defaultVisionAiModel, validModelIds, '');
        normalizedSettings.defaultHackingAiModel = normalizeModelId(normalizedSettings.defaultHackingAiModel, validModelIds, '');
        normalizedSettings.defaultCodingAiModel = normalizeModelId(normalizedSettings.defaultCodingAiModel, validModelIds, '');
        normalizedSettings.publicTrustPageAiModel = normalizeModelId(normalizedSettings.publicTrustPageAiModel, validModelIds, '');

        setSettings(normalizedSettings);

        const settingsToSave = {
            ...normalizedSettings,
            withdrawalMethods: (normalizedSettings.withdrawalMethods || []).filter(m => m.name.trim() !== ''),
            paymentMethods: (normalizedSettings.withdrawalMethods || []).filter(m => m.name.trim() !== '').map((m) => ({ id: m.id, name: m.name })),
            depositMethods: (normalizedSettings.depositMethods || []).filter(m => m.name.trim() !== ''),
            onboardingCourseSteps: (normalizedSettings.onboardingCourseSteps || []).filter(s => s.title.trim() !== '' && s.content.trim() !== ''),
            faqItems: (normalizedSettings.faqItems || []).filter((item) => item.question.trim() !== '' && item.answer.trim() !== ''),
            publicPages: sanitizePublicPagesForSave(normalizedSettings.publicPages),
            defaultGenAiModel: normalizedSettings.defaultTextGenAiModel,
            aiProviders: (normalizedSettings.aiProviders || []).map((provider) => ({
                ...provider,
                id: provider.id.trim(),
                name: provider.name.trim(),
                baseUrl: provider.baseUrl.trim(),
                apiKey: (provider.apiKey || '').trim(),
            })),
            openAiCompatibleProviderName: normalizedSettings.aiProviders?.[0]?.name || '',
            openAiCompatibleBaseUrl: normalizedSettings.aiProviders?.[0]?.baseUrl || '',
            openAiCompatibleApiKey: normalizedSettings.aiProviders?.[0]?.apiKey || '',
            openAiCompatibleDiscoveredModels: normalizedSettings.aiProviders?.[0]?.discoveredModels || [],
        };

        try {
            const idToken = await auth.currentUser.getIdToken();
            const response = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify(settingsToSave),
            });

            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                throw new Error(result?.message || 'Failed to update settings.');
            }
            toast({ title: "Success", description: "Settings updated successfully." });
        } catch (error) {
            console.error("Error updating settings:", error);
            toast({ title: "Error", description: "Failed to update settings.", variant: "destructive" });
        }
        setIsSubmitting(false);
    };

    const persistSettings = async (settingsInput: AppSettings, successDescription?: string) => {
        if (!auth?.currentUser) {
            throw new Error('You must be logged in as admin.');
        }

        const sanitizedProviders = (settingsInput.aiProviders || []).map(sanitizeProviderDiscoveredModels);
        const normalizedSettings: AppSettings = {
            ...settingsInput,
            aiProviders: sanitizedProviders,
            supportWidgetTawkPropertyId: String(settingsInput.supportWidgetTawkPropertyId || '').trim(),
            supportWidgetTawkWidgetId: String(settingsInput.supportWidgetTawkWidgetId || '').trim() || 'default',
            supportWidgetCrispWebsiteId: String(settingsInput.supportWidgetCrispWebsiteId || '').trim(),
            supportWidgetScriptUrl: String(settingsInput.supportWidgetScriptUrl || '').trim(),
            supportWidgetCustomScript: String(settingsInput.supportWidgetCustomScript || '').trim(),
            publicTrustCompanyContext: String(settingsInput.publicTrustCompanyContext || '').trim(),
        };
        const validModelIds = getValidModelIds(normalizedSettings);
        normalizedSettings.defaultTextGenAiModel = normalizeModelId(normalizedSettings.defaultTextGenAiModel, validModelIds, '');
        normalizedSettings.defaultImageGenAiModel = normalizeModelId(normalizedSettings.defaultImageGenAiModel, validModelIds, '');
        normalizedSettings.defaultVideoGenAiModel = normalizeModelId(normalizedSettings.defaultVideoGenAiModel, validModelIds, '');
        normalizedSettings.defaultAudioGenAiModel = normalizeModelId(normalizedSettings.defaultAudioGenAiModel, validModelIds, '');
        normalizedSettings.defaultUncensoredAiModel = normalizeModelId(normalizedSettings.defaultUncensoredAiModel, validModelIds, '');
        normalizedSettings.defaultVisionAiModel = normalizeModelId(normalizedSettings.defaultVisionAiModel, validModelIds, '');
        normalizedSettings.defaultHackingAiModel = normalizeModelId(normalizedSettings.defaultHackingAiModel, validModelIds, '');
        normalizedSettings.defaultCodingAiModel = normalizeModelId(normalizedSettings.defaultCodingAiModel, validModelIds, '');
        normalizedSettings.publicTrustPageAiModel = normalizeModelId(normalizedSettings.publicTrustPageAiModel, validModelIds, '');

        const settingsToSave = {
            ...normalizedSettings,
            withdrawalMethods: (normalizedSettings.withdrawalMethods || []).filter(m => m.name.trim() !== ''),
            paymentMethods: (normalizedSettings.withdrawalMethods || []).filter(m => m.name.trim() !== '').map((m) => ({ id: m.id, name: m.name })),
            depositMethods: (normalizedSettings.depositMethods || []).filter(m => m.name.trim() !== ''),
            onboardingCourseSteps: (normalizedSettings.onboardingCourseSteps || []).filter(s => s.title.trim() !== '' && s.content.trim() !== ''),
            faqItems: (normalizedSettings.faqItems || []).filter((item) => item.question.trim() !== '' && item.answer.trim() !== ''),
            publicPages: sanitizePublicPagesForSave(normalizedSettings.publicPages),
            defaultGenAiModel: normalizedSettings.defaultTextGenAiModel,
            aiProviders: (normalizedSettings.aiProviders || []).map((provider) => ({
                ...provider,
                id: provider.id.trim(),
                name: provider.name.trim(),
                baseUrl: provider.baseUrl.trim(),
                apiKey: (provider.apiKey || '').trim(),
            })),
            openAiCompatibleProviderName: normalizedSettings.aiProviders?.[0]?.name || '',
            openAiCompatibleBaseUrl: normalizedSettings.aiProviders?.[0]?.baseUrl || '',
            openAiCompatibleApiKey: normalizedSettings.aiProviders?.[0]?.apiKey || '',
            openAiCompatibleDiscoveredModels: normalizedSettings.aiProviders?.[0]?.discoveredModels || [],
        };

        const idToken = await auth.currentUser.getIdToken();
        const response = await fetch('/api/admin/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify(settingsToSave),
        });

        if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            throw new Error(result?.message || 'Failed to update settings.');
        }

        setSettings(normalizedSettings);
        if (successDescription) {
            toast({ title: 'Success', description: successDescription });
        }
    };

    const handleProviderFieldChange = (index: number, field: keyof AiProviderConfig, value: any) => {
        if (!settings) return;
        const providers = [...(settings.aiProviders || [])];
        providers[index] = { ...providers[index], [field]: value };
        setSettings({ ...settings, aiProviders: providers });
    };

    const handleAddProvider = () => {
        if (!settings) return;
        setSettings({
            ...settings,
            aiProviders: [...(settings.aiProviders || []), createProvider()],
        });
    };

    const handleRemoveProvider = (providerId: string) => {
        if (!settings) return;
        setSettings({
            ...settings,
            aiProviders: (settings.aiProviders || []).filter((provider) => provider.id !== providerId),
        });
    };

    const inferModelModality = (modelId: string): ModelModality[] => {
        const lower = modelId.toLowerCase();
        const includesImage = lower.includes('image') || lower.includes('dall-e') || lower.includes('flux') || lower.includes('sd');
        const includesVideo = lower.includes('video') || lower.includes('sora') || lower.includes('veo');
        const includesAudio = lower.includes('audio') || lower.includes('music') || lower.includes('song') || lower.includes('speech') || lower.includes('tts');
        if (includesAudio) return ['audio'];
        if (includesImage && includesVideo) return ['image', 'video'];
        if (includesImage) return ['image'];
        if (includesVideo) return ['video'];
        return ['text'];
    };

    const inferCustomModelTypes = (modelId: string): CustomModelType[] => {
        const lower = modelId.toLowerCase();
        const types: CustomModelType[] = [];

        if (lower.includes('uncensored') || lower.includes('whiterabbit')) {
            types.push('uncensored');
        }
        if (lower.includes('vision') || lower.includes('llava') || lower.includes('vl')) {
            types.push('vision');
        }
        if (lower.includes('hack') || lower.includes('exploit') || lower.includes('security') || lower.includes('pentest')) {
            types.push('hacking');
        }
        if (lower.includes('code') || lower.includes('coder') || lower.includes('codellama')) {
            types.push('coding');
        }

        return types;
    };

    const toModelModalities = (values?: string[]): ModelModality[] => {
        const allowed: ModelModality[] = ['text', 'image', 'video', 'audio'];
        return (values || []).filter((value): value is ModelModality => allowed.includes(value as ModelModality));
    };

    const handleDiscoverModels = async (providerId: string) => {
        if (!settings) return;
        const provider = (settings.aiProviders || []).find((item) => item.id === providerId);
        if (!provider) return;

        setDiscoveringProviderId(providerId);
        const result = await discoverOpenAiCompatibleModels({
            baseUrl: provider.baseUrl || '',
            apiKey: provider.apiKey || '',
        }) as DiscoverModelsResponse;

        if (result.success) {
            const rawModels = Array.isArray(result.models) ? result.models : [];
            const discoveredModels: DiscoveredModel[] = rawModels.map((model) => {
                const id = typeof model === 'string'
                    ? model.trim()
                    : String(model?.id || '').trim();
                const modelModalities = typeof model === 'string' ? undefined : model.modalities;
                const normalizedModalities = toModelModalities(modelModalities);
                return {
                    id,
                    modalities: normalizedModalities.length > 0 ? normalizedModalities : inferModelModality(id),
                };
            }).filter((model) => Boolean(model.id));

            const discoveredModelModalities = discoveredModels.reduce<Record<string, ModelModality[]>>((acc, model) => {
                acc[model.id] = model.modalities && model.modalities.length > 0 ? model.modalities : inferModelModality(model.id);
                return acc;
            }, {});
            const discoveredModelTypes = discoveredModels.reduce<Record<string, string[]>>((acc, model) => {
                acc[model.id] = inferCustomModelTypes(model.id);
                return acc;
            }, {});

            const providers = [...(settings.aiProviders || [])];
            const index = providers.findIndex((item) => item.id === providerId);
            if (index >= 0) {
                providers[index] = {
                    ...providers[index],
                    discoveredModels: discoveredModels.map((model) => model.id),
                    discoveredModelModalities,
                    discoveredModelTypes,
                };
            }

            const getDiscoveredModelModalities = (modelId: string) => discoveredModelModalities[modelId] || inferModelModality(modelId);

            const discoveredText = discoveredModels.find((model) => getDiscoveredModelModalities(model.id).includes('text'));
            const discoveredImage = discoveredModels.find((model) => getDiscoveredModelModalities(model.id).includes('image'));
            const discoveredVideo = discoveredModels.find((model) => getDiscoveredModelModalities(model.id).includes('video'));
            const discoveredAudio = discoveredModels.find((model) => getDiscoveredModelModalities(model.id).includes('audio'));

            const nextSettings: AppSettings = {
                ...settings,
                aiProviders: providers,
                defaultTextGenAiModel: settings.defaultTextGenAiModel || (discoveredText ? `${providerId}/${discoveredText.id}` : settings.defaultTextGenAiModel),
                defaultImageGenAiModel: settings.defaultImageGenAiModel || (discoveredImage ? `${providerId}/${discoveredImage.id}` : settings.defaultImageGenAiModel),
                defaultVideoGenAiModel: settings.defaultVideoGenAiModel || (discoveredVideo ? `${providerId}/${discoveredVideo.id}` : settings.defaultVideoGenAiModel),
                defaultAudioGenAiModel: settings.defaultAudioGenAiModel || (discoveredAudio ? `${providerId}/${discoveredAudio.id}` : settings.defaultAudioGenAiModel),
            };
            setSettings(nextSettings);
            try {
                await persistSettings(nextSettings, `${discoveredModels.length} models discovered and provider saved.`);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to auto-save discovered models.';
                toast({ title: 'Auto-save Failed', description: message, variant: 'destructive' });
            }
        } else {
            toast({ title: "Discovery Failed", description: result.message, variant: "destructive" });
        }
        setDiscoveringProviderId(null);
    };

    const handleTestModel = async (modality: ModelModality, model?: string) => {
        const selectedModel = (model || '').trim();
        if (!selectedModel) {
            toast({ title: "No model selected", description: `Select a ${modality} model first.`, variant: "destructive" });
            return;
        }

        setTestingModality(modality);
        try {
            const result = await testAdminModel(modality, selectedModel) as {
                success?: boolean;
                message?: string;
                result?: {
                    text?: string;
                    imageUrl?: string;
                    videoUrl?: string;
                    thumbnailUrl?: string;
                    simulated?: boolean;
                };
            };

            if (!result?.success) {
                throw new Error(result?.message || 'Model test failed.');
            }

            setTestResults((prev) => ({
                ...prev,
                [modality]: {
                    message: result.message,
                    text: result.result?.text,
                    imageUrl: result.result?.imageUrl,
                    videoUrl: result.result?.videoUrl,
                    thumbnailUrl: result.result?.thumbnailUrl,
                    simulated: result.result?.simulated,
                    error: undefined,
                },
            }));
            toast({ title: "Model Test Passed", description: result.message || `${modality} model is working.` });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Model test failed.';
            setTestResults((prev) => ({
                ...prev,
                [modality]: {
                    message,
                    error: message,
                },
            }));
            toast({ title: "Model Test Failed", description: message, variant: "destructive" });
        } finally {
            setTestingModality(null);
        }
    };

    const processingTimeZoneOptions = useMemo<TomSelectOption[]>(() => {
        const supportedZones = typeof Intl.supportedValuesOf === 'function'
            ? Intl.supportedValuesOf('timeZone')
            : [];
        const timeZones = supportedZones.length > 0 ? supportedZones : ['UTC'];

        const options = timeZones.map((timeZone) => ({
            id: timeZone,
            name: `${timeZone} (${getTimeZoneOffsetLabel(timeZone)})`,
        }));

        const selectedTimeZone = String(settings?.processingTimeZone || 'UTC').trim() || 'UTC';
        if (!options.some((option) => option.id === selectedTimeZone)) {
            options.unshift({
                id: selectedTimeZone,
                name: `${selectedTimeZone} (${getTimeZoneOffsetLabel(selectedTimeZone)})`,
            });
        }

        return options.sort((a, b) => a.name.localeCompare(b.name));
    }, [settings?.processingTimeZone]);

    if (loading) return <LoadingSkeleton />;
    if (!settings) return <p>Could not load settings.</p>;

    const getAllModelOptions = (): ModelOption[] => {
        const staticOptions = [...AVAILABLE_MODELS];
        const providerOptions: ModelOption[] = (settings.aiProviders || []).flatMap((provider) => {
            const providerHasEndpoint = Boolean((provider.baseUrl || '').trim());
            if (!providerHasEndpoint) {
                return [];
            }

            return (provider.discoveredModels || []).filter(isUsableDiscoveredModelId).map((modelId) => {
                const typeTags = provider.discoveredModelTypes?.[modelId] || inferCustomModelTypes(modelId);
                const normalizedModalities = toModelModalities(provider.discoveredModelModalities?.[modelId]);
                return {
                    id: `${provider.id}/${modelId}`,
                    name: `${provider.name} - ${modelId}${typeTags.length ? ` [${typeTags.join(', ')}]` : ''}`,
                    modalities: normalizedModalities.length > 0 ? normalizedModalities : inferModelModality(modelId),
                };
            });
        });

        const merged: ModelOption[] = [...staticOptions];
        providerOptions.forEach((option) => {
            if (!merged.some((existing) => existing.id === option.id)) {
                merged.push(option);
            }
        });

        return merged.sort((a, b) => a.name.localeCompare(b.name));
    };

    const allModelOptions = getAllModelOptions();
    const textModelOptions = allModelOptions;
    const imageModelOptions = allModelOptions;
    const videoModelOptions = allModelOptions;
    const audioModelOptions = allModelOptions;
    const uncensoredModelOptions = allModelOptions;
    const visionModelOptions = allModelOptions;
    const hackingModelOptions = allModelOptions;
    const codingModelOptions = allModelOptions;

    const textModelIds = new Set(textModelOptions.map((option) => option.id));
    const imageModelIds = new Set(imageModelOptions.map((option) => option.id));
    const videoModelIds = new Set(videoModelOptions.map((option) => option.id));
    const audioModelIds = new Set(audioModelOptions.map((option) => option.id));

    const selectedDefaultTextModel = settings.defaultTextGenAiModel && textModelIds.has(settings.defaultTextGenAiModel)
        ? settings.defaultTextGenAiModel
        : '';
    const selectedPublicTrustPageAiModel = settings.publicTrustPageAiModel && textModelIds.has(settings.publicTrustPageAiModel)
        ? settings.publicTrustPageAiModel
        : '';
    const selectedDefaultImageModel = settings.defaultImageGenAiModel && imageModelIds.has(settings.defaultImageGenAiModel)
        ? settings.defaultImageGenAiModel
        : '';
    const selectedDefaultVideoModel = settings.defaultVideoGenAiModel && videoModelIds.has(settings.defaultVideoGenAiModel)
        ? settings.defaultVideoGenAiModel
        : '';
    const selectedDefaultAudioModel = settings.defaultAudioGenAiModel && audioModelIds.has(settings.defaultAudioGenAiModel)
        ? settings.defaultAudioGenAiModel
        : '';
    return (
        <Card>
            <CardContent className="pt-6 space-y-12">

                <Separator />

                <Collapsible open={isUserApprovalSettingsOpen} onOpenChange={setIsUserApprovalSettingsOpen}>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold">User Approval Settings</h3>
                            <p className="text-sm text-muted-foreground">Automate the qualification test approval process based on user scores.</p>
                        </div>
                        <CollapsibleTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="shrink-0">
                                {isUserApprovalSettingsOpen ? 'Hide' : 'Show'}
                                <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${isUserApprovalSettingsOpen ? 'rotate-180' : ''}`} />
                            </Button>
                        </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="mt-6 space-y-6">
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

                    <div className="rounded-md border p-3 space-y-3">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <Label htmlFor="qualification-anti-copy-enabled" className="text-base font-semibold">Qualification Anti-Copy Protection</Label>
                                <p className="text-xs text-muted-foreground">Block copy attempts during qualification tests and enforce automatic failure after repeated attempts.</p>
                            </div>
                            <Switch
                                id="qualification-anti-copy-enabled"
                                checked={settings.qualificationTestAntiCopyEnabled !== false}
                                onCheckedChange={(checked) => handleFieldChange('qualificationTestAntiCopyEnabled', checked)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="qualification-copy-attempt-limit">Copy Attempt Limit Before Auto-Fail</Label>
                            <Input
                                id="qualification-copy-attempt-limit"
                                type="number"
                                min="1"
                                value={settings.qualificationTestCopyAttemptLimit || 5}
                                onChange={(e) => handleFieldChange('qualificationTestCopyAttemptLimit', Math.max(1, Number(e.target.value) || 1))}
                                disabled={settings.qualificationTestAntiCopyEnabled === false}
                            />
                            <p className="text-xs text-muted-foreground">If attempts exceed this limit, the test is automatically failed.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="qualification-question-limit">Random Question Limit Per Test</Label>
                            <Input
                                id="qualification-question-limit"
                                type="number"
                                min="1"
                                value={settings.qualificationTestQuestionLimit || 10}
                                onChange={(e) => handleFieldChange('qualificationTestQuestionLimit', Math.max(1, Number(e.target.value) || 1))}
                            />
                            <p className="text-xs text-muted-foreground">Users receive up to this many random questions from the selected expertise question set.</p>
                        </div>
                    </div>
                    </CollapsibleContent>
                </Collapsible>
                
                <Collapsible open={isOnboardingSettingsOpen} onOpenChange={setIsOnboardingSettingsOpen}>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold">Onboarding Course Settings</h3>
                            <p className="text-sm text-muted-foreground">Configure the optional course for new users.</p>
                        </div>
                        <CollapsibleTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="shrink-0">
                                {isOnboardingSettingsOpen ? 'Hide' : 'Show'}
                                <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${isOnboardingSettingsOpen ? 'rotate-180' : ''}`} />
                            </Button>
                        </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="mt-6 space-y-6">
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
                    </CollapsibleContent>
                </Collapsible>

                <Separator />

                <Collapsible open={isFaqSettingsOpen} onOpenChange={setIsFaqSettingsOpen}>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold">FAQ Settings</h3>
                            <p className="text-sm text-muted-foreground">Manage the questions shown on the public landing page.</p>
                        </div>
                        <CollapsibleTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="shrink-0">
                                {isFaqSettingsOpen ? 'Hide' : 'Show'}
                                <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${isFaqSettingsOpen ? 'rotate-180' : ''}`} />
                            </Button>
                        </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="mt-6 space-y-6">
                        <div className="flex items-center space-x-2">
                            <Switch id="faq-enabled" checked={settings.faqEnabled !== false} onCheckedChange={(checked) => handleFieldChange('faqEnabled', checked)} />
                            <Label htmlFor="faq-enabled">Show FAQ on frontend</Label>
                        </div>
                        <div className="rounded-md border bg-primary/5 p-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <Label className="text-base font-semibold">AI FAQ Assistant</Label>
                                    <p className="text-xs text-muted-foreground">Generate a starter FAQ set or improve individual FAQ text using the configured text model.</p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleGenerateFaqWithAi}
                                    disabled={Boolean(faqAiAction)}
                                    className="shrink-0"
                                >
                                    {faqAiAction === 'generate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                    Generate FAQ
                                </Button>
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <Label htmlFor="faq-title">FAQ Title</Label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled={Boolean(faqAiAction) || !String(settings.faqTitle || '').trim()}
                                        onClick={() => handleImproveFaqField(
                                            'title',
                                            settings.faqTitle || '',
                                            'FAQ section title for TrainlyLabs landing page',
                                            (value) => handleFieldChange('faqTitle', value)
                                        )}
                                    >
                                        {faqAiAction === 'title' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                        Improve
                                    </Button>
                                </div>
                                <Input id="faq-title" value={settings.faqTitle || ''} onChange={(e) => handleFieldChange('faqTitle', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <Label htmlFor="faq-subtitle">FAQ Subtitle</Label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled={Boolean(faqAiAction) || !String(settings.faqSubtitle || '').trim()}
                                        onClick={() => handleImproveFaqField(
                                            'subtitle',
                                            settings.faqSubtitle || '',
                                            'FAQ section subtitle for TrainlyLabs landing page',
                                            (value) => handleFieldChange('faqSubtitle', value)
                                        )}
                                    >
                                        {faqAiAction === 'subtitle' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                        Improve
                                    </Button>
                                </div>
                                <Input id="faq-subtitle" value={settings.faqSubtitle || ''} onChange={(e) => handleFieldChange('faqSubtitle', e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <Label className="text-base font-semibold">FAQ Questions</Label>
                            {(settings.faqItems || []).map((item, index) => (
                                <div key={item.id} className="rounded-lg border bg-muted/40 p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <Label className="font-semibold">Question {index + 1}</Label>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center space-x-2">
                                                <Switch
                                                    id={`faq-enabled-${item.id}`}
                                                    checked={item.enabled !== false}
                                                    onCheckedChange={(checked) => handleFaqItemChange(item.id, 'enabled', checked)}
                                                />
                                                <Label htmlFor={`faq-enabled-${item.id}`} className="text-sm font-normal">Visible</Label>
                                            </div>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveFaqItem(item.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                <span className="sr-only">Remove FAQ question</span>
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <Label htmlFor={`faq-question-${item.id}`}>Question</Label>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                disabled={Boolean(faqAiAction) || !item.question.trim()}
                                                onClick={() => handleImproveFaqField(
                                                    `question-${item.id}`,
                                                    item.question,
                                                    'FAQ question for TrainlyLabs landing page. Make it concise and clear.',
                                                    (value) => handleFaqItemChange(item.id, 'question', value)
                                                )}
                                            >
                                                {faqAiAction === `question-${item.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                                Improve
                                            </Button>
                                        </div>
                                        <Input
                                            id={`faq-question-${item.id}`}
                                            value={item.question}
                                            onChange={(e) => handleFaqItemChange(item.id, 'question', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <Label htmlFor={`faq-answer-${item.id}`}>Answer</Label>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                disabled={Boolean(faqAiAction) || !item.answer.trim()}
                                                onClick={() => handleImproveFaqField(
                                                    `answer-${item.id}`,
                                                    item.answer,
                                                    `FAQ answer for this question: "${item.question}". Make it helpful, direct, and suitable for TrainlyLabs users.`,
                                                    (value) => handleFaqItemChange(item.id, 'answer', value)
                                                )}
                                            >
                                                {faqAiAction === `answer-${item.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                                Improve
                                            </Button>
                                        </div>
                                        <Textarea
                                            id={`faq-answer-${item.id}`}
                                            value={item.answer}
                                            onChange={(e) => handleFaqItemChange(item.id, 'answer', e.target.value)}
                                            rows={3}
                                        />
                                    </div>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={handleAddFaqItem}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add FAQ
                            </Button>
                        </div>
                    </CollapsibleContent>
                </Collapsible>

                <Separator />

                <Collapsible open={isSupportSettingsOpen} onOpenChange={setIsSupportSettingsOpen}>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold">Customer Support Platform</h3>
                            <p className="text-sm text-muted-foreground">Add a live chat widget such as Tawk.to or Crisp across the frontend.</p>
                        </div>
                        <CollapsibleTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="shrink-0">
                                {isSupportSettingsOpen ? 'Hide' : 'Show'}
                                <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${isSupportSettingsOpen ? 'rotate-180' : ''}`} />
                            </Button>
                        </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="mt-6 space-y-5">
                        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                            <div>
                                <Label htmlFor="support-widget-enabled" className="text-base font-semibold">Enable support widget</Label>
                                <p className="text-xs text-muted-foreground">When enabled, the selected support chat widget loads globally.</p>
                            </div>
                            <Switch
                                id="support-widget-enabled"
                                checked={settings.supportWidgetEnabled === true}
                                onCheckedChange={(checked) => handleFieldChange('supportWidgetEnabled', checked)}
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="support-widget-provider">Provider</Label>
                                <select
                                    id="support-widget-provider"
                                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                                    value={settings.supportWidgetProvider || 'none'}
                                    onChange={(e) => {
                                        const provider = e.target.value as AppSettings['supportWidgetProvider'];
                                        setSettings({
                                            ...settings,
                                            supportWidgetProvider: provider,
                                            supportWidgetEnabled: provider !== 'none' ? settings.supportWidgetEnabled : false,
                                        });
                                    }}
                                >
                                    <option value="none">None</option>
                                    <option value="tawk">Tawk.to</option>
                                    <option value="crisp">Crisp</option>
                                    <option value="custom">Custom HTTPS script</option>
                                </select>
                            </div>
                        </div>

                        {settings.supportWidgetProvider === 'tawk' ? (
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="support-widget-tawk-property">Tawk.to Property ID</Label>
                                    <Input
                                        id="support-widget-tawk-property"
                                        value={settings.supportWidgetTawkPropertyId || ''}
                                        onChange={(e) => handleFieldChange('supportWidgetTawkPropertyId', e.target.value)}
                                        placeholder="64f..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="support-widget-tawk-widget">Tawk.to Widget ID</Label>
                                    <Input
                                        id="support-widget-tawk-widget"
                                        value={settings.supportWidgetTawkWidgetId || 'default'}
                                        onChange={(e) => handleFieldChange('supportWidgetTawkWidgetId', e.target.value)}
                                        placeholder="default"
                                    />
                                </div>
                            </div>
                        ) : null}

                        {settings.supportWidgetProvider === 'crisp' ? (
                            <div className="space-y-2">
                                <Label htmlFor="support-widget-crisp-id">Crisp Website ID</Label>
                                <Input
                                    id="support-widget-crisp-id"
                                    value={settings.supportWidgetCrispWebsiteId || ''}
                                    onChange={(e) => handleFieldChange('supportWidgetCrispWebsiteId', e.target.value)}
                                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                />
                            </div>
                        ) : null}

                        {settings.supportWidgetProvider === 'custom' ? (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="support-widget-script-url">Custom widget script URL</Label>
                                    <Input
                                        id="support-widget-script-url"
                                        value={settings.supportWidgetScriptUrl || ''}
                                        onChange={(e) => handleFieldChange('supportWidgetScriptUrl', e.target.value)}
                                        placeholder="https://example.com/widget.js"
                                    />
                                    <p className="text-xs text-muted-foreground">Use this when the provider gives you a direct JavaScript file URL. Only HTTPS URLs are loaded.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="support-widget-custom-script">Custom widget script snippet</Label>
                                    <Textarea
                                        id="support-widget-custom-script"
                                        value={settings.supportWidgetCustomScript || ''}
                                        onChange={(e) => handleFieldChange('supportWidgetCustomScript', e.target.value)}
                                        placeholder={'<!-- Paste the widget embed code here -->\n<script>\n  window.supportWidgetConfig = { ... };\n</script>\n<script src="https://example.com/widget.js"></script>'}
                                        rows={8}
                                        className="font-mono text-xs"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Pasted JavaScript runs across the site. Use snippets only from support platforms you trust.
                                    </p>
                                </div>
                            </div>
                        ) : null}
                    </CollapsibleContent>
                </Collapsible>

                <Separator />

                <Collapsible open={isPublicPagesOpen} onOpenChange={setIsPublicPagesOpen}>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold">Public Trust Pages</h3>
                            <p className="text-sm text-muted-foreground">Configure About, Contact, Privacy, Terms, refund, and contributor guideline pages.</p>
                        </div>
                        <CollapsibleTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="shrink-0">
                                {isPublicPagesOpen ? 'Hide' : 'Show'}
                                <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${isPublicPagesOpen ? 'rotate-180' : ''}`} />
                            </Button>
                        </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="mt-6 space-y-4">
                        <div className="rounded-md border bg-primary/5 p-4 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="public-trust-company-context" className="text-base font-semibold">Company context for AI drafts</Label>
                                <Textarea
                                    id="public-trust-company-context"
                                    value={settings.publicTrustCompanyContext || ''}
                                    onChange={(e) => handleFieldChange('publicTrustCompanyContext', e.target.value)}
                                    rows={5}
                                    placeholder="Describe your company, users, payment rules, support channels, jurisdictions, and any constraints AI should respect."
                                />
                                <p className="text-xs text-muted-foreground">This context is sent with one selected page at a time so AI can draft accurate trust copy without bloating the prompt.</p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <SearchableModelSelect
                                    id="public-trust-page-ai-model"
                                    label="Trust Page AI Model"
                                    placeholder="Search text models..."
                                    options={textModelOptions}
                                    value={selectedPublicTrustPageAiModel}
                                    onChange={(nextValue) => handleFieldChange('publicTrustPageAiModel', nextValue)}
                                />
                            </div>
                        </div>
                        {publicPageOptions.map(({ key, label }) => {
                            const page = settings.publicPages?.[key] || { title: label, subtitle: '', content: '', contentHtml: '', enabled: true };
                            const pageHtml = sanitizeTrustPageHtml(page.contentHtml || plainTextToTrustPageHtml(page.content || ''));
                            return (
                                <div key={key} className="rounded-lg border bg-muted/40 p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <Label className="text-base font-semibold">{label}</Label>
                                        <div className="flex items-center space-x-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={Boolean(publicTrustAiAction)}
                                                onClick={() => handleGeneratePublicTrustPage(key)}
                                            >
                                                {publicTrustAiAction === key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                                Generate
                                            </Button>
                                            <Switch
                                                id={`public-page-${key}-enabled`}
                                                checked={page.enabled !== false}
                                                onCheckedChange={(checked) => handlePublicPageChange(key, 'enabled', checked)}
                                            />
                                            <Label htmlFor={`public-page-${key}-enabled`} className="text-sm font-normal">Enabled</Label>
                                        </div>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor={`public-page-${key}-title`}>Title</Label>
                                            <Input
                                                id={`public-page-${key}-title`}
                                                value={page.title || ''}
                                                onChange={(e) => handlePublicPageChange(key, 'title', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`public-page-${key}-subtitle`}>Subtitle</Label>
                                            <Input
                                                id={`public-page-${key}-subtitle`}
                                                value={page.subtitle || ''}
                                                onChange={(e) => handlePublicPageChange(key, 'subtitle', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`public-page-${key}-content`}>Rich Content</Label>
                                        <TrustPageRichTextEditor
                                            id={`public-page-${key}-content`}
                                            value={pageHtml}
                                            onChange={(value) => {
                                                handleFieldChange('publicPages', {
                                                    ...(settings.publicPages || {}),
                                                    [key]: {
                                                        ...page,
                                                        contentHtml: value,
                                                        content: value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
                                                    },
                                                });
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </CollapsibleContent>
                </Collapsible>

                <Separator />
                
                <Collapsible open={isAiModelSettingsOpen} onOpenChange={setIsAiModelSettingsOpen}>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold">AI Model Settings</h3>
                            <p className="text-sm text-muted-foreground">Configure the default generative model for AI features.</p>
                        </div>
                        <CollapsibleTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="shrink-0">
                                {isAiModelSettingsOpen ? 'Hide' : 'Show'}
                                <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${isAiModelSettingsOpen ? 'rotate-180' : ''}`} />
                            </Button>
                        </CollapsibleTrigger>
                    </div>
                <CollapsibleContent className="mt-6 space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Add one or more OpenAI-compatible providers, set what each provider supports, discover models, then choose defaults per modality.
                    </p>

                    <div className="space-y-4">
                        {(settings.aiProviders || []).map((provider, index) => (
                            <div key={provider.id} className="rounded-lg border p-4 space-y-3">
                                <div className="space-y-2">
                                    <Label>Provider Name</Label>
                                    <Input
                                        value={provider.name}
                                        onChange={(e) => handleProviderFieldChange(index, 'name', e.target.value)}
                                        placeholder="DeepSeek"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label>Route (Base URL)</Label>
                                        <Input
                                            value={provider.baseUrl}
                                            onChange={(e) => handleProviderFieldChange(index, 'baseUrl', e.target.value)}
                                            placeholder="https://api.deepseek.com/v1"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>API Key</Label>
                                        <Input
                                            type="password"
                                            value={provider.apiKey || ''}
                                            onChange={(e) => handleProviderFieldChange(index, 'apiKey', e.target.value)}
                                            placeholder="sk-..."
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-4 pt-1">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`provider-${provider.id}-text`}
                                            checked={provider.supportsText !== false}
                                            onCheckedChange={(checked) => handleProviderFieldChange(index, 'supportsText', Boolean(checked))}
                                        />
                                        <Label htmlFor={`provider-${provider.id}-text`} className="font-normal">Text</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`provider-${provider.id}-image`}
                                            checked={provider.supportsImage === true}
                                            onCheckedChange={(checked) => handleProviderFieldChange(index, 'supportsImage', Boolean(checked))}
                                        />
                                        <Label htmlFor={`provider-${provider.id}-image`} className="font-normal">Image</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`provider-${provider.id}-video`}
                                            checked={provider.supportsVideo === true}
                                            onCheckedChange={(checked) => handleProviderFieldChange(index, 'supportsVideo', Boolean(checked))}
                                        />
                                        <Label htmlFor={`provider-${provider.id}-video`} className="font-normal">Video</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`provider-${provider.id}-audio`}
                                            checked={provider.supportsAudio === true}
                                            onCheckedChange={(checked) => handleProviderFieldChange(index, 'supportsAudio', Boolean(checked))}
                                        />
                                        <Label htmlFor={`provider-${provider.id}-audio`} className="font-normal">Audio</Label>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDiscoverModels(provider.id)}
                                        disabled={discoveringProviderId === provider.id}
                                    >
                                        {discoveringProviderId === provider.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                        Discover Models
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveProvider(provider.id)}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                                        Remove Provider
                                    </Button>
                                </div>
                            </div>
                        ))}

                        <Button variant="outline" size="sm" onClick={handleAddProvider}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Provider
                        </Button>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="rounded-md border p-3 space-y-2">
                            <SearchableModelSelect
                                id="default-text-model"
                                label="Default Text Model"
                                placeholder="Search text models..."
                                options={textModelOptions}
                                value={selectedDefaultTextModel}
                                onChange={(nextValue) => handleFieldChange('defaultTextGenAiModel', nextValue)}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={testingModality === 'text' || !settings.defaultTextGenAiModel}
                                onClick={() => handleTestModel('text', settings.defaultTextGenAiModel)}
                            >
                                {testingModality === 'text' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Test
                            </Button>
                            {testResults.text.error ? <p className="text-xs text-destructive">{testResults.text.error}</p> : null}
                            {testResults.text.text ? <p className="text-xs text-muted-foreground">{testResults.text.text}</p> : null}
                        </div>

                        <div className="rounded-md border p-3 space-y-2">
                            <SearchableModelSelect
                                id="default-image-model"
                                label="Default Image Model"
                                placeholder="Search image models..."
                                options={imageModelOptions}
                                value={selectedDefaultImageModel}
                                onChange={(nextValue) => handleFieldChange('defaultImageGenAiModel', nextValue)}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={testingModality === 'image' || !settings.defaultImageGenAiModel}
                                onClick={() => handleTestModel('image', settings.defaultImageGenAiModel)}
                            >
                                {testingModality === 'image' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Test
                            </Button>
                            {testResults.image.error ? <p className="text-xs text-destructive">{testResults.image.error}</p> : null}
                            {testResults.image.imageUrl ? (
                                <img src={testResults.image.imageUrl} alt="Image model test output" className="h-20 w-20 rounded-md border object-cover" />
                            ) : null}
                        </div>

                        <div className="rounded-md border p-3 space-y-2">
                            <SearchableModelSelect
                                id="default-video-model"
                                label="Default Video Model"
                                placeholder="Search video models..."
                                options={videoModelOptions}
                                value={selectedDefaultVideoModel}
                                onChange={(nextValue) => handleFieldChange('defaultVideoGenAiModel', nextValue)}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={testingModality === 'video' || !settings.defaultVideoGenAiModel}
                                onClick={() => handleTestModel('video', settings.defaultVideoGenAiModel)}
                            >
                                {testingModality === 'video' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Test
                            </Button>
                            {testResults.video.error ? <p className="text-xs text-destructive">{testResults.video.error}</p> : null}
                            {testResults.video.videoUrl ? (
                                <video
                                    className="h-20 w-full rounded-md border bg-black"
                                    controls
                                    poster={testResults.video.thumbnailUrl}
                                    src={testResults.video.videoUrl}
                                />
                            ) : null}
                        </div>

                        <div className="rounded-md border p-3 space-y-2">
                            <SearchableModelSelect
                                id="default-audio-model"
                                label="Default Audio Model"
                                placeholder="Search audio models..."
                                options={audioModelOptions}
                                value={selectedDefaultAudioModel}
                                onChange={(nextValue) => handleFieldChange('defaultAudioGenAiModel', nextValue)}
                            />
                            <p className="text-xs text-muted-foreground">Used by music generation flows.</p>
                        </div>

                        <div className="rounded-md border p-3 space-y-2">
                            <SearchableModelSelect
                                id="default-uncensored-model"
                                label="Default Uncensored Model"
                                placeholder="Search uncensored models..."
                                options={uncensoredModelOptions}
                                value={settings.defaultUncensoredAiModel}
                                onChange={(nextValue) => handleFieldChange('defaultUncensoredAiModel', nextValue)}
                            />
                        </div>

                        <div className="rounded-md border p-3 space-y-2">
                            <SearchableModelSelect
                                id="default-vision-model"
                                label="Default Vision Model"
                                placeholder="Search vision models..."
                                options={visionModelOptions}
                                value={settings.defaultVisionAiModel}
                                onChange={(nextValue) => handleFieldChange('defaultVisionAiModel', nextValue)}
                            />
                        </div>

                        <div className="rounded-md border p-3 space-y-2">
                            <SearchableModelSelect
                                id="default-hacking-model"
                                label="Default Hacking Model"
                                placeholder="Search hacking models..."
                                options={hackingModelOptions}
                                value={settings.defaultHackingAiModel}
                                onChange={(nextValue) => handleFieldChange('defaultHackingAiModel', nextValue)}
                            />
                        </div>

                        <div className="rounded-md border p-3 space-y-2">
                            <SearchableModelSelect
                                id="default-coding-model"
                                label="Default Coding Model"
                                placeholder="Search coding models..."
                                options={codingModelOptions}
                                value={settings.defaultCodingAiModel}
                                onChange={(nextValue) => handleFieldChange('defaultCodingAiModel', nextValue)}
                            />
                        </div>
                    </div>

                    <div className="rounded-md border p-3 space-y-2">
                        <Label htmlFor="ai-ranked-payout-mode" className="text-base font-semibold">AI Ranked Payout Mode</Label>
                        <p className="text-xs text-muted-foreground">Control whether AI rank scales points for task submissions.</p>
                        <select
                            id="ai-ranked-payout-mode"
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                            value={settings.aiRankedPayoutMode || 'on'}
                            onChange={(e) => handleFieldChange('aiRankedPayoutMode', e.target.value as 'off' | 'on' | 'per_package')}
                        >
                            <option value="off">Off (always full points)</option>
                            <option value="on">On (always score-based)</option>
                            <option value="per_package">Per Package</option>
                        </select>
                    </div>

                    <div className="rounded-md border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <Label htmlFor="earn-per-score-enabled" className="text-base font-semibold">Earn per score</Label>
                                <p className="text-xs text-muted-foreground">When enabled: scores up to 80% pay by score, above 80% pays 100%.</p>
                            </div>
                            <Switch
                                id="earn-per-score-enabled"
                                checked={settings.earnPerScoreEnabled !== false}
                                onCheckedChange={(checked) => handleFieldChange('earnPerScoreEnabled', checked)}
                            />
                        </div>
                    </div>

                    <div className="rounded-md border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <Label htmlFor="leaderboard-enabled" className="text-base font-semibold">Leaderboard</Label>
                                <p className="text-xs text-muted-foreground">Enable or disable leaderboard visibility for users.</p>
                            </div>
                            <Switch
                                id="leaderboard-enabled"
                                checked={settings.leaderboardEnabled !== false}
                                onCheckedChange={(checked) => handleFieldChange('leaderboardEnabled', checked)}
                            />
                        </div>
                    </div>
                </CollapsibleContent>
                </Collapsible>

                <Separator />

                <Collapsible open={isEmailNotificationSettingsOpen} onOpenChange={setIsEmailNotificationSettingsOpen}>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold">Email & Notification Settings</h3>
                            <p className="text-sm text-muted-foreground">Control email verification requirements and transactional email notifications.</p>
                        </div>
                        <CollapsibleTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="shrink-0">
                                {isEmailNotificationSettingsOpen ? 'Hide' : 'Show'}
                                <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${isEmailNotificationSettingsOpen ? 'rotate-180' : ''}`} />
                            </Button>
                        </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="mt-6 space-y-3">
                    <div className="rounded-md border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <Label className="text-base font-semibold">Send Test Email</Label>
                                <p className="text-xs text-muted-foreground">Send a test email to any address to verify Zeptomail integration.</p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setTestEmailDialogOpen(true)}
                            >
                                <Mail className="mr-2 h-4 w-4" />
                                Send Test Email
                            </Button>
                        </div>
                    </div>
                    <Dialog open={testEmailDialogOpen} onOpenChange={setTestEmailDialogOpen}>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Send Test Email</DialogTitle>
                                <DialogDescription>Send a custom test email via Zeptomail to verify the integration.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="test-email-to">To</Label>
                                    <Input
                                        id="test-email-to"
                                        type="email"
                                        placeholder="user@example.com"
                                        value={testEmailTo}
                                        onChange={(e) => setTestEmailTo(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="test-email-subject">Subject</Label>
                                    <Input
                                        id="test-email-subject"
                                        placeholder="Test Email"
                                        value={testEmailSubject}
                                        onChange={(e) => setTestEmailSubject(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="test-email-body">Body (HTML)</Label>
                                    <Textarea
                                        id="test-email-body"
                                        rows={6}
                                        placeholder="<h2>Hello!</h2><p>This is a test email.</p>"
                                        value={testEmailBody}
                                        onChange={(e) => setTestEmailBody(e.target.value)}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="outline">Cancel</Button>
                                </DialogClose>
                                <Button
                                    type="button"
                                    onClick={async () => {
                                        if (!testEmailTo || !testEmailSubject || !testEmailBody) {
                                            toast({ title: "Missing fields", description: "All fields are required.", variant: "destructive" });
                                            return;
                                        }
                                        const { sendTestEmail } = await import('@/lib/admin-api');
                                        const result = await sendTestEmail(testEmailTo, testEmailSubject, testEmailBody);
                                        if (result.success) {
                                            toast({ title: "Success", description: result.message || "Test email sent." });
                                            setTestEmailDialogOpen(false);
                                        } else {
                                            toast({ title: "Error", description: result.message || "Failed to send test email.", variant: "destructive" });
                                        }
                                    }}
                                    disabled={!testEmailTo || !testEmailSubject || !testEmailBody}
                                >
                                    Send
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <div className="rounded-md border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <Label htmlFor="require-email-verification" className="text-base font-semibold">Require Email Verification</Label>
                                <p className="text-xs text-muted-foreground">If enabled, users must verify their email address before accessing the platform.</p>
                            </div>
                            <Switch
                                id="require-email-verification"
                                checked={settings.requireEmailVerification === true}
                                onCheckedChange={(checked) => handleFieldChange('requireEmailVerification', checked)}
                            />
                        </div>
                    </div>
                    <div className="rounded-md border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <Label htmlFor="email-notifications-enabled" className="text-base font-semibold">Email Notifications</Label>
                                <p className="text-xs text-muted-foreground">Send transactional emails for important events like deposit approvals, withdrawals, and account changes.</p>
                            </div>
                            <Switch
                                id="email-notifications-enabled"
                                checked={settings.emailNotificationsEnabled !== false}
                                onCheckedChange={(checked) => handleFieldChange('emailNotificationsEnabled', checked)}
                            />
                        </div>
                    </div>
                    <div className="rounded-md border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <Label htmlFor="google-auth-enabled" className="text-base font-semibold">Google Authentication</Label>
                                <p className="text-xs text-muted-foreground">Allow users to sign up and sign in with their Google account.</p>
                            </div>
                            <Switch
                                id="google-auth-enabled"
                                checked={settings.googleAuthEnabled === true}
                                onCheckedChange={(checked) => handleFieldChange('googleAuthEnabled', checked)}
                            />
                        </div>
                    </div>
                    </CollapsibleContent>
                </Collapsible>

                <Separator />

                <Collapsible open={isDepositWithdrawalSettingsOpen} onOpenChange={setIsDepositWithdrawalSettingsOpen}>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold">Deposit & Withdrawal Settings</h3>
                            <p className="text-sm text-muted-foreground">Manage deposit methods, withdrawal methods, limits, processing timezone, and withdrawal schedule.</p>
                        </div>
                        <CollapsibleTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="shrink-0">
                                {isDepositWithdrawalSettingsOpen ? 'Hide' : 'Show'}
                                <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${isDepositWithdrawalSettingsOpen ? 'rotate-180' : ''}`} />
                            </Button>
                        </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="mt-6 space-y-6">
                        <div>
                            <h4 className="text-base font-semibold mb-2">Deposit Methods</h4>
                            <DepositMethodsManager
                                methods={settings.depositMethods || []}
                                onChange={(methods) => handleFieldChange('depositMethods', methods)}
                            />
                        </div>
                        
                        <Separator />
                        
                        <div>
                            <h4 className="text-base font-semibold mb-2">Withdrawal Methods</h4>
                            <WithdrawalMethodsManager
                                methods={settings.withdrawalMethods || []}
                                onChange={(methods) => handleFieldChange('withdrawalMethods', methods)}
                            />
                        </div>

                        <Separator />

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2 md:col-span-2">
                                <SearchableModelSelect
                                    id="processing-timezone"
                                    label="Processing Timezone"
                                    placeholder="Search timezones..."
                                    options={processingTimeZoneOptions}
                                    value={settings.processingTimeZone || 'UTC'}
                                    onChange={(nextValue) => handleFieldChange('processingTimeZone', nextValue || 'UTC')}
                                />
                                <p className="text-xs text-muted-foreground">Used for server-side day checks (withdrawals and partner day schedules). Use an IANA timezone like UTC, Africa/Nairobi, America/New_York.</p>
                            </div>
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
                    </CollapsibleContent>
                </Collapsible>
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
