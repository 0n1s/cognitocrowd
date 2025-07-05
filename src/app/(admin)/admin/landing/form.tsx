
"use client";

import { useState, useEffect, useRef } from "react";
import NextImage from "next/image";
import { AppSettings, LandingPageContent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Wand2, Upload, Clipboard, Trash2 } from "lucide-react";
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
    fieldKey: keyof LandingPageContent;
    label: string;
    currentUrl: string;
    targetWidth: number;
    targetHeight: number;
    onUrlChange: (field: keyof LandingPageContent, value: string) => void;
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
            const result = await updateLandingPageImage(String(fieldKey), compressedUri);
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
    
    const handleCopyError = (text: string) => {
        navigator.clipboard.writeText(text).then(
            () => {
                toast({
                    title: "Copied!",
                    description: "Error details have been copied to your clipboard.",
                });
            },
            (err) => {
                toast({
                    title: "Copy Failed",
                    description: "Could not copy error to clipboard.",
                    variant: "destructive",
                });
                console.error("Failed to copy text: ", err);
            }
        );
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
            const uploadResult = await updateLandingPageImage(String(fieldKey), compressedUri);
            
            if (uploadResult.success && uploadResult.url) {
                onUrlChange(fieldKey, uploadResult.url);
                toast({ title: "Success", description: "Image generated and updated." });
            } else {
                 throw new Error(uploadResult.message || "Failed to save generated image.");
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            toast({
                title: "Generation Failed",
                variant: "destructive",
                duration: Infinity,
                description: (
                    <div className="w-full">
                        <div className="flex justify-start items-center gap-4 mb-2">
                            <Button variant="ghost" size="sm" onClick={() => handleCopyError(errorMessage)}>
                                <Clipboard className="mr-2 h-4 w-4" /> Copy
                            </Button>
                            <p>The AI model returned an error:</p>
                        </div>
                        <pre className="mt-1 w-full rounded-md bg-destructive/20 p-2 font-mono text-sm text-destructive-foreground whitespace-pre-wrap">
                            {errorMessage}
                        </pre>
                    </div>
                )
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="grid md:grid-cols-3 gap-6 items-start">
            <div className="md:col-span-1">
                <Label>{label}</Label>
                <div className="relative mt-2 aspect-video rounded-md overflow-hidden border">
                    <NextImage src={currentUrl || `https://placehold.co/${targetWidth}x${targetHeight}.png`} alt={label} width={targetWidth} height={targetHeight} className="object-cover w-full h-full" />
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
                        <Label htmlFor={String(fieldKey)}>Image URL</Label>
                        <Input id={String(fieldKey)} value={currentUrl || ''} onChange={(e) => onUrlChange(fieldKey, e.target.value)} placeholder="https://..." disabled={isLoading} />
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
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-48 w-full" />
             <Skeleton className="h-48 w-full" />
        </CardContent>
    </Card>
);

export function LandingPageForm() {
    const { toast } = useToast();
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
    
    const handleContentChange = (path: string, value: any) => {
        setSettings(prevSettings => {
            if (!prevSettings) return null;

            const newSettings = JSON.parse(JSON.stringify(prevSettings));
            const keys = path.split('.');
            let current = newSettings;
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
            return newSettings;
        });
    };

    const handleUrlChange = (field: keyof LandingPageContent, value: string) => {
        handleContentChange(`landingPageContent.${field}`, value)
    };
    
    const handleSubmit = async () => {
        if (!settings) return;
        setIsSubmitting(true);
        const result = await updateAppSettings(settings);
        if (result.success) {
            toast({ title: "Success", description: result.message });
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setIsSubmitting(false);
    };

    if (loading) return <LoadingSkeleton />;
    if (!settings?.landingPageContent) return <p>Could not load settings.</p>;
    
    const content = settings.landingPageContent;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Landing Page Content</CardTitle>
                <CardDescription>Manage the content and images on the landing page.</CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="multiple" defaultValue={['item-1']} className="w-full">
                    <AccordionItem value="item-1">
                        <AccordionTrigger className="text-lg font-semibold">Hero Section</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="heroTitle">Title</Label>
                                <Input id="heroTitle" value={content.heroTitle} onChange={e => handleContentChange('landingPageContent.heroTitle', e.target.value)} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="heroSubtitle">Subtitle</Label>
                                <Textarea id="heroSubtitle" value={content.heroSubtitle} onChange={e => handleContentChange('landingPageContent.heroSubtitle', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="heroCtaButton">Button Text</Label>
                                <Input id="heroCtaButton" value={content.heroCtaButton} onChange={e => handleContentChange('landingPageContent.heroCtaButton', e.target.value)} />
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="item-2">
                         <AccordionTrigger className="text-lg font-semibold">Platform Features Section</AccordionTrigger>
                        <AccordionContent className="space-y-6 pt-4">
                             <div className="space-y-2">
                                <Label>Title</Label>
                                <Input value={content.platformTitle} onChange={e => handleContentChange('landingPageContent.platformTitle', e.target.value)} />
                            </div>
                             <div className="space-y-2">
                                <Label>Subtitle</Label>
                                <Textarea value={content.platformSubtitle} onChange={e => handleContentChange('landingPageContent.platformSubtitle', e.target.value)} />
                            </div>
                            {content.featureItems.map((item, index) => (
                                <div key={index} className="p-4 border rounded-lg space-y-2">
                                    <Label>Feature {index+1} Title</Label>
                                    <Input value={item.title} onChange={e => handleContentChange(`landingPageContent.featureItems.${index}.title`, e.target.value)} />
                                    <Label>Feature {index+1} Description</Label>
                                    <Textarea value={item.description} onChange={e => handleContentChange(`landingPageContent.featureItems.${index}.description`, e.target.value)} />
                                </div>
                            ))}
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-3">
                         <AccordionTrigger className="text-lg font-semibold">"Why Us" Section</AccordionTrigger>
                        <AccordionContent className="space-y-6 pt-4">
                             <div className="space-y-2">
                                <Label>Title</Label>
                                <Input value={content.whyUsTitle} onChange={e => handleContentChange('landingPageContent.whyUsTitle', e.target.value)} />
                            </div>
                             <div className="space-y-2">
                                <Label>Subtitle</Label>
                                <Textarea value={content.whyUsSubtitle} onChange={e => handleContentChange('landingPageContent.whyUsSubtitle', e.target.value)} />
                            </div>
                            {content.whyUsItems.map((item, index) => (
                                <div key={index} className="p-4 border rounded-lg space-y-2">
                                    <Label>Item {index+1} Title</Label>
                                    <Input value={item.title} onChange={e => handleContentChange(`landingPageContent.whyUsItems.${index}.title`, e.target.value)} />
                                    <Label>Item {index+1} Description</Label>
                                    <Textarea value={item.description} onChange={e => handleContentChange(`landingPageContent.whyUsItems.${index}.description`, e.target.value)} />
                                </div>
                            ))}
                        </AccordionContent>
                    </AccordionItem>
                    
                     <AccordionItem value="item-4">
                         <AccordionTrigger className="text-lg font-semibold">Testimonials Section</AccordionTrigger>
                        <AccordionContent className="space-y-6 pt-4">
                             <div className="space-y-2">
                                <Label>Title</Label>
                                <Input value={content.testimonialsTitle} onChange={e => handleContentChange('landingPageContent.testimonialsTitle', e.target.value)} />
                            </div>
                             <div className="space-y-2">
                                <Label>Subtitle</Label>
                                <Textarea value={content.testimonialsSubtitle} onChange={e => handleContentChange('landingPageContent.testimonialsSubtitle', e.target.value)} />
                            </div>
                            {content.testimonials.map((item, index) => (
                                <div key={index} className="p-4 border rounded-lg space-y-2">
                                    <Label>Testimonial {index+1} Name</Label>
                                    <Input value={item.name} onChange={e => handleContentChange(`landingPageContent.testimonials.${index}.name`, e.target.value)} />
                                     <Label>Testimonial {index+1} Role</Label>
                                    <Input value={item.role} onChange={e => handleContentChange(`landingPageContent.testimonials.${index}.role`, e.target.value)} />
                                    <Label>Testimonial {index+1} Quote</Label>
                                    <Textarea value={item.quote} onChange={e => handleContentChange(`landingPageContent.testimonials.${index}.quote`, e.target.value)} />
                                </div>
                            ))}
                        </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="item-5">
                        <AccordionTrigger className="text-lg font-semibold">Page Images</AccordionTrigger>
                        <AccordionContent className="space-y-8 pt-6">
                            <ImageEditControl
                                fieldKey="processImage1"
                                label="Process Step 1 Image"
                                currentUrl={content.processImage1 || ''}
                                targetWidth={800}
                                targetHeight={600}
                                onUrlChange={handleUrlChange}
                            />
                            <ImageEditControl
                                fieldKey="processImage2"
                                label="Process Step 2 Image"
                                currentUrl={content.processImage2 || ''}
                                targetWidth={800}
                                targetHeight={600}
                                onUrlChange={handleUrlChange}
                            />
                            <ImageEditControl
                                fieldKey="processImage3"
                                label="Process Step 3 Image"
                                currentUrl={content.processImage3 || ''}
                                targetWidth={800}
                                targetHeight={600}
                                onUrlChange={handleUrlChange}
                            />
                            <ImageEditControl
                                fieldKey="hiringBackgroundImage"
                                label="Hiring Section Background"
                                currentUrl={content.hiringBackgroundImage || ''}
                                targetWidth={1920}
                                targetHeight={1080}
                                onUrlChange={handleUrlChange}
                            />
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
             <CardFooter className="border-t pt-6">
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save All Changes
                </Button>
            </CardFooter>
        </Card>
    );
}
