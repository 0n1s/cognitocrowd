
"use client";

import { useState } from 'react';
import { AppSettings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from '@/components/ui/carousel';
import { X, CheckCircle, Rocket, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { markOnboardingAsCompleted } from '@/lib/actions';
import { useRouter } from 'next/navigation';

export function OnboardingCourseCard({ settings }: { settings: AppSettings }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [api, setApi] = useState<CarouselApi>()
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [showCard, setShowCard] = useState(true);
    const [isCompleting, setIsCompleting] = useState(false);

    const handleComplete = async () => {
        if (!user) return;
        setIsCompleting(true);
        const result = await markOnboardingAsCompleted(user.uid);
        if (result.success) {
            toast({
                title: 'Course Completed!',
                description: "You're all set to start contributing.",
                duration: 3000
            });
            setIsDialogOpen(false);
            setShowCard(false); // Hide card optimistically
            router.refresh(); // Refresh server state
        } else {
            toast({ title: 'Error', description: result.message, variant: 'destructive' });
        }
        setIsCompleting(false);
    };

    if (!showCard) return null;

    const totalSteps = (settings.onboardingCourseSteps?.length || 0) + 1;

    return (
        <>
            <Card className="bg-gradient-to-br from-primary/10 to-background border-primary/20 relative animate-in fade-in-50">
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => setShowCard(false)}>
                    <X className="h-4 w-4" />
                    <span className="sr-only">Dismiss</span>
                </Button>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/20 rounded-full border border-primary/30">
                            <Rocket className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle>{settings.onboardingCourseTitle || 'Welcome!'}</CardTitle>
                            <CardDescription>{settings.onboardingCourseDescription || 'Learn the ropes.'}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardFooter>
                    <Button onClick={() => setIsDialogOpen(true)}>Get Started</Button>
                </CardFooter>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{settings.onboardingCourseTitle}</DialogTitle>
                        <DialogDescription>
                            Follow these steps to get familiar with the platform.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="relative px-8 sm:px-12 py-4">
                        <Carousel className="w-full" setApi={setApi}>
                            <CarouselContent>
                                {(settings.onboardingCourseSteps || []).map((step, index) => (
                                    <CarouselItem key={step.id}>
                                        <div className="p-1">
                                            <div className="p-6 border rounded-lg h-56 flex flex-col justify-center">
                                                <h3 className="text-lg font-semibold mb-2">Step {index + 1}: {step.title.replace(/^Step \d+: /i, '')}</h3>
                                                <p className="text-muted-foreground">{step.content}</p>
                                            </div>
                                        </div>
                                    </CarouselItem>
                                ))}
                                <CarouselItem>
                                    <div className="p-1">
                                        <div className="p-6 border rounded-lg h-56 flex flex-col justify-center items-center text-center">
                                            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                                            <h3 className="text-lg font-semibold">You're All Set!</h3>
                                            <p className="text-muted-foreground mt-2">Click below to complete the onboarding and start your journey.</p>
                                            <Button className="mt-4" onClick={handleComplete} disabled={isCompleting}>
                                                {isCompleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Complete Onboarding
                                            </Button>
                                        </div>
                                    </div>
                                </CarouselItem>
                            </CarouselContent>
                            <CarouselPrevious />
                            <CarouselNext />
                        </Carousel>
                    </div>
                    <div className="flex justify-center mt-2">
                        <p className="text-sm text-muted-foreground">
                            Step {api?.selectedScrollSnap() ? api.selectedScrollSnap() + 1 : 1} of {totalSteps}
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
