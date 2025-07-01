import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { mockPackages } from '@/lib/data';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PackagesPage() {
    return (
        <div>
            <div className="text-center">
                <h1 className="text-3xl font-bold font-headline">Subscription Plans</h1>
                <p className="text-muted-foreground mt-1 max-w-2xl mx-auto">
                    Choose a plan that fits your ambition. Unlock more tasks, premium rewards, and exclusive features.
                </p>
            </div>

            <div className="grid gap-8 mt-12 md:grid-cols-3 items-start">
                {mockPackages.map((pkg) => (
                    <Card key={pkg.name} className={cn("flex flex-col", pkg.isPrimary && "border-primary shadow-lg")}>
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
        </div>
    );
}
