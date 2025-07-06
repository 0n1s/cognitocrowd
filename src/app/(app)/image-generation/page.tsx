
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
import { Wand2, Loader2, Download, Eye } from 'lucide-react';
import NextImage from 'next/image';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Timestamp } from 'firebase/firestore';

function ImageGallery({ images }: { images: GeneratedImage[] }) {
    if (images.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-16 border-2 border-dashed rounded-lg">
                <p>You haven't generated any images yet.</p>
                <p>Your creations will appear here!</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map(image => (
                <Dialog key={image.id}>
                    <Card className="group relative overflow-hidden">
                        <DialogTrigger asChild>
                             <NextImage
                                src={image.thumbnailUrl}
                                alt={image.prompt}
                                width={400}
                                height={400}
                                className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                            />
                        </DialogTrigger>
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                           <DialogTrigger asChild>
                             <Button variant="secondary" size="icon">
                                 <Eye className="h-5 w-5" />
                                 <span className="sr-only">View Image</span>
                             </Button>
                           </DialogTrigger>
                        </div>
                    </Card>
                    <DialogContent className="max-w-3xl">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="relative aspect-square">
                                <NextImage
                                    src={image.imageUrl}
                                    alt={image.prompt}
                                    fill
                                    className="object-contain rounded-md"
                                />
                            </div>
                            <div className="flex flex-col">
                                <h3 className="font-semibold mb-2">Prompt:</h3>
                                <p className="text-muted-foreground italic bg-muted p-3 rounded-md mb-4 flex-grow">"{image.prompt}"</p>
                                <Button asChild>
                                    <a href={image.imageUrl} download={`trainly-image-${image.id}.png`} target="_blank">
                                        <Download className="mr-2 h-4 w-4" />
                                        Download Full Resolution
                                    </a>
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            ))}
        </div>
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
