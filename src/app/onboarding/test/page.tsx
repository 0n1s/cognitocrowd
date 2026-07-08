
"use client";

import { useState, useEffect, Suspense, useMemo, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Clock, AlertTriangle } from "lucide-react";
import { getQualificationTestSecuritySettings, logQualificationCopyAttempt, submitQualificationTest, startUserQualificationTest } from "@/lib/user-api";
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
    const [error, setError] = useState<string | null>(null);
    const [copyAttempts, setCopyAttempts] = useState(0);
    const [antiCopyEnabled, setAntiCopyEnabled] = useState(true);
    const [copyAttemptLimit, setCopyAttemptLimit] = useState(5);
    const [autoFailTriggered, setAutoFailTriggered] = useState(false);
    const lastHandledCopyAttemptRef = useRef(0);

    const expertise = useMemo(() => searchParams.getAll("expertise"), [searchParams]);

    useEffect(() => {
        if (!user) return;

        getQualificationTestSecuritySettings(user.uid)
            .then((result) => {
                if (!result.success) return;
                setAntiCopyEnabled(result.antiCopyEnabled !== false);
                const configuredLimit = Number(result.copyAttemptLimit);
                setCopyAttemptLimit(Number.isFinite(configuredLimit) ? Math.max(1, Math.floor(configuredLimit)) : 5);
            })
            .catch(() => {
                // Keep secure defaults if settings cannot be loaded.
            });
    }, [user]);

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
            setError("No expertise was selected. Please go back.");
            setIsLoading(false);
            return;
        }

        if (user) {
            startUserQualificationTest(user.uid, expertise)
                .then(data => {
                    if (data.success && data.questions) {
                        setQuestions(data.questions);
                    } else {
                        setError(data.message || "An unknown error occurred.");
                    }
                })
                .catch(err => {
                    setError(err.message);
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, [user, expertise]);

    // Timer logic
    useEffect(() => {
        if (isLoading || isSubmitting || error) return;

        if (timeLeft <= 0) {
            toast({ title: "Time's up!", description: "Please submit your answers now.", variant: "destructive" });
            return;
        }

        const timerId = setInterval(() => {
            setTimeLeft(prevTime => prevTime - 1);
        }, 1000);

        return () => clearInterval(timerId);
    }, [timeLeft, isLoading, isSubmitting, toast, error]);


    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const handleAnswerChange = (questionIndex: number, value: string) => {
        setUserAnswers(prev => ({...prev, [questionIndex]: value}));
    };

    const submitForcedFailure = async (reason: string, attempts: number) => {
        if (!user) return;
        if (!fingerprint) {
            setError("Copy policy violation detected. Could not verify browser fingerprint for auto-fail submission.");
            return;
        }

        setIsSubmitting(true);
        const result = await submitQualificationTest(user.uid, questions, userAnswers, expertise, fingerprint, {
            forcedFailureReason: reason,
            copyAttempts: attempts,
        });

        if (result.success) {
            toast({ title: "Test Failed", description: "Your test was automatically failed due to repeated copy attempts.", variant: "destructive" });
            router.push('/onboarding/pending');
            return;
        }

        toast({ title: "Error", description: result.message || "Failed to auto-submit test result.", variant: "destructive" });
        setIsSubmitting(false);
    };

    const registerCopyAttempt = useCallback(() => {
        if (!antiCopyEnabled || isSubmitting || error) return;
        setCopyAttempts((prev) => prev + 1);
    }, [antiCopyEnabled, isSubmitting, error]);

    useEffect(() => {
        if (!antiCopyEnabled || copyAttempts <= 0) return;
        if (lastHandledCopyAttemptRef.current >= copyAttempts) return;

        lastHandledCopyAttemptRef.current = copyAttempts;

        if (user) {
            void logQualificationCopyAttempt(user.uid, {
                attemptCount: copyAttempts,
                copyAttemptLimit,
                expertise,
                browserFingerprint: fingerprint || 'unknown',
            });
        }

        if (copyAttempts > copyAttemptLimit) {
            if (!autoFailTriggered) {
                setAutoFailTriggered(true);
                void submitForcedFailure('Automatic failure triggered: repeated copy attempts detected.', copyAttempts);
            }
            return;
        }

        const remaining = Math.max(0, copyAttemptLimit - copyAttempts);
        toast({
            title: "Copy Blocked",
            description: `Copying is disabled during the qualification test. Attempts: ${copyAttempts}. Remaining before auto-fail: ${remaining}.`,
            variant: "destructive",
        });
    }, [
        antiCopyEnabled,
        autoFailTriggered,
        copyAttemptLimit,
        copyAttempts,
        expertise,
        fingerprint,
        toast,
        user,
    ]);

    useEffect(() => {
        if (!antiCopyEnabled) return;

        const handleCopy = (event: ClipboardEvent) => {
            event.preventDefault();
            registerCopyAttempt();
        };

        const handleCut = (event: ClipboardEvent) => {
            event.preventDefault();
            registerCopyAttempt();
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            const isCopyShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c';
            if (!isCopyShortcut) return;
            event.preventDefault();
            registerCopyAttempt();
        };

        document.addEventListener('copy', handleCopy);
        document.addEventListener('cut', handleCut);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('copy', handleCopy);
            document.removeEventListener('cut', handleCut);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [antiCopyEnabled, registerCopyAttempt]);

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
                    <CardTitle className="font-headline text-2xl">Preparing Your Qualification Test...</CardTitle>
                    <CardDescription>This may take a moment.</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center items-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </CardContent>
            </Card>
        );
    }

    if (error) {
         return (
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl text-destructive flex items-center gap-2"><AlertTriangle /> Error</CardTitle>
                    <CardDescription>Could not start the qualification test.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">{error}</p>
                    <p className="text-muted-foreground mt-2">This usually happens if an administrator has not yet created a test for the selected expertise.</p>
                     <Button variant="outline" className="mt-4" onClick={() => router.push('/onboarding/expertise')}>Go Back</Button>
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
                            
                            
                            {antiCopyEnabled && (
                                <p className="mt-2 text-xs text-destructive">
                                </p>
                            )}
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
                <CardTitle className="font-headline text-2xl">Preparing Your Qualification Test...</CardTitle>
                <CardDescription>This may take a moment.</CardDescription>
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
