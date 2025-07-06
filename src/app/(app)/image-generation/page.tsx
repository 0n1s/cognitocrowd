
"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { generateAndSaveImage } from '@/lib/image-actions';
import { getUserData, getUserGeneratedImages, getPackage } from '@/lib/database';
import type { GeneratedImage, Package, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Wand2, Loader2, Download, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import NextImage from 'next/image';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Timestamp } from 'firebase/firestore';

function ImageGallery({ images }: { images: GeneratedImage[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);

    const openLightbox = (index: number) => {
        setCurrentIndex(index);
        setIsOpen(true);
    };

    const showNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    };

    const showPrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length);
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

    return (
        <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((image, index) => (
                    <Card key={image.id} className="group relative overflow-hidden" onClick={() => openLightbox(index)}>
                        <NextImage
                            src={image.thumbnailUrl}
                            alt={image.prompt}
                            width={400}
                            height={400}
                            className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                            <Button variant="secondary" size="icon" className="pointer-events-none">
                                <Eye className="h-5 w-5" />
                                <span className="sr-only">View Image</span>
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>
            
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-4xl p-4 sm:p-6">
                    {currentImage && (
                        <div className="flex flex-col gap-4">
                            <div className="relative aspect-square w-full">
                                {images.length > 1 && (
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
                                <Button asChild>
                                    <a href={currentImage.imageUrl} download={`trainly-image-${currentImage.id}.png`} target="_blank">
                                        <Download className="mr-2 h-4 w-4" />
                                        Download Full Resolution
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
    const [isPageLoading, setIsPageLoading] = useState(true);

    const [limit, setLimit] = useState(0);
    const [count, setCount] = useState(0);
    const [limitType, setLimitType] = useState<'daily' | 'lifetime'>('daily');

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
                }
            } else {
                setLimit(0);
                setCount(0);
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
            const result = await generateAndSaveImage(user.uid, prompt);
            if (result.success && result.image) {
                toast({ title: "Success!", description: "Your image has been generated." });
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
    
    const canGenerate = count < limit;

    const limitMessage = () => {
        if (limit === 0) {
            return "Your current package does not allow image generation.";
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
                <h1 className="text-3xl font-bold font-headline">AI Image Generation</h1>
                <p className="text-muted-foreground mt-1">
                    Describe any image you can imagine, and our AI will bring it to life.
                </p>
            </div>

            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <Input
                            placeholder="e.g., A photorealistic cat astronaut on Mars, high detail"
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

            <h2 className="text-2xl font-bold font-headline">Your Gallery</h2>
            <ImageGallery images={images} />
        </div>
    )
}
