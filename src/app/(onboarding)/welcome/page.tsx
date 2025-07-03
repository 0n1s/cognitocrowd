
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';

export default function WelcomePage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-3xl font-headline">Welcome to Trainly!</CardTitle>
                <CardDescription className="text-lg text-muted-foreground pt-2">
                    Before you can start contributing, we need to ask a few questions to verify your account and tailor your experience.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p>This qualification process ensures we maintain a high standard of quality for our AI training data. It involves a few short steps:</p>
                <ul className="list-disc list-inside space-y-2 mt-4">
                    <li>Confirming your profile information.</li>
                    <li>Selecting your areas of expertise.</li>
                    <li>Completing a short qualification test.</li>
                </ul>
                <p className="mt-4">Once you submit your test, our team will review it. You'll be notified upon approval.</p>
            </CardContent>
            <CardFooter>
                <Button asChild size="lg">
                    <Link href="#">Get Started <ArrowRight className="ml-2 h-5 w-5" /></Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
