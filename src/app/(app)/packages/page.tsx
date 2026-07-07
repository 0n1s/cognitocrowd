
"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getPackage, getPackages, getUserData } from '@/lib/database';
import { Package } from '@/lib/types';
import { Check, Loader2, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { purchasePackage } from '@/lib/user-api';
import { useRouter } from 'next/navigation';
import { getAiWorkspaceFeatures } from '@/lib/package-workspace';
import { getPackageMoney } from '@/lib/currency';
import { useDisplayCurrency } from '@/hooks/use-display-currency';

function PackagesLoadingSkeleton() {
    return (
        <div className="grid gap-8 mt-12 md:grid-cols-3 items-stretch">
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
    const { formatAmount } = useDisplayCurrency();
    const [packages, setPackages] = useState<Package[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
    const [currentPackageId, setCurrentPackageId] = useState<string | null>(null);
    const [currentPackagePrice, setCurrentPackagePrice] = useState<number | null>(null);
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        async function fetchPackages() {
            try {
                const fetchedPackages = await getPackages();
                setPackages([...fetchedPackages].sort((a, b) => {
                    const priceDifference = getPackageMoney(a).amount - getPackageMoney(b).amount;
                    return priceDifference || a.name.localeCompare(b.name);
                }));

                if (user) {
                    const userData = await getUserData(user.uid);
                    const activePackageId = userData?.packageId || null;
                    setCurrentPackageId(activePackageId);

                    if (activePackageId) {
                        const activePackage = await getPackage(activePackageId);
                        setCurrentPackagePrice(activePackage ? getPackageMoney(activePackage).amount : null);
                    } else {
                        setCurrentPackagePrice(null);
                    }
                } else {
                    setCurrentPackageId(null);
                    setCurrentPackagePrice(null);
                }
            } catch (error) {
                console.error("Failed to fetch packages:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchPackages();
    }, [user]);

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
                        <div className="grid gap-8 mt-12 md:grid-cols-3 items-stretch">
                            {packages.map((pkg) => {
                                const workspaceFeatures = getAiWorkspaceFeatures(pkg);
                                const isCurrentPlan = currentPackageId === pkg.id;
                                const packageMoney = getPackageMoney(pkg);
                                const displayPrice = packageMoney.isFree
                                    ? 'Free'
                                    : formatAmount(packageMoney.amount, packageMoney.currency);
                                const isDowngrade = currentPackagePrice !== null && packageMoney.amount < currentPackagePrice;
                                const isDisabled = !!isSubmitting || isCurrentPlan || isDowngrade;
                                const buttonLabel = isCurrentPlan
                                    ? 'On this Plan'
                                    : isDowngrade
                                        ? 'Lower Plan Unavailable'
                                        : pkg.isPrimary
                                            ? 'Choose Plan'
                                            : 'Get Started';
                                return (
                                <Card key={pkg.id} className={cn("flex h-full flex-col", pkg.isPrimary && "border-primary shadow-lg")}>
                                    <CardHeader className="items-center text-center">
                                        <CardTitle className="text-2xl font-headline">{pkg.name}</CardTitle>
                                        <div className="text-4xl font-bold">
                                            {displayPrice}
                                            {packageMoney.period && <span className="text-sm font-normal text-muted-foreground">/{packageMoney.period}</span>}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-grow">
                                        <p className="mb-3 text-sm font-semibold">Package features</p>
                                        <ul className="space-y-3">
                                            <li className="flex items-center gap-2">
                                                <Check className="h-5 w-5 text-green-500" />
                                                <span className="text-muted-foreground">{`${pkg.taskLimit} tasks / ${pkg.expiryPeriod.replace('1 ', '')}`}</span>
                                            </li>
                                            {(pkg.features || []).map((feature, i) => (
                                                <li key={i} className="flex items-center gap-2">
                                                    <Check className="h-5 w-5 text-green-500" />
                                                    <span className="text-muted-foreground">{feature}</span>
                                                </li>
                                            ))}
                                            {(pkg.features || []).length === 0 && (
                                                <li className="text-sm text-muted-foreground">No additional features listed.</li>
                                            )}
                                        </ul>
                                        <div className="my-5 border-t" />
                                        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                                            <Sparkles className="h-4 w-4 text-primary" />
                                            AI Workspace
                                        </div>
                                        <ul className="space-y-2.5">
                                            {workspaceFeatures.map((feature) => (
                                                <li key={feature.label} className="flex items-start gap-2 text-sm">
                                                    {feature.enabled ? (
                                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                                                    ) : (
                                                        <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                                                    )}
                                                    <span className={cn(
                                                        feature.enabled ? 'text-muted-foreground' : 'text-muted-foreground/60 line-through'
                                                    )}>
                                                        {feature.label}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                    <CardFooter>
                                        <Button
                                            className="w-full"
                                            variant={isCurrentPlan ? "secondary" : pkg.isPrimary ? "default" : "outline"}
                                            onClick={() => handlePurchase(pkg.id)}
                                            disabled={isDisabled}
                                        >
                                            {isSubmitting === pkg.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            {buttonLabel}
                                        </Button>
                                    </CardFooter>
                                </Card>
                                );
                            })}
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
