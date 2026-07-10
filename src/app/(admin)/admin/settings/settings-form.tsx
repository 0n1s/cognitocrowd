

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AiProviderConfig, AppSettings, OnboardingStep } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Trash2, Loader2, GripVertical, RefreshCw, Copy, Check, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { discoverOpenAiCompatibleModels } from "@/lib/actions";
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
    const [isOnboardingSettingsOpen, setIsOnboardingSettingsOpen] = useState(false);
    const [isAiModelSettingsOpen, setIsAiModelSettingsOpen] = useState(false);
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

        setSettings(normalizedSettings);

        const settingsToSave = {
            ...normalizedSettings,
            withdrawalMethods: (normalizedSettings.withdrawalMethods || []).filter(m => m.name.trim() !== ''),
            paymentMethods: (normalizedSettings.withdrawalMethods || []).filter(m => m.name.trim() !== '').map((m) => ({ id: m.id, name: m.name })),
            depositMethods: (normalizedSettings.depositMethods || []).filter(m => m.name.trim() !== ''),
            onboardingCourseSteps: (normalizedSettings.onboardingCourseSteps || []).filter(s => s.title.trim() !== '' && s.content.trim() !== ''),
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

        const settingsToSave = {
            ...normalizedSettings,
            withdrawalMethods: (normalizedSettings.withdrawalMethods || []).filter(m => m.name.trim() !== ''),
            paymentMethods: (normalizedSettings.withdrawalMethods || []).filter(m => m.name.trim() !== '').map((m) => ({ id: m.id, name: m.name })),
            depositMethods: (normalizedSettings.depositMethods || []).filter(m => m.name.trim() !== ''),
            onboardingCourseSteps: (normalizedSettings.onboardingCourseSteps || []).filter(s => s.title.trim() !== '' && s.content.trim() !== ''),
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
                </div>
                
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

                <div>
                    <h3 className="text-lg font-semibold">Deposit Settings</h3>
                    <p className="text-sm text-muted-foreground">Manage accepted deposit methods.</p>
                </div>
                <DepositMethodsManager
                    methods={settings.depositMethods || []}
                    onChange={(methods) => handleFieldChange('depositMethods', methods)}
                />
                
                <Separator />
                
                <div>
                    <h3 className="text-lg font-semibold">Withdrawal Settings</h3>
                    <p className="text-sm text-muted-foreground">Manage payment methods and the withdrawal schedule for users.</p>
                </div>
                <WithdrawalMethodsManager
                    methods={settings.withdrawalMethods || []}
                    onChange={(methods) => handleFieldChange('withdrawalMethods', methods)}
                />

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
