
"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { AppSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Wand2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateAppSettings, updateLandingPageImage, generateLandingImage as generateImageAction } from "@/lib/actions";
import { getAppSettings } from "@/lib/database";
import { cn } from "@/lib/utils";


const compressAndResizeImage = (
    fileOrDataUrl: File | string, 
    targetWidth: number, 
    targetHeight: number
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Failed to get canvas context.'));
            }
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
            resolve(canvas.toDataURL('image/jpeg', 0.8)); // 80% quality JPEG
        };
        img.onerror = reject;
        if (typeof fileOrDataUrl === 'string') {
            img.src = fileOrDataUrl;
        } else {
            img.src = URL.createObjectURL(fileOrDataUrl);
        }
    });
};

type ImageEditControlProps = {
    fieldKey: keyof NonNullable<AppSettings['landingPageContent']>;
    label: string;
    currentUrl: string;
    targetWidth: number;
    targetHeight: number;
    onUrlChange: (field: keyof NonNullable<AppSettings['landingPageContent']>, value: string) => void;
};

function ImageEditControl({ fieldKey, label, currentUrl, targetWidth, targetHeight, onUrlChange }: ImageEditControlProps) {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [prompt, setPrompt] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleFileSelectAndUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        try {
            const compressedUri = await compressAndResizeImage(file, targetWidth, targetHeight);
            const result = await updateLandingPageImage(fieldKey, compressedUri);
            if (result.success && result.url) {
                onUrlChange(fieldKey, result.url);
                toast({ title: "Success", description: "Image uploaded and updated." });
            } else {
                throw new Error(result.message || "Upload failed.");
            }
        } catch (error) {
            toast({ title: "Error", description: error instanceof Error ? error.message : "Could not process image.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleGenerate = async () => {
        if (!prompt) {
            toast({ title: "Missing Prompt", description: "Please enter a prompt to generate an image.", variant: "destructive" });
            return;
        }
        setIsLoading(true);
        try {
            const genResult = await generateImageAction(prompt);
             if (!genResult.success || !genResult.imageDataUri) {
                throw new Error(genResult.message || "AI generation failed.");
            }
            
            const compressedUri = await compressAndResizeImage(genResult.imageDataUri, targetWidth, targetHeight);
            const uploadResult = await updateLandingPageImage(fieldKey, compressedUri);
            
            if (uploadResult.success && uploadResult.url) {
                onUrlChange(fieldKey, uploadResult.url);
                toast({ title: "Success", description: "Image generated and updated." });
            } else {
                 throw new Error(uploadResult.message || "Failed to save generated image.");
            }
        } catch (error) {
            toast({ title: "Error", description: error instanceof Error ? error.message : "An error occurred.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="grid md:grid-cols-3 gap-6 items-start">
            <div className="md:col-span-1">
                <Label>{label}</Label>
                <div className="relative mt-2 aspect-video rounded-md overflow-hidden border">
                    <Image src={currentUrl || `https://placehold.co/${targetWidth}x${targetHeight}.png`} alt={label} width={targetWidth} height={targetHeight} className="object-cover w-full h-full" />
                    {isLoading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>}
                </div>
            </div>
            <div className="md:col-span-2">
                <Tabs defaultValue="url" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="url">URL</TabsTrigger>
                        <TabsTrigger value="upload" disabled={isLoading}>Upload</TabsTrigger>
                        <TabsTrigger value="ai" disabled={isLoading}>Generate AI</TabsTrigger>
                    </TabsList>
                    <TabsContent value="url" className="mt-4">
                        <Label htmlFor={fieldKey}>Image URL</Label>
                        <Input id={fieldKey} value={currentUrl || ''} onChange={(e) => onUrlChange(fieldKey, e.target.value)} placeholder="https://..." disabled={isLoading} />
                    </TabsContent>
                    <TabsContent value="upload" className="mt-4">
                        <Label>Upload Image</Label>
                        <p className="text-xs text-muted-foreground mb-2">Image will be resized to {targetWidth}x{targetHeight} and compressed.</p>
                        <Input type="file" ref={fileInputRef} onChange={handleFileSelectAndUpload} className="hidden" accept="image/*" />
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full" disabled={isLoading}>
                           <Upload className="mr-2 h-4 w-4" /> Choose File
                        </Button>
                    </TabsContent>
                    <TabsContent value="ai" className="mt-4">
                         <Label>Generate with AI</Label>
                         <p className="text-xs text-muted-foreground mb-2">Describe the image you want to create.</p>
                         <div className="flex gap-2">
                             <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g., a person at a computer" disabled={isLoading} />
                             <Button onClick={handleGenerate} disabled={isLoading}>
                                <Wand2 className="mr-2 h-4 w-4" /> Generate
                            </Button>
                         </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

const LoadingSkeleton = () => (
    <Card>
        <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-8">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="grid md:grid-cols-3 gap-6 items-start">
                    <div className="md:col-span-1 space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-28 w-full rounded-md" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </div>
            ))}
        </CardContent>
    </Card>
);


export function LandingPageForm() {
    const { toast } = useToast();
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);

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

    const handleUrlChange = (field: keyof NonNullable<AppSettings['landingPageContent']>, value: string) => {
        if (!settings) return;
        const newSettings = {
            ...settings,
            landingPageContent: {
                ...settings.landingPageContent,
                [field]: value,
            },
        };
        setSettings(newSettings);
        // Also save the URL change immediately
        updateAppSettings(newSettings);
    };

    if (loading) return <LoadingSkeleton />;
    if (!settings) return <p>Could not load settings.</p>;
    
    const content = settings.landingPageContent;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Page Images</CardTitle>
                <CardDescription>Manage the images on the landing page. You can paste a URL, upload a file, or generate one with AI.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                 <ImageEditControl
                    fieldKey="processImage1"
                    label="Process Step 1 Image"
                    currentUrl={content?.processImage1 || ''}
                    targetWidth={800}
                    targetHeight={600}
                    onUrlChange={handleUrlChange}
                />
                 <ImageEditControl
                    fieldKey="processImage2"
                    label="Process Step 2 Image"
                    currentUrl={content?.processImage2 || ''}
                    targetWidth={800}
                    targetHeight={600}
                    onUrlChange={handleUrlChange}
                />
                 <ImageEditControl
                    fieldKey="processImage3"
                    label="Process Step 3 Image"
                    currentUrl={content?.processImage3 || ''}
                    targetWidth={800}
                    targetHeight={600}
                    onUrlChange={handleUrlChange}
                />
                <ImageEditControl
                    fieldKey="hiringBackgroundImage"
                    label="Hiring Section Background"
                    currentUrl={content?.hiringBackgroundImage || ''}
                    targetWidth={1920}
                    targetHeight={1080}
                    onUrlChange={handleUrlChange}
                />
            </CardContent>
        </Card>
    );
}
