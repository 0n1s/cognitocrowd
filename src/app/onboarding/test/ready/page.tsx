
"use client";

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Clock, ArrowRight } from 'lucide-react';

export default function TestReadyPage() {
    const searchParams = useSearchParams();
    const expertiseParams = searchParams.toString();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-3xl font-headline">You're All Set!</CardTitle>
                <CardDescription className="text-lg text-muted-foreground pt-2">
                    Your personalized qualification test is ready.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p>Please review the rules below. Once you start the test, you cannot pause it.</p>
                <div className="mt-6 space-y-4">
                     <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/50">
                        <Clock className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                        <div>
                            <h3 className="font-semibold">Timed Test</h3>
                            <p className="text-muted-foreground">You will have <strong>10 minutes</strong> to complete the test.</p>
                        </div>
                    </div>
                     <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/50">
                        <Check className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                        <div>
                            <h3 className="font-semibold">10 Questions</h3>
                            <p className="text-muted-foreground">The test consists of 10 multiple-choice questions based on your selected expertise.</p>
                        </div>
                    </div>
                </div>
                 <p className="mt-6">Make sure you are in a quiet environment with a stable internet connection before you begin.</p>
            </CardContent>
            <CardFooter>
                <Button asChild size="lg">
                    <Link href={`/onboarding/test?${expertiseParams}`}>
                        I'm Ready, Start the Test <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
