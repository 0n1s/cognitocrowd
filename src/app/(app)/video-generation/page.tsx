
"use client";

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { generateAndSaveVideo, generateRandomVideoIdea, improveVideoIdea, improveVideoPrompt, refreshPendingVideoGenerations } from '@/lib/user-api';
import { getUserData, getUserGeneratedVideos, getPackage } from '@/lib/database';
import type { GeneratedVideo, Package, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, Loader2, Download, Eye, ChevronLeft, ChevronRight, Clapperboard, Sparkles } from 'lucide-react';
import NextImage from 'next/image';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const VIDEO_PLACEHOLDER_THUMBNAIL = 'https://placehold.co/400x300.png';

type VideoFormatOption = {
    value: 'portrait-480' | 'landscape-480' | 'portrait-720' | 'landscape-720';
    label: string;
    aspectRatio: '9:16' | '16:9';
    resolution: '480x848' | '848x480' | '720x1280' | '1280x720';
};

const VIDEO_FORMAT_OPTIONS: VideoFormatOption[] = [
    { value: 'portrait-480', label: '📱 Mobile 480p', aspectRatio: '9:16', resolution: '480x848' },
    { value: 'landscape-480', label: '📱 Mobile 480p', aspectRatio: '16:9', resolution: '848x480' },
    { value: 'portrait-720', label: '📱 Mobile 720p', aspectRatio: '9:16', resolution: '720x1280' },
    { value: 'landscape-720', label: '🖥️ Desktop 720p', aspectRatio: '16:9', resolution: '1280x720' },
];

function buildImprovedVideoPrompt(rawIdea: string, durationSeconds: number, format: VideoFormatOption) {
    const safeIdea = rawIdea.trim();
    const clampedDuration = Math.max(1, Math.min(20, durationSeconds));
    const segmentCount = Math.min(clampedDuration, clampedDuration >= 13 ? 4 : clampedDuration >= 7 ? 3 : clampedDuration >= 2 ? 2 : 1);
    const baseLength = Math.floor(clampedDuration / segmentCount);
    const remainder = clampedDuration % segmentCount;

    const sections: string[] = [];
    let start = 0;

    for (let index = 0; index < segmentCount; index += 1) {
        const segmentLength = baseLength + (index < remainder ? 1 : 0);
        const end = index === segmentCount - 1 ? clampedDuration : Math.min(clampedDuration, start + Math.max(1, segmentLength));
        const isLast = index === segmentCount - 1;

        const action = index === 0
            ? `Open with an establishing shot that clearly introduces the scene and the main subject. Use a ${format.aspectRatio} frame with ${format.resolution} composition, cinematic lighting, and stable continuity.`
            : index === segmentCount - 1
                ? `Resolve the scene with a strong final visual beat, clear motion, and a memorable ending that lands exactly at ${clampedDuration}s.`
                : `Continue the action with visible progression, camera movement, environmental detail, and smooth continuity.`;

        sections.push(`[${start}s:${end}s] ${action}`);
        start = isLast ? clampedDuration : end;
    }

    return [
        `Create a cinematic, realistic ${format.aspectRatio} video at ${format.resolution} based on this idea: ${safeIdea}. The concept should feel cohesive, with consistent characters, objects, wardrobe, location, visual style, camera style, lighting, mood, and continuity throughout the clip. Use natural motion, concrete visible actions, and a clear beginning-to-end progression.`,
        ...sections,
    ].join('\n');
}

function isVideoFinished(video: GeneratedVideo) {
    return Boolean(video.videoUrl && (!video.status || video.status === 'completed'));
}

function isVideoPending(video: GeneratedVideo) {
    return ['submitting', 'queued', 'processing'].includes(String(video.status || ''));
}

function hasUsableVideoThumbnail(video: GeneratedVideo) {
    return Boolean(video.thumbnailUrl && !video.thumbnailUrl.includes('placehold.co'));
}

function getVideoProgress(video: GeneratedVideo) {
    return Math.max(0, Math.min(100, Number(video.progress) || 0));
}

function VideoGallery({ videos }: { videos: GeneratedVideo[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);

    const openLightbox = (index: number) => {
        if (!isVideoFinished(videos[index])) return;
        setCurrentIndex(index);
        setIsOpen(true);
    };

    const showNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prevIndex) => (prevIndex + 1) % videos.length);
    };

    const showPrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prevIndex) => (prevIndex - 1 + videos.length) % videos.length);
    };

    if (videos.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-16 border-2 border-dashed rounded-lg">
                <p>You haven't generated any videos yet.</p>
                <p>Your creations will appear here!</p>
            </div>
        )
    }

    const currentVideo = videos[currentIndex];

    return (
        <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {videos.map((video, index) => {
                    const finished = isVideoFinished(video);
                    const pending = isVideoPending(video);
                    const failed = video.status === 'failed';
                    const progress = getVideoProgress(video);

                    return (
                        <Card
                            key={video.id}
                            className={`group overflow-hidden border-muted/70 bg-card/80 shadow-sm transition duration-200 hover:border-primary/40 hover:shadow-md ${finished ? 'cursor-pointer' : ''}`}
                            onClick={() => openLightbox(index)}
                        >
                            <div className="relative aspect-video overflow-hidden bg-zinc-950">
                                {hasUsableVideoThumbnail(video) ? (
                                    <NextImage
                                        src={video.thumbnailUrl!}
                                        alt={video.prompt}
                                        width={400}
                                        height={300}
                                        className={`h-full w-full object-cover transition-transform duration-300 ${finished ? 'group-hover:scale-105' : 'opacity-70'}`}
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.35),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(244,63,94,0.24),transparent_28%),linear-gradient(135deg,#050816,#111827_55%,#020617)]">
                                        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur">
                                            {pending ? (
                                                <Loader2 className="h-7 w-7 animate-spin" />
                                            ) : failed ? (
                                                <AlertTriangle className="h-7 w-7 text-rose-200" />
                                            ) : (
                                                <Clapperboard className="h-7 w-7" />
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="absolute left-2 top-2 rounded-full border border-white/15 bg-black/55 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
                                    {pending ? 'Generating' : failed ? 'Failed' : 'Ready'}
                                </div>

                                {pending && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/15">
                                        <div className="h-full bg-sky-400 transition-all" style={{ width: `${progress}%` }} />
                                    </div>
                                )}

                                {finished && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-lg">
                                            <Eye className="h-5 w-5" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid gap-2 p-3">
                                <p className="line-clamp-2 min-h-10 text-sm font-medium leading-snug">
                                    {failed ? 'Generation failed' : video.rawIdea || video.prompt}
                                </p>
                                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                    <span>{video.resolution || 'Video'}</span>
                                    <span>{pending ? `${progress}%` : failed ? 'Needs retry' : 'Complete'}</span>
                                </div>
                                {failed && video.errorMessage && (
                                    <p className="line-clamp-2 text-xs text-rose-500">{video.errorMessage}</p>
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>
            
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-4xl p-4 sm:p-6">
                    <DialogTitle className="sr-only">Generated Video Preview</DialogTitle>
                    {currentVideo && (
                        <div className="flex flex-col gap-4 max-h-[85vh] overflow-y-auto pr-2">
                             <div className="relative aspect-video w-full bg-black rounded-md">
                                {videos.length > 1 && (
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
                                {currentVideo.videoUrl && <video src={currentVideo.videoUrl} controls autoPlay className="w-full h-full rounded-md" />}
                            </div>
                            
                            <div>
                                <h3 className="font-semibold text-center mb-2">Prompt</h3>
                                <p className="text-sm text-muted-foreground italic bg-muted p-3 rounded-md text-center">"{currentVideo.prompt}"</p>
                            </div>

                            <div className="flex justify-center">
                                <Button asChild>
                                    <a href={currentVideo.videoUrl || '#'} download={`trainly-video-${currentVideo.id}.mp4`} target="_blank">
                                        <Download className="mr-2 h-4 w-4" />
                                        Download Video
                                    </a>
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
                    <Skeleton key={i} className="aspect-video w-full" />
                ))}
            </div>
        </div>
    )
}


export default function VideoGenerationPage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [rawIdea, setRawIdea] = useState("");
    const [finalPrompt, setFinalPrompt] = useState("");
    const [durationSeconds, setDurationSeconds] = useState(10);
    const [selectedFormat, setSelectedFormat] = useState<VideoFormatOption>(VIDEO_FORMAT_OPTIONS[0]);
    const [videos, setVideos] = useState<GeneratedVideo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isPageLoading, setIsPageLoading] = useState(true);
    const [isImprovingIdea, setIsImprovingIdea] = useState(false);
    const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);
    const [isImprovingPrompt, setIsImprovingPrompt] = useState(false);
    const [isRefreshingPending, setIsRefreshingPending] = useState(false);
    const [shouldImprovePrompt, setShouldImprovePrompt] = useState(true);
    const isRefreshingPendingRef = useRef(false);

    const [limit, setLimit] = useState(0);
    const [count, setCount] = useState(0);
    const [limitType, setLimitType] = useState<'daily' | 'lifetime'>('daily');

    const fetchPageData = async () => {
        if (!user) return;
        setIsPageLoading(true);
        try {
            const [userData, generatedVideos] = await Promise.all([
                getUserData(user.uid),
                getUserGeneratedVideos(user.uid)
            ]);

            if (userData?.packageId) {
                const pkg = await getPackage(userData.packageId);
                if (pkg) {
                    const currentLimit = pkg.videoGenerationLimit ?? 0;
                    const currentLimitType = pkg.videoGenerationLimitType || 'daily';
                    setLimit(currentLimit);
                    setLimitType(currentLimitType);

                    if (currentLimitType === 'lifetime') {
                        setCount(userData.packageVideoGenerationCount || 0);
                    } else { // Daily
                         const lastReset = userData.lastVideoGenerationReset ? new Date(userData.lastVideoGenerationReset) : new Date(0);
                         const today = new Date();
                         today.setHours(0, 0, 0, 0);
                         setCount(lastReset < today ? 0 : userData.dailyVideoGenerationCount || 0);
                    }
                }
            } else {
                setLimit(0);
                setCount(0);
            }
            
            setVideos(generatedVideos);

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

    const refreshPendingVideos = async () => {
        if (!user?.uid || isRefreshingPendingRef.current) return;
        const hasPending = videos.some(isVideoPending);
        if (!hasPending) return;

        isRefreshingPendingRef.current = true;
        setIsRefreshingPending(true);
        try {
            const result = await refreshPendingVideoGenerations(user.uid);
            if (result.success) {
                const generatedVideos = await getUserGeneratedVideos(user.uid);
                setVideos(generatedVideos);
            }
        } finally {
            isRefreshingPendingRef.current = false;
            setIsRefreshingPending(false);
        }
    };

    useEffect(() => {
        if (!user?.uid || !videos.some(isVideoPending)) return;

        refreshPendingVideos();
        const timer = window.setInterval(() => {
            refreshPendingVideos();
        }, 15000);

        return () => window.clearInterval(timer);
    }, [user?.uid, videos]);

    useEffect(() => {
        const trimmedIdea = rawIdea.trim();
        if (!trimmedIdea) {
            setFinalPrompt('');
            return;
        }

        if (!shouldImprovePrompt) {
            setFinalPrompt(trimmedIdea);
            return;
        }

        if (!user?.uid) {
            setFinalPrompt(buildImprovedVideoPrompt(trimmedIdea, durationSeconds, selectedFormat));
            return;
        }

        const timer = window.setTimeout(async () => {
            setIsImprovingPrompt(true);
            try {
                const result = await improveVideoPrompt(user.uid, {
                    rawIdea: trimmedIdea,
                    durationSeconds,
                    aspectRatio: selectedFormat.aspectRatio,
                    resolution: selectedFormat.resolution,
                });

                if (result.improvedPrompt?.trim()) {
                    setFinalPrompt(result.improvedPrompt.trim());
                } else {
                    setFinalPrompt(buildImprovedVideoPrompt(trimmedIdea, durationSeconds, selectedFormat));
                }
            } catch {
                setFinalPrompt(buildImprovedVideoPrompt(trimmedIdea, durationSeconds, selectedFormat));
            } finally {
                setIsImprovingPrompt(false);
            }
        }, 700);

        return () => window.clearTimeout(timer);
    }, [rawIdea, durationSeconds, selectedFormat, shouldImprovePrompt, user?.uid]);

    const handleRawIdeaChange = (value: string) => {
        setRawIdea(value);
    };

    const handleImproveIdea = async () => {
        if (!user) {
            toast({ title: "Not Authenticated", variant: "destructive" });
            return;
        }
        if (!rawIdea.trim()) {
            toast({ title: "Raw idea is empty", description: "Please enter a raw video idea first.", variant: "destructive" });
            return;
        }

        setIsImprovingIdea(true);
        try {
            const result = await improveVideoIdea(user.uid, rawIdea.trim());
            if (!result.success) {
                throw new Error(result.message || 'Could not improve the video idea.');
            }
            const improved = String(result.improvedPrompt || '').trim();
            if (!improved) {
                throw new Error('AI did not return an improved idea.');
            }
            setRawIdea(improved);
            toast({ title: 'Idea Improved', description: 'Your video idea is clearer and more filmable now.' });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            toast({ title: 'Idea Improvement Failed', description: errorMessage, variant: 'destructive' });
        } finally {
            setIsImprovingIdea(false);
        }
    };

    const handleRandomIdea = async () => {
        if (!user) {
            toast({ title: "Not Authenticated", variant: "destructive" });
            return;
        }

        setIsGeneratingIdea(true);
        try {
            const result = await generateRandomVideoIdea(user.uid);
            if (!result.success) {
                throw new Error(result.message || 'Could not generate a random video idea.');
            }
            const randomIdea = String(result.improvedPrompt || '').trim();
            if (!randomIdea) {
                throw new Error('AI did not return a random idea.');
            }
            setRawIdea(randomIdea);
            toast({ title: 'Random Idea Ready', description: 'A fresh video concept has been added.' });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            toast({ title: 'Random Idea Failed', description: errorMessage, variant: 'destructive' });
        } finally {
            setIsGeneratingIdea(false);
        }
    };

    const handleGenerate = async () => {
        if (!user) {
            toast({ title: "Not Authenticated", variant: "destructive" });
            return;
        }
        if (!rawIdea.trim()) {
            toast({ title: "Prompt is empty", description: "Please enter a raw video idea to generate a video.", variant: "destructive" });
            return;
        }
        if (!finalPrompt.trim()) {
            toast({ title: "Prompt is empty", description: "Please improve the prompt before generating.", variant: "destructive" });
            return;
        }
        
        setIsLoading(true);
        try {
            const result = await generateAndSaveVideo(user.uid, {
                prompt: finalPrompt,
                rawIdea,
                durationSeconds,
                aspectRatio: selectedFormat.aspectRatio,
                resolution: selectedFormat.resolution,
            });
            if (result.success && result.video) {
                toast({
                    title: isVideoFinished(result.video) ? "Success!" : "Video Queued",
                    description: isVideoFinished(result.video)
                        ? "Your video has been generated."
                        : "Your video is generating in the gallery. You can leave and come back later.",
                });
                setVideos(prev => [result.video!, ...prev]);
                setCount(prev => prev + 1);
                setRawIdea("");
                setFinalPrompt("");
                setDurationSeconds(10);
                setSelectedFormat(VIDEO_FORMAT_OPTIONS[0]);
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
    
    const canGenerate = count < limit;

    const limitMessage = () => {
        if (limit === 0) {
            return "Your current package does not allow video generation.";
        }
        if (!canGenerate) {
            return `You have reached your ${limitType} generation limit. Upgrade your package for more.`;
        }
        return `${limit - count} of ${limit} generations remaining ${limitType === 'lifetime' ? 'for this package' : 'today'}.`;
    };

    const pendingVideoCount = videos.filter(isVideoPending).length;
    const failedVideoCount = videos.filter((video) => video.status === 'failed').length;

    if (isPageLoading || authLoading) return <LoadingState />;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">AI Video Generation</h1>
                <p className="text-muted-foreground mt-1">
                    Describe any scene you can imagine, and our AI will bring it to life in video.
                </p>
            </div>

            <Card>
                <CardContent className="p-6">
                    <div className="grid gap-6">
                        <div className="grid gap-2">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <h3 className="text-sm font-semibold">Raw Video Idea</h3>
                                <div className="flex flex-wrap gap-2">
                                    <Button type="button" variant="outline" size="sm" onClick={handleImproveIdea} disabled={isLoading || isImprovingIdea || isGeneratingIdea || !canGenerate}>
                                        {isImprovingIdea ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                        Improve Idea
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" onClick={handleRandomIdea} disabled={isLoading || isImprovingIdea || isGeneratingIdea || !canGenerate}>
                                        {isGeneratingIdea ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clapperboard className="mr-2 h-4 w-4" />}
                                        Random Idea
                                    </Button>
                                </div>
                            </div>
                            <Textarea
                                placeholder="e.g., A cinematic shot of a cat astronaut walking on Mars"
                                value={rawIdea}
                                onChange={(e) => handleRawIdeaChange(e.target.value)}
                                disabled={isLoading || !canGenerate}
                                className="min-h-28"
                            />
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="grid gap-2">
                                <div className="flex items-center justify-between gap-3">
                                    <label className="text-sm font-semibold" htmlFor="video-duration">Video Length</label>
                                    <span className="text-sm text-muted-foreground tabular-nums">{durationSeconds}s</span>
                                </div>
                                <Slider
                                    id="video-duration"
                                    min={1}
                                    max={20}
                                    step={1}
                                    value={[durationSeconds]}
                                    onValueChange={(value) => setDurationSeconds(Math.min(20, Math.max(1, value[0] || 1)))}
                                    disabled={isLoading || !canGenerate}
                                />
                                <p className="text-xs text-muted-foreground">Drag to choose 1-20 seconds.</p>
                            </div>

                            <div className="grid gap-2">
                                <label className="text-sm font-semibold" htmlFor="video-format">Format</label>
                                <Select
                                    value={selectedFormat.value}
                                    onValueChange={(value) => setSelectedFormat(VIDEO_FORMAT_OPTIONS.find((option) => option.value === value) || VIDEO_FORMAT_OPTIONS[0])}
                                    disabled={isLoading || !canGenerate}
                                >
                                    <SelectTrigger id="video-format">
                                        <SelectValue placeholder="Select a format" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {VIDEO_FORMAT_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label} - {option.aspectRatio} - {option.resolution}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <Accordion type="single" collapsible className="rounded-md border px-4">
                            <AccordionItem value="advanced-video">
                                <AccordionTrigger>Advanced</AccordionTrigger>
                                <AccordionContent>
                                    <div className="grid gap-4">
                                        <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                                            <label className="text-sm font-semibold" htmlFor="improve-video-prompt">Improve video prompt</label>
                                            <Switch
                                                id="improve-video-prompt"
                                                checked={shouldImprovePrompt}
                                                onCheckedChange={setShouldImprovePrompt}
                                                disabled={isLoading || !canGenerate}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <label className="text-sm font-semibold" htmlFor="final-video-prompt">Improved Video Prompt</label>
                                            <Textarea
                                                id="final-video-prompt"
                                                value={finalPrompt}
                                                onChange={(e) => setFinalPrompt(e.target.value)}
                                                disabled={isLoading || !canGenerate}
                                                className="min-h-52 font-mono text-xs"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                {isImprovingPrompt ? 'Improving prompt in the background...' : shouldImprovePrompt ? 'AI improvement is enabled.' : 'AI improvement is off.'}
                                            </p>
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        <div className="flex items-center justify-end gap-4 flex-wrap">
                            <p className="text-sm text-muted-foreground">
                                {limitMessage()}
                            </p>
                            <Button 
                                onClick={handleGenerate} 
                                disabled={isLoading || !canGenerate || !rawIdea.trim() || !finalPrompt.trim()} 
                                className="md:w-48"
                            >
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clapperboard className="mr-2 h-4 w-4" />}
                                Generate
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold font-headline">Your Video Gallery</h2>
                    <p className="text-sm text-muted-foreground">Queued, processing, and completed videos appear here.</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border px-2.5 py-1">{videos.length} total</span>
                    {pendingVideoCount > 0 && <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-2.5 py-1 text-sky-600 dark:text-sky-300">{pendingVideoCount} generating</span>}
                    {failedVideoCount > 0 && <span className="rounded-full border border-rose-400/40 bg-rose-500/10 px-2.5 py-1 text-rose-600 dark:text-rose-300">{failedVideoCount} failed</span>}
                </div>
            </div>
            <VideoGallery videos={videos} />
        </div>
    )
}
