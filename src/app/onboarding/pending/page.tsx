
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { LogOut } from 'lucide-react';

export default function PendingReviewPage() {
    return (
        <Card className="text-center">
            <CardHeader>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                </div>
                <CardTitle className="font-headline text-2xl">Application Submitted</CardTitle>
                <CardDescription className="pt-2">
                    Thank you for completing the qualification test. Your application is now under review by our team.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">You will be notified via email once your application has been approved. This usually takes 1-2 business days. In the meantime, you can log out.</p>
            </CardContent>
            <CardContent>
                 <Button asChild variant="outline">
                    <Link href="/logout"><LogOut className="mr-2 h-4 w-4" /> Log Out</Link>
                </Button>
            </CardContent>
        </Card>
    );
}
