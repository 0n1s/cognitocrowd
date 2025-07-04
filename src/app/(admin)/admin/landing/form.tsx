
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { AppSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateAppSettings } from "@/lib/actions";
import { getAppSettings } from "@/lib/database";

const LoadingSkeleton = () => (
    <Card>
        <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-8">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="grid md:grid-cols-3 gap-6 items-start">
                    <div className="md:col-span-1">
                        <Skeleton className="h-28 w-full rounded-md" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </div>
            ))}
        </CardContent>
        <CardFooter>
            <Skeleton className="h-10 w-32" />
        </CardFooter>
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

    const handleImageChange = (field: keyof NonNullable<AppSettings['landingPageContent']>, value: string) => {
        if (!settings) return;
        setSettings({
            ...settings,
            landingPageContent: {
                ...settings.landingPageContent,
                [field]: value,
            },
        });
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
    if (!settings) return <p>Could not load settings.</p>;
    
    const content = settings.landingPageContent;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Page Images</CardTitle>
                <CardDescription>Enter the URLs for the images on the landing page. Ensure they are optimized for the web.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {/* Process Image 1 */}
                <div className="grid md:grid-cols-3 gap-6 items-start">
                    <div className="md:col-span-1">
                        <Label>Process Step 1 Image</Label>
                        <Image src={content?.processImage1 || 'https://placehold.co/800x600.png'} alt="Process Step 1" width={800} height={600} className="rounded-md mt-2 aspect-video object-cover" />
                    </div>
                    <div className="md:col-span-2">
                         <Label htmlFor="processImage1">Image URL</Label>
                        <Input id="processImage1" value={content?.processImage1 || ''} onChange={(e) => handleImageChange('processImage1', e.target.value)} placeholder="https://..." />
                    </div>
                </div>

                 {/* Process Image 2 */}
                <div className="grid md:grid-cols-3 gap-6 items-start">
                    <div className="md:col-span-1">
                        <Label>Process Step 2 Image</Label>
                        <Image src={content?.processImage2 || 'https://placehold.co/800x600.png'} alt="Process Step 2" width={800} height={600} className="rounded-md mt-2 aspect-video object-cover" />
                    </div>
                    <div className="md:col-span-2">
                        <Label htmlFor="processImage2">Image URL</Label>
                        <Input id="processImage2" value={content?.processImage2 || ''} onChange={(e) => handleImageChange('processImage2', e.target.value)} placeholder="https://..." />
                    </div>
                </div>

                 {/* Process Image 3 */}
                <div className="grid md:grid-cols-3 gap-6 items-start">
                    <div className="md:col-span-1">
                        <Label>Process Step 3 Image</Label>
                        <Image src={content?.processImage3 || 'https://placehold.co/800x600.png'} alt="Process Step 3" width={800} height={600} className="rounded-md mt-2 aspect-video object-cover" />
                    </div>
                    <div className="md:col-span-2">
                        <Label htmlFor="processImage3">Image URL</Label>
                        <Input id="processImage3" value={content?.processImage3 || ''} onChange={(e) => handleImageChange('processImage3', e.target.value)} placeholder="https://..." />
                    </div>
                </div>
                
                 {/* Hiring Background Image */}
                <div className="grid md:grid-cols-3 gap-6 items-start">
                    <div className="md:col-span-1">
                        <Label>Hiring Section Background</Label>
                        <Image src={content?.hiringBackgroundImage || 'https://placehold.co/1920x1080.png'} alt="Hiring Background" width={1920} height={1080} className="rounded-md mt-2 aspect-video object-cover" />
                    </div>
                    <div className="md:col-span-2">
                        <Label htmlFor="hiringBackgroundImage">Image URL</Label>
                        <Input id="hiringBackgroundImage" value={content?.hiringBackgroundImage || ''} onChange={(e) => handleImageChange('hiringBackgroundImage', e.target.value)} placeholder="https://..." />
                    </div>
                </div>

            </CardContent>
            <CardFooter>
                 <Button onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </CardFooter>
        </Card>
    );
}
