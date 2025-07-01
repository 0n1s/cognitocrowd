"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getPackages } from '@/lib/database';
import { Package } from '@/lib/types';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

function PackagesLoadingSkeleton() {
    return (
        <div className="grid gap-8 mt-12 md:grid-cols-3 items-start">
            {[...Array(3)].map((_, i) => (
                <Card key={i}>
                    <CardHeader className="items-center text-center">
                       <Skeleton className="h-7 w-24" />
                       <Skeleton className="h-9 w-20 mt-2" />
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
                            {packages.map((pkg) => (
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
                                            {pkg.features.map((feature, i) => (
                                                <li key={i} className="flex items-center gap-2">
                                                    <Check className="h-5 w-5 text-green-500" />
                                                    <span className="text-muted-foreground">{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                    <CardFooter>
                                        <Button className="w-full" variant={pkg.isPrimary ? "default" : "outline"}>
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
