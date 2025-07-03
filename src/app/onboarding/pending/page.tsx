
"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { LogOut, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { getUserData } from '@/lib/database';
import { User } from '@/lib/types';
import { Progress } from '@/components/ui/progress';

function PendingReviewContent() {
    const { user, loading: authLoading } = useAuth();
    const [userData, setUserData] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            getUserData(user.uid).then(data => {
                setUserData(data);
                setLoading(false);
            });
        }
    }, [user]);

    if (authLoading || loading) {
        return (
             <Card className="text-center">
                <CardHeader>
                     <CardTitle className="font-headline text-2xl">Loading Your Results...</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center items-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary"/>
                </CardContent>
             </Card>
        )
    }

    const score = userData?.qualificationScore ?? 0;
    const correct = userData?.qualificationResults?.correctCount ?? 0;
    const total = userData?.qualificationResults?.totalCount ?? 10;
    const feedback = userData?.qualificationFeedback;

    return (
        <Card className="text-center">
            <CardHeader>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
                    <CheckCircle className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="font-headline text-2xl">Application Submitted</CardTitle>
                <CardDescription className="pt-2">
                    Thank you for completing the qualification test. Here are your initial results. Your application is now under review by our team.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="text-left p-4 border rounded-lg bg-muted/50">
                    <h3 className="font-semibold mb-2">Your Score:</h3>
                     <div className="flex items-center gap-4">
                        <span className="text-2xl font-bold text-primary">{score}%</span>
                        <Progress value={score} className="w-full" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{correct} out of {total} correct</p>
                    
                    {feedback && (
                        <>
                            <h3 className="font-semibold mt-4 mb-2">AI Feedback:</h3>
                            <blockquote className="text-sm italic text-muted-foreground border-l-2 pl-4">
                                {feedback}
                            </blockquote>
                        </>
                    )}
                </div>

                <p className="text-muted-foreground">We'll notify you via email once your application has been approved, which usually takes 1-2 business days. Thank you for your patience.</p>
                <Button asChild variant="outline">
                    <Link href="/logout"><LogOut className="mr-2 h-4 w-4" /> Log Out</Link>
                </Button>
            </CardContent>
        </Card>
    );
}

export default function PendingReviewPage() {
    return <PendingReviewContent />
}
