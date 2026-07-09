
"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { generateAndSaveVideo } from '@/lib/user-api';
import { getUserData, getUserGeneratedVideos, getPackage } from '@/lib/database';
import type { GeneratedVideo, Package, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Wand2, Loader2, Download, Eye, ChevronLeft, ChevronRight, Video } from 'lucide-react';
import NextImage from 'next/image';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

function VideoGallery({ videos }: { videos: GeneratedVideo[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);

    const openLightbox = (index: number) => {
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {videos.map((video, index) => (
                    <Card key={video.id} className="group relative overflow-hidden" onClick={() => openLightbox(index)}>
                        <NextImage
                            src={video.thumbnailUrl}
                            alt={video.prompt}
                            width={400}
                            height={300}
                            className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4">
                            <Eye className="h-8 w-8 text-white" />
                            <p className="text-sm text-white mt-2 text-center line-clamp-2">{video.prompt}</p>
                        </div>
                    </Card>
                ))}
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
                                <video src={currentVideo.videoUrl} controls autoPlay className="w-full h-full rounded-md" />
                            </div>
                            
                            <div>
                                <h3 className="font-semibold text-center mb-2">Prompt</h3>
                                <p className="text-sm text-muted-foreground italic bg-muted p-3 rounded-md text-center">"{currentVideo.prompt}"</p>
                            </div>

                            <div className="flex justify-center">
                                <Button asChild>
                                    <a href={currentVideo.videoUrl} download={`trainly-video-${currentVideo.id}.mp4`} target="_blank">
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
    const [prompt, setPrompt] = useState("");
    const [videos, setVideos] = useState<GeneratedVideo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isPageLoading, setIsPageLoading] = useState(true);

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

    const handleGenerate = async () => {
        if (!user) {
            toast({ title: "Not Authenticated", variant: "destructive" });
            return;
        }
        if (!prompt) {
            toast({ title: "Prompt is empty", description: "Please enter a prompt to generate a video.", variant: "destructive" });
            return;
        }
        
        setIsLoading(true);
        try {
            const result = await generateAndSaveVideo(user.uid, prompt);
            if (result.success && result.video) {
                toast({ title: "Success!", description: "Your video has been generated." });
                setVideos(prev => [result.video!, ...prev]);
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
                    <div className="flex flex-col md:flex-row gap-4">
                        <Input
                            placeholder="e.g., A cinematic shot of a cat astronaut walking on Mars"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            disabled={isLoading || !canGenerate}
                        />
                        <Button 
                            onClick={handleGenerate} 
                            disabled={isLoading || !canGenerate} 
                            className="md:w-48"
                        >
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                            Generate
                        </Button>
                    </div>
                     <p className="text-sm text-muted-foreground mt-4">
                        {limitMessage()}
                    </p>
                </CardContent>
            </Card>

            <h2 className="text-2xl font-bold font-headline">Your Video Gallery</h2>
            <VideoGallery videos={videos} />
        </div>
    )
}
