
"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { deleteGeneratedImage, deleteGeneratedImages, generateAndSaveImage, generateRandomImagePrompt, improveImagePrompt, refreshPendingImageGenerations } from '@/lib/user-api';
import { getUserData, getUserGeneratedImages, getPackage } from '@/lib/database';
import type { GeneratedImage, Package, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Wand2, Loader2, Download, Eye, ChevronLeft, ChevronRight, Trash2, Sparkles, Image as ImageIcon, Flame, ImagePlus } from 'lucide-react';
import NextImage from 'next/image';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type ImageModelKey = 'normal' | 'uncensored';
const IMAGE_MODEL_STORAGE_KEY = 'trainly.image.selectedModel';
const IMAGE_PLACEHOLDER_THUMBNAIL = 'https://placehold.co/400x400.png';

function isImageFinished(image: GeneratedImage) {
    return (image.status || 'completed') === 'completed' && Boolean(image.imageUrl);
}

function isImagePending(image: GeneratedImage) {
    return ['submitting', 'queued', 'processing'].includes(image.status || '');
}

function getImageProgress(image: GeneratedImage) {
    return Math.max(0, Math.min(100, Number(image.progress) || 0));
}

function hasUsableImageThumbnail(image: GeneratedImage) {
    return Boolean(image.thumbnailUrl && image.thumbnailUrl !== IMAGE_PLACEHOLDER_THUMBNAIL && isImageFinished(image));
}

const IMAGE_MODEL_THEME = {
    normal: {
        page: 'bg-gradient-to-b from-sky-500/[0.03] via-background to-background',
        panel: 'border-sky-200/70 dark:border-sky-900/60 bg-card/95',
        generateButton: 'bg-sky-600 hover:bg-sky-700 text-white',
        improveButton: 'border-sky-300/70 text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/30',
        badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    },
    uncensored: {
        page: 'bg-gradient-to-b from-rose-500/[0.04] via-background to-background',
        panel: 'border-rose-200/70 dark:border-rose-900/60 bg-card/95',
        generateButton: 'bg-rose-600 hover:bg-rose-700 text-white',
        improveButton: 'border-rose-300/70 text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30',
        badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    },
} satisfies Record<ImageModelKey, {
    page: string;
    panel: string;
    generateButton: string;
    improveButton: string;
    badge: string;
}>;

const IMAGE_MODEL_PERSONA = {
    normal: {
        title: 'Studio Mode',
        subtitle: 'Clean, realistic, and production-safe visual generations.',
        icon: ImageIcon,
        placeholder: 'Describe subject, style, composition, and lighting. Example: A cinematic portrait of a cat astronaut on Mars, ultra-detailed, golden-hour rim light.',
    },
    uncensored: {
        title: 'Raw Canvas Mode',
        subtitle: 'High-freedom creative direction with fewer stylistic constraints.',
        icon: Flame,
        placeholder: 'Push a bold creative concept with mood, lens style, and texture. Example: Neo-noir alley portrait, rain haze, 35mm grain, dramatic contrast.',
    },
} satisfies Record<ImageModelKey, {
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    placeholder: string;
}>;

function ImageGallery({
    images,
    onDelete,
    deletingImageIds,
    selectionMode,
    selectedImageIds,
    onToggleSelect,
}: {
    images: GeneratedImage[];
    onDelete: (imageId: string) => Promise<void>;
    deletingImageIds: Set<string>;
    selectionMode: boolean;
    selectedImageIds: Set<string>;
    onToggleSelect: (imageId: string) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (images.length === 0) {
            setIsOpen(false);
            setCurrentIndex(0);
            return;
        }

        if (currentIndex >= images.length) {
            setCurrentIndex(images.length - 1);
        }
    }, [images.length, currentIndex]);

    const openLightbox = (index: number) => {
        if (!isImageFinished(images[index])) return;
        setCurrentIndex(index);
        setIsOpen(true);
    };

    const showNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        const finishedImages = images.map((image, index) => ({ image, index })).filter(({ image }) => isImageFinished(image));
        if (finishedImages.length === 0) return;
        const currentFinishedIndex = finishedImages.findIndex((item) => item.index === currentIndex);
        const next = finishedImages[(currentFinishedIndex + 1 + finishedImages.length) % finishedImages.length];
        setCurrentIndex(next.index);
    };

    const showPrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        const finishedImages = images.map((image, index) => ({ image, index })).filter(({ image }) => isImageFinished(image));
        if (finishedImages.length === 0) return;
        const currentFinishedIndex = finishedImages.findIndex((item) => item.index === currentIndex);
        const prev = finishedImages[(currentFinishedIndex - 1 + finishedImages.length) % finishedImages.length];
        setCurrentIndex(prev.index);
    };

    if (images.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-16 border-2 border-dashed rounded-lg">
                <p>You haven't generated any images yet.</p>
                <p>Your creations will appear here!</p>
            </div>
        )
    }

    const currentImage = images[currentIndex];
    const finishedImagesCount = images.filter(isImageFinished).length;

    return (
        <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((image, index) => {
                    const pending = isImagePending(image);
                    const failed = image.status === 'failed';
                    const finished = isImageFinished(image);
                    const progress = getImageProgress(image);
                    return (
                    <Card
                        key={image.id}
                        className={cn("group relative overflow-hidden border-border/70 bg-card", selectionMode && selectedImageIds.has(image.id) && "ring-2 ring-primary")}
                        onClick={() => {
                            if (selectionMode) {
                                onToggleSelect(image.id);
                                return;
                            }
                            openLightbox(index);
                        }}
                    >
                        {selectionMode && (
                            <div className="absolute left-2 top-2 z-20 rounded-md bg-background/90 p-1" onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                    checked={selectedImageIds.has(image.id)}
                                    onCheckedChange={() => onToggleSelect(image.id)}
                                    aria-label={`Select image ${image.id}`}
                                />
                            </div>
                        )}
                        <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            className="absolute right-2 top-2 z-10 h-8 w-8"
                            disabled={deletingImageIds.has(image.id)}
                            onClick={(e) => {
                                e.stopPropagation();
                                void onDelete(image.id);
                            }}
                        >
                            {deletingImageIds.has(image.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2 className="h-4 w-4" />
                            )}
                                <span className="sr-only">Delete image</span>
                        </Button>
                        {hasUsableImageThumbnail(image) ? (
                            <NextImage
                                src={image.thumbnailUrl!}
                                alt={image.prompt}
                                width={400}
                                height={400}
                                className="aspect-square w-full cursor-pointer object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                        ) : (
                            <div className={cn(
                                "flex aspect-square w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-muted via-muted/70 to-background p-5 text-center",
                                failed && "from-destructive/15 via-muted to-background"
                            )}>
                                <div className={cn(
                                    "flex h-14 w-14 items-center justify-center rounded-full border bg-background/80",
                                    pending && "border-primary/30 text-primary",
                                    failed && "border-destructive/30 text-destructive"
                                )}>
                                    {pending ? <Loader2 className="h-7 w-7 animate-spin" /> : <ImageIcon className="h-7 w-7" />}
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold">
                                        {failed ? 'Generation failed' : pending ? 'Generating image' : 'Image unavailable'}
                                    </p>
                                    <p className="line-clamp-2 text-xs text-muted-foreground">{failed ? image.errorMessage || 'Please try again.' : image.prompt}</p>
                                </div>
                                {pending && (
                                    <div className="w-full max-w-[160px]">
                                        <div className="h-1.5 overflow-hidden rounded-full bg-muted-foreground/15">
                                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(8, progress)}%` }} />
                                        </div>
                                        <p className="mt-1 text-[11px] text-muted-foreground">{progress}%</p>
                                    </div>
                                )}
                            </div>
                        )}
                        {finished && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-4 opacity-0 transition-opacity group-hover:opacity-100">
                                <Button variant="secondary" size="icon" className="pointer-events-none">
                                    <Eye className="h-5 w-5" />
                                    <span className="sr-only">View Image</span>
                                </Button>
                            </div>
                        )}
                        {(pending || failed) && (
                            <div className={cn(
                                "absolute left-2 top-2 rounded-full px-2 py-1 text-[11px] font-semibold",
                                failed ? "bg-destructive text-destructive-foreground" : "bg-background/90 text-foreground"
                            )}>
                                {failed ? 'Failed' : image.status === 'queued' ? 'Queued' : 'Processing'}
                            </div>
                        )}
                    </Card>
                    );
                })}
            </div>
            
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-4xl p-4 sm:p-6">
                    <DialogTitle className="sr-only">Generated Image Preview</DialogTitle>
                    {currentImage && currentImage.imageUrl && (
                        <div className="flex flex-col gap-4 max-h-[85vh] overflow-y-auto pr-2">
                            <div className="relative aspect-square w-full">
                                {finishedImagesCount > 1 && (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute left-0 sm:left-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full h-10 w-10"
                                            onClick={showPrev}
                                        >
                                            <ChevronLeft className="h-6 w-6" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute right-0 sm:right-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full h-10 w-10"
                                            onClick={showNext}
                                        >
                                            <ChevronRight className="h-6 w-6" />
                                        </Button>
                                    </>
                                )}
                                <NextImage
                                    src={currentImage.imageUrl}
                                    alt={currentImage.prompt}
                                    fill
                                    className="object-contain rounded-md"
                                />
                            </div>
                            
                            <div>
                                <h3 className="font-semibold text-center mb-2">Prompt</h3>
                                <p className="text-sm text-muted-foreground italic bg-muted p-3 rounded-md text-center">"{currentImage.prompt}"</p>
                            </div>

                            <div className="flex justify-center">
                                <Button className="mr-2" asChild>
                                    <a href={currentImage.imageUrl} download={`trainly-image-${currentImage.id}.png`} target="_blank" rel="noreferrer">
                                        <Download className="mr-2 h-4 w-4" />
                                        Download Full Resolution
                                    </a>
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    disabled={deletingImageIds.has(currentImage.id)}
                                    onClick={() => {
                                        void onDelete(currentImage.id);
                                    }}
                                >
                                    {deletingImageIds.has(currentImage.id) ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="mr-2 h-4 w-4" />
                                    )}
                                    Delete
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}

function LoadingState() {
    return (
        <div>
            <Card className="mb-8">
                <CardContent className="p-6">
                    <div className="flex gap-4">
                        <Skeleton className="h-10 flex-grow" />
                        <Skeleton className="h-10 w-32" />
                    </div>
                    <Skeleton className="h-5 w-48 mt-4" />
                </CardContent>
            </Card>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="aspect-square w-full" />
                ))}
            </div>
        </div>
    )
}


export default function ImageGenerationPage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [prompt, setPrompt] = useState("");
    const [images, setImages] = useState<GeneratedImage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isImprovingPrompt, setIsImprovingPrompt] = useState(false);
    const [isGeneratingRandomPrompt, setIsGeneratingRandomPrompt] = useState(false);
    const [isPageLoading, setIsPageLoading] = useState(true);
    const [isRefreshingPendingImages, setIsRefreshingPendingImages] = useState(false);
    const isRefreshingPendingImagesRef = useRef(false);
    const [deletingImageIds, setDeletingImageIds] = useState<Set<string>>(new Set());
    const [pendingDeleteImageId, setPendingDeleteImageId] = useState<string | null>(null);
    const [pendingBulkDeleteType, setPendingBulkDeleteType] = useState<'all' | 'selected' | null>(null);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [isBulkDownloading, setIsBulkDownloading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(12);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());

    const [limit, setLimit] = useState(0);
    const [count, setCount] = useState(0);
    const [limitType, setLimitType] = useState<'daily' | 'lifetime'>('daily');
    const [allowedImageModels, setAllowedImageModels] = useState<ImageModelKey[]>(['normal']);
    const [selectedImageModel, setSelectedImageModel] = useState<ImageModelKey>('normal');
    const theme = IMAGE_MODEL_THEME[selectedImageModel];
    const persona = IMAGE_MODEL_PERSONA[selectedImageModel];
    const PersonaIcon = persona.icon;

    const persistImageModel = (value: ImageModelKey) => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(IMAGE_MODEL_STORAGE_KEY, value);
    };

    const readPersistedImageModel = (): ImageModelKey | null => {
        if (typeof window === 'undefined') return null;
        const stored = window.localStorage.getItem(IMAGE_MODEL_STORAGE_KEY);
        return stored === 'uncensored' ? 'uncensored' : stored === 'normal' ? 'normal' : null;
    };

    const fetchPageData = async () => {
        if (!user) return;
        setIsPageLoading(true);
        try {
            const [userData, generatedImages] = await Promise.all([
                getUserData(user.uid),
                getUserGeneratedImages(user.uid)
            ]);

            if (userData?.packageId) {
                const pkg = await getPackage(userData.packageId);
                if (pkg) {
                    const currentLimit = pkg.imageGenerationLimit ?? 0;
                    const currentLimitType = pkg.imageGenerationLimitType || 'daily';
                    const legacyTypes = pkg.allowedModelTypes || [];
                    const hasLegacyType = (type: string) => legacyTypes.includes(type);
                    const legacyFallbackEnabled = legacyTypes.length === 0;
                    const allowImageNormal = (pkg.allowImageNormal ?? hasLegacyType('image')) || legacyFallbackEnabled;
                    const allowImageUncensored = pkg.allowImageUncensored ?? pkg.allowUncensoredImageGeneration ?? hasLegacyType('uncensored');
                    const nextAllowedModels: ImageModelKey[] = [];
                    if (allowImageNormal) nextAllowedModels.push('normal');
                    if (allowImageUncensored) nextAllowedModels.push('uncensored');
                    setAllowedImageModels(nextAllowedModels);

                    const persistedModel = readPersistedImageModel();
                    const nextModel = persistedModel && nextAllowedModels.includes(persistedModel)
                        ? persistedModel
                        : (nextAllowedModels[0] || 'normal');
                    setSelectedImageModel(nextModel);
                    persistImageModel(nextModel);

                    setLimit(currentLimit);
                    setLimitType(currentLimitType);

                    if (currentLimitType === 'lifetime') {
                        setCount(userData.packageImageGenerationCount || 0);
                    } else { // Daily
                         const lastReset = userData.lastImageGenerationReset ? new Date(userData.lastImageGenerationReset) : new Date(0);
                         const today = new Date();
                         today.setHours(0, 0, 0, 0);
                         setCount(lastReset < today ? 0 : userData.dailyImageGenerationCount || 0);
                    }
                } else {
                    setLimit(0);
                    setCount(0);
                    setAllowedImageModels([]);
                }
            } else {
                setLimit(0);
                setCount(0);
                setAllowedImageModels([]);
            }
            
            setImages(generatedImages);

        } catch (error) {
            toast({ title: "Error", description: "Could not load page data.", variant: "destructive" });
        } finally {
            setIsPageLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading && user) {
            fetchPageData();
        }
    }, [user, authLoading]);

    const refreshPendingImages = useCallback(async () => {
        if (!user || isRefreshingPendingImagesRef.current) return;
        const hasPendingImages = images.some(isImagePending);
        if (!hasPendingImages) return;

        isRefreshingPendingImagesRef.current = true;
        setIsRefreshingPendingImages(true);
        try {
            await refreshPendingImageGenerations(user.uid);
            const generatedImages = await getUserGeneratedImages(user.uid);
            setImages(generatedImages);
        } catch {
            // Refresh is opportunistic; individual failures stay visible on the next successful poll.
        } finally {
            isRefreshingPendingImagesRef.current = false;
            setIsRefreshingPendingImages(false);
        }
    }, [images, user]);

    useEffect(() => {
        if (!user || !images.some(isImagePending)) return;

        void refreshPendingImages();
        const interval = window.setInterval(() => {
            void refreshPendingImages();
        }, 15000);

        return () => window.clearInterval(interval);
    }, [images, refreshPendingImages, user]);

    const handleGenerate = async () => {
        if (!user) {
            toast({ title: "Not Authenticated", variant: "destructive" });
            return;
        }
        if (!prompt) {
            toast({ title: "Prompt is empty", description: "Please enter a prompt to generate an image.", variant: "destructive" });
            return;
        }
        
        setIsLoading(true);
        try {
            const result = await generateAndSaveImage(user.uid, prompt, selectedImageModel);
            if (result.success && result.image) {
                const finished = isImageFinished(result.image);
                toast({
                    title: finished ? "Success!" : "Image queued",
                    description: finished ? "Your image has been generated." : "Your image is being generated in the background.",
                });
                setImages(prev => [result.image!, ...prev]);
                setCount(prev => prev + 1);
                setPrompt("");
            } else {
                toast({ title: "Generation Failed", description: result.message, variant: "destructive" });
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ title: "Error", description: errorMessage, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleImprovePrompt = async () => {
        if (!user) {
            toast({ title: "Not Authenticated", variant: "destructive" });
            return;
        }
        if (!prompt.trim()) {
            toast({ title: "Prompt is empty", description: "Enter a prompt first so AI can improve it.", variant: "destructive" });
            return;
        }

        setIsImprovingPrompt(true);
        try {
            const result = await improveImagePrompt(user.uid, prompt);
            const improvedPrompt = String(result.improvedPrompt || '').trim();
            if (result.success && improvedPrompt) {
                setPrompt(improvedPrompt);
                toast({ title: "Prompt improved", description: "AI refined your prompt using the normal chat model." });
            } else {
                toast({ title: "Could not improve prompt", description: result.message || "Try again in a moment.", variant: "destructive" });
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ title: "Error", description: errorMessage, variant: "destructive" });
        } finally {
            setIsImprovingPrompt(false);
        }
    };

    const handleRandomPrompt = async () => {
        if (!user) {
            toast({ title: "Not Authenticated", variant: "destructive" });
            return;
        }

        setIsGeneratingRandomPrompt(true);
        try {
            const result = await generateRandomImagePrompt(user.uid);
            const randomPrompt = String(result.improvedPrompt || '').trim();
            if (result.success && randomPrompt) {
                setPrompt(randomPrompt);
                toast({ title: "Random idea ready", description: "A fresh image prompt has been added." });
            } else {
                toast({ title: "Could not generate idea", description: result.message || "Try again in a moment.", variant: "destructive" });
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ title: "Error", description: errorMessage, variant: "destructive" });
        } finally {
            setIsGeneratingRandomPrompt(false);
        }
    };

    const handleDelete = async (imageId: string) => {
        if (!user) {
            toast({ title: "Not Authenticated", variant: "destructive" });
            return;
        }

        setDeletingImageIds((prev) => {
            const next = new Set(prev);
            next.add(imageId);
            return next;
        });

        try {
            const result = await deleteGeneratedImage(user.uid, imageId);
            if (result.success) {
                setImages((prev) => prev.filter((image) => image.id !== imageId));
                toast({ title: 'Image deleted.' });
            } else {
                toast({ title: 'Delete Failed', description: result.message || 'Could not delete image.', variant: 'destructive' });
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        } finally {
            setDeletingImageIds((prev) => {
                const next = new Set(prev);
                next.delete(imageId);
                return next;
            });
            if (pendingDeleteImageId === imageId) {
                setPendingDeleteImageId(null);
            }
        }
    };
    
    const canGenerate = count < limit && allowedImageModels.includes(selectedImageModel);
    const totalPages = Math.max(1, Math.ceil(images.length / pageSize));
    const paginatedImages = images.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const pendingImageCount = images.filter(isImagePending).length;
    const downloadableImageCount = images.filter(isImageFinished).length;
    const selectedDownloadableCount = images.filter((img) => selectedImageIds.has(img.id) && isImageFinished(img)).length;

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        setSelectedImageIds((prev) => {
            const existingIds = new Set(images.map((img) => img.id));
            const next = new Set<string>();
            prev.forEach((id) => {
                if (existingIds.has(id)) next.add(id);
            });
            return next;
        });
    }, [images]);

    const limitMessage = () => {
        if (limit === 0) {
            return "Your current package does not allow image generation.";
        }
        if (!allowedImageModels.includes(selectedImageModel)) {
            return `Your current package does not allow the ${selectedImageModel} image model.`;
        }
        if (!canGenerate) {
            return `You have reached your ${limitType} generation limit. Upgrade your package for more.`;
        }
        return `${limit - count} of ${limit} generations remaining ${limitType === 'lifetime' ? 'for this package' : 'today'} using ${selectedImageModel} model.`;
    };

    const handleDownloadImages = async (targetImages: GeneratedImage[]) => {
        const downloadableImages = targetImages.filter(isImageFinished);
        if (downloadableImages.length === 0 || isBulkDownloading) return;
        setIsBulkDownloading(true);
        try {
            for (const image of downloadableImages) {
                try {
                    const response = await fetch(image.imageUrl!);
                    if (!response.ok) {
                        throw new Error('Failed to fetch image blob');
                    }
                    const blob = await response.blob();
                    const objectUrl = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = objectUrl;
                    link.download = `trainly-image-${image.id}.png`;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    URL.revokeObjectURL(objectUrl);
                } catch {
                    const link = document.createElement('a');
                    link.href = image.imageUrl!;
                    link.download = `trainly-image-${image.id}.png`;
                    link.target = '_blank';
                    link.rel = 'noreferrer';
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                }
            }
            toast({ title: 'Download started', description: `Attempted ${downloadableImages.length} image downloads.` });
        } finally {
            setIsBulkDownloading(false);
        }
    };

    const handleDeleteImages = async (targetIds: string[]) => {
        if (!user || targetIds.length === 0 || isBulkDeleting) return;
        setIsBulkDeleting(true);
        setPendingBulkDeleteType(null);
        setDeletingImageIds(new Set(targetIds));

        try {
            const result = await deleteGeneratedImages(user.uid, targetIds);
            const deletedSet = new Set(result.deletedIds || []);
            const deletedCount = deletedSet.size;

            if (deletedSet.size > 0) {
                setImages((prev) => prev.filter((image) => !deletedSet.has(image.id)));
                setSelectedImageIds((prev) => {
                    const next = new Set(prev);
                    deletedSet.forEach((id) => next.delete(id));
                    return next;
                });
            }

            if (deletedCount === targetIds.length) {
                toast({ title: 'All images deleted', description: result.message });
            } else if (deletedCount > 0) {
                toast({
                    title: 'Partial delete complete',
                    description: result.message || `${deletedCount} of ${targetIds.length} images were deleted.`,
                    variant: 'destructive',
                });
            } else {
                toast({ title: 'Delete failed', description: result.message || 'Could not delete images.', variant: 'destructive' });
            }
        } catch (error) {
            toast({
                title: 'Delete failed',
                description: error instanceof Error ? error.message : 'Could not delete images.',
                variant: 'destructive',
            });
        } finally {
            setDeletingImageIds(new Set());
            setIsBulkDeleting(false);
        }
    };

    const handleDownloadAll = async () => {
        await handleDownloadImages(images.filter(isImageFinished));
    };

    const handleDownloadSelected = async () => {
        const selected = images.filter((img) => selectedImageIds.has(img.id) && isImageFinished(img));
        await handleDownloadImages(selected);
    };

    const handleDeleteAll = async () => {
        await handleDeleteImages(images.map((img) => img.id));
    };

    const handleDeleteSelected = async () => {
        await handleDeleteImages(Array.from(selectedImageIds));
    };

    const toggleImageSelection = (imageId: string) => {
        setSelectedImageIds((prev) => {
            const next = new Set(prev);
            if (next.has(imageId)) {
                next.delete(imageId);
            } else {
                next.add(imageId);
            }
            return next;
        });
    };

    const selectAllVisible = () => {
        setSelectedImageIds((prev) => {
            const next = new Set(prev);
            paginatedImages.forEach((img) => next.add(img.id));
            return next;
        });
    };

    const clearSelection = () => {
        setSelectedImageIds(new Set());
    };


    if (isPageLoading || authLoading) return <LoadingState />;

    return (
        <div className={cn("space-y-8 rounded-xl p-3 md:p-4", theme.page)}>
            <div>
                <h1 className="text-3xl font-bold font-headline">AI Image Generation</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", theme.badge)}>
                        <PersonaIcon className="h-3.5 w-3.5" />
                        {persona.title}
                    </span>
                    <p className="text-sm text-muted-foreground">{persona.subtitle}</p>
                </div>
            </div>

            <Card className={cn("border", theme.panel)}>
                <CardContent className="p-6">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Image Models</span>
                        {(['normal', 'uncensored'] as ImageModelKey[]).map((model) => {
                            const isAllowed = allowedImageModels.includes(model);
                            const isActive = selectedImageModel === model;
                            return (
                                <button
                                    key={model}
                                    type="button"
                                    onClick={() => {
                                        if (!isAllowed) return;
                                        setSelectedImageModel(model);
                                        persistImageModel(model);
                                    }}
                                    disabled={!isAllowed}
                                    className={cn(
                                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition",
                                        isAllowed
                                            ? isActive
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-border bg-background hover:bg-muted"
                                            : "border-border bg-muted text-muted-foreground"
                                    )}
                                >
                                    <span className="capitalize">{model}</span>
                                    <span className="text-[10px] opacity-80">{isAllowed ? 'Allowed' : 'Locked'}</span>
                                </button>
                            );
                        })}
                    </div>
                    <div className="space-y-4">
                        <Textarea
                            placeholder={persona.placeholder}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            disabled={isLoading || isImprovingPrompt || isGeneratingRandomPrompt || !canGenerate}
                            rows={4}
                            className="resize-y min-h-[110px]"
                        />
                        <div className="flex flex-col gap-3 md:flex-row">
                            <Button
                                onClick={handleImprovePrompt}
                                variant="outline"
                                disabled={isLoading || isImprovingPrompt || isGeneratingRandomPrompt || !prompt.trim()}
                                className={cn("md:w-64", theme.improveButton)}
                            >
                                {isImprovingPrompt ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                Improve Prompt with AI
                            </Button>
                            <Button
                                onClick={handleRandomPrompt}
                                variant="outline"
                                disabled={isLoading || isImprovingPrompt || isGeneratingRandomPrompt || !canGenerate}
                                className={cn("md:w-48", theme.improveButton)}
                            >
                                {isGeneratingRandomPrompt ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                                Random Idea
                            </Button>
                            <Button 
                                onClick={handleGenerate} 
                                disabled={isLoading || isImprovingPrompt || isGeneratingRandomPrompt || !canGenerate} 
                                className={cn("md:w-48", theme.generateButton)}
                            >
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                Generate
                            </Button>
                        </div>
                    </div>
                     <p className="text-sm text-muted-foreground mt-4">
                        {limitMessage()}
                    </p>
                </CardContent>
            </Card>

            <h2 className="text-2xl font-bold font-headline">Your Gallery</h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>
                        Page {currentPage} of {totalPages} • {images.length} total images
                        {pendingImageCount > 0 ? ` • ${pendingImageCount} generating` : ''}
                        {isRefreshingPendingImages ? ' • checking...' : ''}
                    </span>
                    <Select
                        value={String(pageSize)}
                        onValueChange={(value) => {
                            setPageSize(Number(value));
                            setCurrentPage(1);
                        }}
                    >
                        <SelectTrigger className="h-8 w-[110px]">
                            <SelectValue placeholder="Per page" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="12">12 / page</SelectItem>
                            <SelectItem value="24">24 / page</SelectItem>
                            <SelectItem value="48">48 / page</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        variant={selectionMode ? 'default' : 'outline'}
                        onClick={() => {
                            setSelectionMode((prev) => !prev);
                            if (selectionMode) {
                                clearSelection();
                            }
                        }}
                        disabled={isBulkDeleting || isBulkDownloading || images.length === 0}
                    >
                        {selectionMode ? 'Exit Select Mode' : 'Select Images'}
                    </Button>
                    {selectionMode && (
                        <>
                            <Button type="button" variant="outline" onClick={selectAllVisible} disabled={paginatedImages.length === 0}>Select Page</Button>
                            <Button type="button" variant="outline" onClick={clearSelection} disabled={selectedImageIds.size === 0}>Clear</Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleDownloadSelected}
                                disabled={selectedDownloadableCount === 0 || isBulkDownloading || isBulkDeleting}
                            >
                                {isBulkDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                Download Selected ({selectedDownloadableCount})
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={() => setPendingBulkDeleteType('selected')}
                                disabled={selectedImageIds.size === 0 || isBulkDeleting || isBulkDownloading}
                            >
                                {isBulkDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                Delete Selected ({selectedImageIds.size})
                            </Button>
                        </>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleDownloadAll}
                        disabled={downloadableImageCount === 0 || isBulkDownloading || isBulkDeleting}
                    >
                        {isBulkDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Download All
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={() => setPendingBulkDeleteType('all')}
                        disabled={images.length === 0 || isBulkDeleting || isBulkDownloading}
                    >
                        {isBulkDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                        Delete All
                    </Button>
                </div>
            </div>
            <ImageGallery
                images={paginatedImages}
                onDelete={async (imageId) => setPendingDeleteImageId(imageId)}
                deletingImageIds={deletingImageIds}
                selectionMode={selectionMode}
                selectedImageIds={selectedImageIds}
                onToggleSelect={toggleImageSelection}
            />
            {images.length > pageSize && (
                <div className="flex items-center justify-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage <= 1}
                    >
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">{currentPage} / {totalPages}</span>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage >= totalPages}
                    >
                        Next
                    </Button>
                </div>
            )}

            <AlertDialog open={Boolean(pendingDeleteImageId)} onOpenChange={(open) => {
                if (!open) {
                    setPendingDeleteImageId(null);
                }
            }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete generated image?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. The selected image will be permanently removed from your gallery.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={pendingDeleteImageId ? deletingImageIds.has(pendingDeleteImageId) : false}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={pendingDeleteImageId ? deletingImageIds.has(pendingDeleteImageId) : false}
                            onClick={(event) => {
                                event.preventDefault();
                                if (pendingDeleteImageId) {
                                    void handleDelete(pendingDeleteImageId);
                                }
                            }}
                        >
                            {pendingDeleteImageId && deletingImageIds.has(pendingDeleteImageId) ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete image'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={pendingBulkDeleteType !== null} onOpenChange={(open) => {
                if (!open) setPendingBulkDeleteType(null);
            }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {pendingBulkDeleteType === 'selected' ? 'Delete selected images?' : 'Delete all generated images?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingBulkDeleteType === 'selected'
                                ? 'This action cannot be undone. Selected images will be permanently removed.'
                                : 'This action cannot be undone. All images in your gallery will be permanently removed.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isBulkDeleting}
                            onClick={(event) => {
                                event.preventDefault();
                                if (pendingBulkDeleteType === 'selected') {
                                    void handleDeleteSelected();
                                } else {
                                    void handleDeleteAll();
                                }
                            }}
                        >
                            {isBulkDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                pendingBulkDeleteType === 'selected' ? 'Delete selected images' : 'Delete all images'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
