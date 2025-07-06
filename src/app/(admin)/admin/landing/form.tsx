
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
import { Loader2, Wand2, Upload, Clipboard, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateAppSettings, updateLandingPageImage, generateLandingImage as generateImageAction, improveLandingPageText, improveImagePrompt } from "@/lib/actions";
import { getAppSettings } from "@/lib/database";
import { Separator } from "@/components/ui/separator";


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
    currentUrl?: string;
    targetWidth: number;
    targetHeight: number;
    onUrlChange: (field: keyof LandingPageContent, value: string) => void;
};

function ImageEditControl({ fieldKey, label, currentUrl, targetWidth, targetHeight, onUrlChange }: ImageEditControlProps) {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [prompt, setPrompt] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isImproving, setIsImproving] = useState(false);
    const [generatedPreviewUri, setGeneratedPreviewUri] = useState<string | null>(null);

    const isLoading = isUploading || isGenerating || isSaving || isImproving;

    const handleFileSelectAndUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setGeneratedPreviewUri(null);
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
            setIsUploading(false);
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

    const handleImprovePrompt = async () => {
        if (!prompt) return;
        setIsImproving(true);
        try {
            const result = await improveImagePrompt(prompt);
            if (result.success && result.improvedPrompt) {
                setPrompt(result.improvedPrompt);
                toast({ title: "Prompt Improved!", description: "The prompt has been enhanced by AI." });
            } else {
                 throw new Error(result.message || "Failed to improve prompt.");
            }
        } catch (error) {
             const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            toast({
                title: "Improvement Failed",
                variant: "destructive",
                duration: Infinity,
                description: (
                    <div className="w-full">
                        <p>The AI model returned an error.</p>
                        <pre className="mt-1 w-full rounded-md bg-destructive/20 p-2 font-mono text-sm text-destructive-foreground whitespace-pre-wrap">
                            {errorMessage}
                        </pre>
                    </div>
                )
            });
        } finally {
            setIsImproving(false);
        }
    }
    
    const handleGenerate = async () => {
        if (!prompt) {
            toast({ title: "Missing Prompt", description: "Please enter a prompt to generate an image.", variant: "destructive" });
            return;
        }
        setIsGenerating(true);
        setGeneratedPreviewUri(null);
        try {
            const genResult = await generateImageAction(prompt);
             if (!genResult.success || !genResult.imageDataUri) {
                throw new Error(genResult.message || "AI generation failed.");
            }
            setGeneratedPreviewUri(genResult.imageDataUri);
            toast({ title: "Image Generated", description: "Preview the image below and click 'Save' to apply it." });
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
            setIsGenerating(false);
        }
    };

    const handleSaveGenerated = async () => {
        if (!generatedPreviewUri) return;
        setIsSaving(true);
        try {
            const compressedUri = await compressAndResizeImage(generatedPreviewUri, targetWidth, targetHeight);
            const uploadResult = await updateLandingPageImage(String(fieldKey), compressedUri);
            
            if (uploadResult.success && uploadResult.url) {
                onUrlChange(fieldKey, uploadResult.url);
                toast({ title: "Success", description: "Image generated and updated." });
                setGeneratedPreviewUri(null);
            } else {
                 throw new Error(uploadResult.message || "Failed to save generated image.");
            }
        } catch (error) {
             const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            toast({
                title: "Save Failed",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="grid md:grid-cols-3 gap-6 items-start">
            <div className="md:col-span-1">
                <Label>{label}</Label>
                <div className="relative mt-2 aspect-video rounded-md overflow-hidden border">
                    <NextImage src={generatedPreviewUri || currentUrl || `https://placehold.co/${targetWidth}x${targetHeight}.png`} alt={label} width={targetWidth} height={targetHeight} className="object-cover w-full h-full" />
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
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full" disabled={isUploading}>
                           <Upload className="mr-2 h-4 w-4" /> Choose File
                        </Button>
                    </TabsContent>
                    <TabsContent value="ai" className="mt-4">
                         <Label>Generate with AI</Label>
                         <p className="text-xs text-muted-foreground mb-2">Describe the image you want to create, or improve an existing prompt.</p>
                         <div className="flex gap-2">
                             <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g., a person at a computer" disabled={isLoading} />
                             <Button variant="outline" size="sm" onClick={handleImprovePrompt} disabled={isLoading || !prompt}>
                                {isImproving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                                Improve
                             </Button>
                         </div>
                         <div className="flex gap-2 mt-2">
                            <Button onClick={handleGenerate} disabled={isLoading || !prompt} className="flex-1">
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                Generate
                            </Button>
                            {generatedPreviewUri && (
                                <Button onClick={handleSaveGenerated} disabled={isLoading} className="flex-1">
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Save Image
                                </Button>
                            )}
                         </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

type TextInputWithAIProps = {
    id: string;
    label: string;
    value: string;
    context: string;
    onChange: (value: string) => void;
    isTextarea?: boolean;
    disabled?: boolean;
};

function TextInputWithAI({ id, label, value, context, onChange, isTextarea = false, disabled = false }: TextInputWithAIProps) {
    const { toast } = useToast();
    const [isImproving, setIsImproving] = useState(false);

    const handleCopyError = (text: string) => {
        navigator.clipboard.writeText(text).then(
            () => toast({ title: "Copied!", description: "Error details have been copied to your clipboard." }),
            () => toast({ title: "Copy Failed", description: "Could not copy error to clipboard.", variant: "destructive" })
        );
    };

    const handleImprove = async () => {
        if (!value) {
            toast({ title: "No text to improve", description: "Please enter some text first.", variant: "destructive" });
            return;
        }
        setIsImproving(true);
        try {
            const result = await improveLandingPageText(value, context);
            if (result.success && result.improvedText) {
                onChange(result.improvedText);
                toast({ title: "Success", description: "Text has been improved by AI." });
            } else {
                throw new Error(result.message || "Failed to improve text.");
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            toast({
                title: "Improvement Failed",
                variant: "destructive",
                duration: Infinity,
                description: (
                    <div className="w-full">
                        <div className="flex justify-start items-center gap-4 mb-2">
                            <Button variant="ghost" size="sm" onClick={() => handleCopyError(errorMessage)}>
                                <Clipboard className="mr-2 h-4 w-4" /> Copy
                            </Button>
                            <p>The AI model returned an error.</p>
                        </div>
                        <pre className="mt-1 w-full rounded-md bg-destructive/20 p-2 font-mono text-sm text-destructive-foreground whitespace-pre-wrap">
                            {errorMessage}
                        </pre>
                    </div>
                )
            });
        } finally {
            setIsImproving(false);
        }
    };

    const InputComponent = isTextarea ? Textarea : Input;

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <Label htmlFor={id}>{label}</Label>
                <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={handleImprove} 
                    disabled={disabled || isImproving || !value}
                >
                    {isImproving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                    Improve
                </Button>
            </div>
            <InputComponent 
                id={id} 
                value={value} 
                onChange={(e) => onChange(e.target.value)} 
                disabled={disabled || isImproving}
            />
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
                            <TextInputWithAI
                                id="heroTitle"
                                label="Title"
                                value={content.heroTitle}
                                onChange={value => handleContentChange('landingPageContent.heroTitle', value)}
                                context="Hero section title"
                            />
                             <TextInputWithAI
                                id="heroSubtitle"
                                label="Subtitle"
                                value={content.heroSubtitle}
                                onChange={value => handleContentChange('landingPageContent.heroSubtitle', value)}
                                context="Hero section subtitle"
                                isTextarea
                            />
                            <TextInputWithAI
                                id="heroCtaButton"
                                label="Button Text"
                                value={content.heroCtaButton}
                                onChange={value => handleContentChange('landingPageContent.heroCtaButton', value)}
                                context="Call to action button text"
                            />
                        </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="item-2">
                         <AccordionTrigger className="text-lg font-semibold">Platform Features Section</AccordionTrigger>
                        <AccordionContent className="space-y-6 pt-4">
                            <TextInputWithAI
                                id="platformTitle"
                                label="Title"
                                value={content.platformTitle}
                                onChange={value => handleContentChange('landingPageContent.platformTitle', value)}
                                context="Platform features section title"
                            />
                            <TextInputWithAI
                                id="platformSubtitle"
                                label="Subtitle"
                                value={content.platformSubtitle}
                                onChange={value => handleContentChange('landingPageContent.platformSubtitle', value)}
                                context="Platform features section subtitle"
                                isTextarea
                            />
                            {content.featureItems.map((item, index) => (
                                <div key={index} className="p-4 border rounded-lg space-y-4">
                                    <TextInputWithAI
                                        id={`feature-${index}-title`}
                                        label={`Feature ${index+1} Title`}
                                        value={item.title}
                                        onChange={value => handleContentChange(`landingPageContent.featureItems.${index}.title`, value)}
                                        context="Feature item title"
                                    />
                                    <TextInputWithAI
                                        id={`feature-${index}-desc`}
                                        label={`Feature ${index+1} Description`}
                                        value={item.description}
                                        onChange={value => handleContentChange(`landingPageContent.featureItems.${index}.description`, value)}
                                        context="Feature item description"
                                        isTextarea
                                    />
                                </div>
                            ))}
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-3">
                         <AccordionTrigger className="text-lg font-semibold">"Why Us" Section</AccordionTrigger>
                        <AccordionContent className="space-y-6 pt-4">
                             <TextInputWithAI
                                id="whyUsTitle"
                                label="Title"
                                value={content.whyUsTitle}
                                onChange={value => handleContentChange('landingPageContent.whyUsTitle', value)}
                                context="'Why Us' section title"
                            />
                            <TextInputWithAI
                                id="whyUsSubtitle"
                                label="Subtitle"
                                value={content.whyUsSubtitle}
                                onChange={value => handleContentChange('landingPageContent.whyUsSubtitle', value)}
                                context="'Why Us' section subtitle"
                                isTextarea
                            />
                            {content.whyUsItems.map((item, index) => (
                                <div key={index} className="p-4 border rounded-lg space-y-4">
                                     <TextInputWithAI
                                        id={`whyus-${index}-title`}
                                        label={`Item ${index+1} Title`}
                                        value={item.title}
                                        onChange={value => handleContentChange(`landingPageContent.whyUsItems.${index}.title`, value)}
                                        context="'Why Us' item title"
                                    />
                                    <TextInputWithAI
                                        id={`whyus-${index}-desc`}
                                        label={`Item ${index+1} Description`}
                                        value={item.description}
                                        onChange={value => handleContentChange(`landingPageContent.whyUsItems.${index}.description`, value)}
                                        context="'Why Us' item description"
                                        isTextarea
                                    />
                                </div>
                            ))}
                        </AccordionContent>
                    </AccordionItem>
                    
                     <AccordionItem value="item-4">
                         <AccordionTrigger className="text-lg font-semibold">Testimonials Section</AccordionTrigger>
                        <AccordionContent className="space-y-6 pt-4">
                            <TextInputWithAI
                                id="testimonialsTitle"
                                label="Title"
                                value={content.testimonialsTitle}
                                onChange={value => handleContentChange('landingPageContent.testimonialsTitle', value)}
                                context="Testimonials section title"
                            />
                            <TextInputWithAI
                                id="testimonialsSubtitle"
                                label="Subtitle"
                                value={content.testimonialsSubtitle}
                                onChange={value => handleContentChange('landingPageContent.testimonialsSubtitle', value)}
                                context="Testimonials section subtitle"
                                isTextarea
                            />
                            {content.testimonials.map((item, index) => (
                                <div key={index} className="p-4 border rounded-lg space-y-4">
                                    <TextInputWithAI
                                        id={`testimonial-${index}-name`}
                                        label={`Testimonial ${index+1} Name`}
                                        value={item.name}
                                        onChange={value => handleContentChange(`landingPageContent.testimonials.${index}.name`, value)}
                                        context="Testimonial author name"
                                    />
                                     <TextInputWithAI
                                        id={`testimonial-${index}-role`}
                                        label={`Testimonial ${index+1} Role`}
                                        value={item.role}
                                        onChange={value => handleContentChange(`landingPageContent.testimonials.${index}.role`, value)}
                                        context="Testimonial author role"
                                    />
                                     <TextInputWithAI
                                        id={`testimonial-${index}-quote`}
                                        label={`Testimonial ${index+1} Quote`}
                                        value={item.quote}
                                        onChange={value => handleContentChange(`landingPageContent.testimonials.${index}.quote`, value)}
                                        context="Testimonial quote"
                                        isTextarea
                                    />
                                </div>
                            ))}
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-process">
                        <AccordionTrigger className="text-lg font-semibold">Process Section</AccordionTrigger>
                        <AccordionContent className="space-y-6 pt-4">
                            <TextInputWithAI
                                id="processTitle"
                                label="Title"
                                value={content.processTitle}
                                onChange={value => handleContentChange('landingPageContent.processTitle', value)}
                                context="Process section title"
                            />
                            <TextInputWithAI
                                id="processSubtitle"
                                label="Subtitle"
                                value={content.processSubtitle}
                                onChange={value => handleContentChange('landingPageContent.processSubtitle', value)}
                                context="Process section subtitle"
                                isTextarea
                            />
                            {content.processSteps.map((item, index) => (
                                <div key={index} className="p-4 border rounded-lg space-y-4">
                                    <TextInputWithAI
                                        id={`process-step-${index}-title`}
                                        label={`Step ${index + 1} Title`}
                                        value={item.title}
                                        onChange={value => handleContentChange(`landingPageContent.processSteps.${index}.title`, value)}
                                        context="Process step title"
                                    />
                                    <TextInputWithAI
                                        id={`process-step-${index}-desc`}
                                        label={`Step ${index + 1} Description`}
                                        value={item.description}
                                        onChange={value => handleContentChange(`landingPageContent.processSteps.${index}.description`, value)}
                                        context="Process step description"
                                        isTextarea
                                    />
                                </div>
                            ))}
                            <Separator />
                            <ImageEditControl
                                fieldKey="processImage1"
                                label="Process Step 1 Image"
                                currentUrl={content.processImage1 || undefined}
                                targetWidth={800}
                                targetHeight={600}
                                onUrlChange={handleUrlChange}
                            />
                            <ImageEditControl
                                fieldKey="processImage2"
                                label="Process Step 2 Image"
                                currentUrl={content.processImage2 || undefined}
                                targetWidth={800}
                                targetHeight={600}
                                onUrlChange={handleUrlChange}
                            />
                            <ImageEditControl
                                fieldKey="processImage3"
                                label="Process Step 3 Image"
                                currentUrl={content.processImage3 || undefined}
                                targetWidth={800}
                                targetHeight={600}
                                onUrlChange={handleUrlChange}
                            />
                        </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="item-hiring">
                        <AccordionTrigger className="text-lg font-semibold">Hiring Section</AccordionTrigger>
                        <AccordionContent className="space-y-6 pt-4">
                            <TextInputWithAI
                                id="hiringTitle"
                                label="Title"
                                value={content.hiringTitle}
                                onChange={value => handleContentChange('landingPageContent.hiringTitle', value)}
                                context="Hiring section title"
                            />
                            <TextInputWithAI
                                id="hiringSubtitle"
                                label="Subtitle"
                                value={content.hiringSubtitle}
                                onChange={value => handleContentChange('landingPageContent.hiringSubtitle', value)}
                                context="Hiring section subtitle"
                                isTextarea
                            />
                            <Separator />
                            <ImageEditControl
                                fieldKey="hiringBackgroundImage"
                                label="Hiring Section Background"
                                currentUrl={content.hiringBackgroundImage || undefined}
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
