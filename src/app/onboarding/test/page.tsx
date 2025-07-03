
"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Clock } from "lucide-react";
import { submitQualificationTest, generateTestForUser } from "@/lib/actions";
import { QualificationQuestion } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import FingerprintJS from '@fingerprintjs/fingerprintjs';

const TEST_DURATION_SECONDS = 600; // 10 minutes

function TestGenerator() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    
    const [questions, setQuestions] = useState<QualificationQuestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
    const [fingerprint, setFingerprint] = useState<string>('');
    const [timeLeft, setTimeLeft] = useState(TEST_DURATION_SECONDS);

    const expertise = searchParams.getAll("expertise");

    // Get browser fingerprint
    useEffect(() => {
        const getFingerprint = async () => {
            const fp = await FingerprintJS.load();
            const result = await fp.get();
            setFingerprint(result.visitorId);
        };
        getFingerprint();
    }, []);

    useEffect(() => {
        if (expertise.length === 0) {
            toast({ title: "No Expertise Found", description: "Please go back and select your areas of expertise.", variant: "destructive" });
            router.push('/onboarding/expertise');
            return;
        }

        if (user) {
            generateTestForUser(user.uid, expertise)
                .then(data => {
                    setQuestions(data.questions);
                    setIsLoading(false);
                })
                .catch(err => {
                    toast({ title: "Failed to generate test", description: err.message, variant: "destructive" });
                    router.push('/onboarding/expertise');
                });
        }
    }, [user, expertise, router, toast]);

    // Timer logic
    useEffect(() => {
        if (isLoading || isSubmitting) return;

        if (timeLeft <= 0) {
            toast({ title: "Time's up!", description: "Please submit your answers now.", variant: "destructive" });
            return;
        }

        const timerId = setInterval(() => {
            setTimeLeft(prevTime => prevTime - 1);
        }, 1000);

        return () => clearInterval(timerId);
    }, [timeLeft, isLoading, isSubmitting, toast]);


    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const handleAnswerChange = (questionIndex: number, value: string) => {
        setUserAnswers(prev => ({...prev, [questionIndex]: value}));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            toast({ title: "Error", description: "You are not logged in.", variant: "destructive" });
            return;
        }
        if (Object.keys(userAnswers).length !== questions.length) {
            toast({ title: "Incomplete Test", description: "Please answer all questions before submitting.", variant: "destructive" });
            return;
        }
         if (!fingerprint) {
            toast({ title: "Error", description: "Could not verify browser. Please refresh and try again.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        const result = await submitQualificationTest(user.uid, questions, userAnswers, expertise, fingerprint);
        
        if (result.success) {
            toast({ title: "Test Submitted!", description: "Your application is now under review." });
            router.push('/onboarding/pending');
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
            setIsSubmitting(false);
        }
    };
    
    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Generating Your Qualification Test...</CardTitle>
                    <CardDescription>Our AI is preparing a personalized test based on your expertise. This may take a moment.</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center items-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <form onSubmit={handleSubmit}>
                <CardHeader>
                     <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="font-headline text-2xl">Qualification Test</CardTitle>
                            <CardDescription>Please complete this timed test to demonstrate your skills. Your response will be reviewed by our team.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-lg font-semibold rounded-md border px-3 py-1.5">
                            <Clock className="h-5 w-5" />
                            <span>{formatTime(timeLeft)}</span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-8">
                    {questions.map((q, index) => (
                        <div key={index} className="space-y-4">
                            <h3 className="font-semibold">{index + 1}. {q.question}</h3>
                            <RadioGroup name={`question-${index}`} onValueChange={(value) => handleAnswerChange(index, value)}>
                                {q.options.map((option, optIndex) => (
                                    <div key={optIndex} className="flex items-center space-x-3 p-3 border rounded-md">
                                        <RadioGroupItem value={option} id={`q-${index}-opt-${optIndex}`} />
                                        <Label htmlFor={`q-${index}-opt-${optIndex}`} className="font-normal">{option}</Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </div>
                    ))}
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isSubmitting || timeLeft <= 0}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit Test for Review
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}


function TestPageSkeleton() {
    return (
         <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Generating Your Qualification Test...</CardTitle>
                <CardDescription>Our AI is preparing a personalized test based on your expertise. This may take a moment.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center items-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
        </Card>
    )
}

export default function OnboardingTestPage() {
    return (
        <Suspense fallback={<TestPageSkeleton />}>
            <TestGenerator />
        </Suspense>
    )
}
