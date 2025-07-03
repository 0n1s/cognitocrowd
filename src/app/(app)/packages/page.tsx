
"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getPackages } from '@/lib/database';
import { Package } from '@/lib/types';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { purchasePackage } from '@/lib/actions';
import { useRouter } from 'next/navigation';

function PackagesLoadingSkeleton() {
    return (
        <div className="grid gap-8 mt-12 md:grid-cols-3 items-start">
            {[...Array(3)].map((_, i) => (
                <Card key={i}>
                    <CardHeader className="items-center text-center">
                       <Skeleton className="h-7 w-24" />
                       <Skeleton className="h-9 w-20 mt-2" />
                       <Skeleton className="h-5 w-32 mt-1" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <Skeleton className="h-5 w-full" />
                            <Skeleton className="h-5 w-4/5" />
                            <Skeleton className="h-5 w-full" />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Skeleton className="h-10 w-full" />
                    </CardFooter>
                </Card>
            ))}
        </div>
    )
}

export default function PackagesPage() {
    const [packages, setPackages] = useState<Package[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        async function fetchPackages() {
            try {
                const fetchedPackages = await getPackages();
                setPackages(fetchedPackages);
            } catch (error) {
                console.error("Failed to fetch packages:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchPackages();
    }, []);

    const handlePurchase = async (packageId: string) => {
        if (!user) {
            toast({ title: "Not Authenticated", description: "You must be logged in to purchase a package.", variant: "destructive" });
            return;
        }

        setIsSubmitting(packageId);
        const result = await purchasePackage(user.uid, packageId);

        if (result.success) {
            toast({ title: "Success!", description: result.message });
            router.refresh();
        } else {
            toast({ title: "Purchase Failed", description: result.message, variant: "destructive" });
        }
        setIsSubmitting(null);
    };

    return (
        <div>
            <div className="text-center">
                <h1 className="text-3xl font-bold font-headline">Subscription Plans</h1>
                <p className="text-muted-foreground mt-1 max-w-2xl mx-auto">
                    Choose a plan that fits your ambition. Unlock more tasks, premium rewards, and exclusive features.
                </p>
            </div>
            
            {loading ? <PackagesLoadingSkeleton /> : (
                 <>
                    {packages.length > 0 ? (
                        <div className="grid gap-8 mt-12 md:grid-cols-3 items-start">
                            {packages.sort((a, b) => a.price.localeCompare(b.price)).map((pkg) => (
                                <Card key={pkg.id} className={cn("flex flex-col", pkg.isPrimary && "border-primary shadow-lg")}>
                                    <CardHeader className="items-center text-center">
                                        <CardTitle className="text-2xl font-headline">{pkg.name}</CardTitle>
                                        <div className="text-4xl font-bold">
                                            {pkg.price.startsWith('$') ? (
                                                <>
                                                    {pkg.price.split('/')[0]}
                                                    <span className="text-sm font-normal text-muted-foreground">/{pkg.price.split('/')[1]}</span>
                                                </>
                                            ) : (
                                                pkg.price
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-grow">
                                        <ul className="space-y-3">
                                            <li className="flex items-center gap-2">
                                                <Check className="h-5 w-5 text-green-500" />
                                                <span className="text-muted-foreground">{`${pkg.taskLimit} tasks / ${pkg.expiryPeriod.replace('1 ', '')}`}</span>
                                            </li>
                                            {pkg.features.map((feature, i) => (
                                                <li key={i} className="flex items-center gap-2">
                                                    <Check className="h-5 w-5 text-green-500" />
                                                    <span className="text-muted-foreground">{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                    <CardFooter>
                                        <Button
                                            className="w-full"
                                            variant={pkg.isPrimary ? "default" : "outline"}
                                            onClick={() => handlePurchase(pkg.id)}
                                            disabled={!!isSubmitting}
                                        >
                                            {isSubmitting === pkg.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            {pkg.isPrimary ? 'Choose Plan' : 'Get Started'}
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Card className="mt-12">
                            <CardContent className="pt-6">
                                <p className="text-center text-muted-foreground">No subscription plans available at the moment.</p>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
