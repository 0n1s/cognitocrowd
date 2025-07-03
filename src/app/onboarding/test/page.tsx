
"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { submitQualificationTest, generateTestForUser } from "@/lib/actions";
import { QualificationQuestion } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

function TestGenerator() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    
    const [questions, setQuestions] = useState<QualificationQuestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});

    const expertise = searchParams.getAll("expertise");

    useEffect(() => {
        if (expertise.length > 0) {
            generateTestForUser(expertise)
                .then(data => {
                    setQuestions(data.questions);
                    setIsLoading(false);
                })
                .catch(err => {
                    toast({ title: "Failed to generate test", description: err.message, variant: "destructive" });
                    router.back();
                });
        } else {
             toast({ title: "No Expertise Found", description: "Please go back and select your areas of expertise.", variant: "destructive" });
             router.back();
        }
    }, []);

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

        setIsSubmitting(true);
        const result = await submitQualificationTest(user.uid, questions, userAnswers, expertise);
        
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
                    <CardTitle className="font-headline text-2xl">Qualification Test</CardTitle>
                    <CardDescription>Please complete this test to demonstrate your skills. Your response will be reviewed by our team.</CardDescription>
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
                    <Button type="submit" disabled={isSubmitting}>
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
