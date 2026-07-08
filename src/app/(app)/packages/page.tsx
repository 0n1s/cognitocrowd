
"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { getPackage, getPackages, getUserData } from '@/lib/database';
import { Package } from '@/lib/types';
import { Check, Loader2, Sparkles, X, Wallet, CalendarClock, BadgeDollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getPackageUpgradeQuotes, purchasePackage } from '@/lib/user-api';
import { useRouter } from 'next/navigation';
import { getAiWorkspaceFeatures } from '@/lib/package-workspace';
import { getPackageMoney } from '@/lib/currency';
import { useDisplayCurrency } from '@/hooks/use-display-currency';

type UpgradeQuote = {
    packageId: string;
    selectedPriceUsd: number;
    creditUsd: number;
    finalPriceUsd: number;
    remainingDays: number;
    eligible: boolean;
    reason: 'upgrade' | 'same_package' | 'same_price' | 'downgrade' | 'no_current_package';
};

type PendingUpgradeConfirmation = {
    packageId: string;
    packageName: string;
    quote: UpgradeQuote;
};

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
    const [upgradeQuotes, setUpgradeQuotes] = useState<Record<string, UpgradeQuote | null>>({});
    const [pendingUpgradeConfirmation, setPendingUpgradeConfirmation] = useState<PendingUpgradeConfirmation | null>(null);
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

                    const packageIds = fetchedPackages.map((pkg) => pkg.id).filter(Boolean);
                    if (packageIds.length > 0) {
                        const quotesResult = await getPackageUpgradeQuotes(user.uid, packageIds);
                        if (quotesResult.success && quotesResult.quotes) {
                            setUpgradeQuotes(quotesResult.quotes as Record<string, UpgradeQuote | null>);
                        } else {
                            setUpgradeQuotes({});
                        }
                    } else {
                        setUpgradeQuotes({});
                    }
                } else {
                    setCurrentPackageId(null);
                    setCurrentPackagePrice(null);
                    setUpgradeQuotes({});
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

    const handlePlanAction = (pkg: Package, quote: UpgradeQuote | null, isUpgradeEligible: boolean) => {
        if (isUpgradeEligible && quote) {
            setPendingUpgradeConfirmation({
                packageId: pkg.id,
                packageName: pkg.name,
                quote,
            });
            return;
        }

        void handlePurchase(pkg.id);
    };

    const handleConfirmUpgrade = async () => {
        if (!pendingUpgradeConfirmation) {
            return;
        }

        const selectedPackageId = pendingUpgradeConfirmation.packageId;
        setPendingUpgradeConfirmation(null);
        await handlePurchase(selectedPackageId);
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
                                const quote = upgradeQuotes[pkg.id] || null;
                                const isUpgradeEligible = !!quote && quote.eligible && quote.reason === 'upgrade';
                                const effectiveAmount = isUpgradeEligible
                                    ? quote.finalPriceUsd
                                    : packageMoney.amount;
                                const effectiveCurrency = isUpgradeEligible ? 'USD' : packageMoney.currency;
                                const displayPrice = packageMoney.isFree
                                    ? 'Free'
                                    : formatAmount(effectiveAmount, effectiveCurrency);
                                const fullPriceDisplay = packageMoney.isFree
                                    ? 'Free'
                                    : formatAmount(packageMoney.amount, packageMoney.currency);
                                const isDowngrade = quote
                                    ? quote.reason === 'downgrade'
                                    : currentPackagePrice !== null && packageMoney.amount < currentPackagePrice;
                                const isDisabled = !!isSubmitting || isCurrentPlan || isDowngrade;
                                const buttonLabel = isCurrentPlan
                                    ? 'On this Plan'
                                    : isDowngrade
                                        ? 'Lower Plan Unavailable'
                                        : isUpgradeEligible
                                            ? 'Upgrade Plan'
                                        : pkg.isPrimary
                                            ? 'Choose Plan'
                                            : 'Get Started';
                                return (
                                <Card key={pkg.id} className={cn("flex h-full flex-col", pkg.isPrimary && "border-primary shadow-lg")}>
                                    <CardHeader className="items-center text-center">
                                        <CardTitle className="text-2xl font-headline">{pkg.name}</CardTitle>
                                        <div className="text-4xl font-bold">
                                            {displayPrice}
                                            {!isUpgradeEligible && packageMoney.period && <span className="text-sm font-normal text-muted-foreground">/{packageMoney.period}</span>}
                                        </div>
                                        {isUpgradeEligible && (
                                            <CardDescription>
                                                Normally {fullPriceDisplay}. Upgrade credit: {formatAmount(quote.creditUsd, 'USD')} ({quote.remainingDays} day{quote.remainingDays === 1 ? '' : 's'} left).
                                            </CardDescription>
                                        )}
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
                                            onClick={() => handlePlanAction(pkg, quote, isUpgradeEligible)}
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

            <AlertDialog
                open={!!pendingUpgradeConfirmation}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingUpgradeConfirmation(null);
                    }
                }}
            >
                <AlertDialogContent className="sm:max-w-xl border-primary/20">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-headline">Confirm Package Upgrade</AlertDialogTitle>
                        <AlertDialogDescription>
                            Review the upgrade details before we charge your wallet.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {pendingUpgradeConfirmation && (
                        <div className="space-y-4">
                            <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-background to-background p-4">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Upgrading To</p>
                                <p className="mt-1 text-lg font-semibold text-foreground">{pendingUpgradeConfirmation.packageName}</p>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-lg border bg-card p-3">
                                    <p className="text-xs text-muted-foreground">Full Price</p>
                                    <p className="mt-1 text-base font-semibold">{formatAmount(pendingUpgradeConfirmation.quote.selectedPriceUsd, 'USD')}</p>
                                </div>
                                <div className="rounded-lg border bg-card p-3">
                                    <p className="text-xs text-muted-foreground">Unused Credit</p>
                                    <p className="mt-1 text-base font-semibold text-green-600">-{formatAmount(pendingUpgradeConfirmation.quote.creditUsd, 'USD')}</p>
                                </div>
                                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                                    <p className="text-xs text-muted-foreground">Pay Now</p>
                                    <p className="mt-1 text-lg font-bold text-foreground">{formatAmount(pendingUpgradeConfirmation.quote.finalPriceUsd, 'USD')}</p>
                                </div>
                            </div>

                            <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
                                <div className="flex items-start gap-2 text-muted-foreground">
                                    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>Credit uses {pendingUpgradeConfirmation.quote.remainingDays} remaining day{pendingUpgradeConfirmation.quote.remainingDays === 1 ? '' : 's'} from your current package.</span>
                                </div>
                                <div className="flex items-start gap-2 text-muted-foreground">
                                    <Wallet className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>The payable amount will be deducted from your wallet balance immediately.</span>
                                </div>
                                <div className="flex items-start gap-2 text-muted-foreground">
                                    <BadgeDollarSign className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>Your new package period starts immediately once confirmed.</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={!!isSubmitting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmUpgrade} disabled={!!isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
                            {pendingUpgradeConfirmation && isSubmitting === pendingUpgradeConfirmation.packageId && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Confirm Upgrade
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
