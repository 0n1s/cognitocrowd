
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { COUNTRIES } from "@/lib/countries";
import { updateUserOnboardingProfile } from "@/lib/actions";

export default function OnboardingProfilePage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [country, setCountry] = useState("");
    const [languages, setLanguages] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            toast({ title: "Error", description: "You are not logged in.", variant: "destructive" });
            return;
        }
        if (!country || !languages) {
            toast({ title: "Missing Information", description: "Please fill out all fields.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        const languageList = languages.split(',').map(lang => lang.trim()).filter(Boolean);
        const result = await updateUserOnboardingProfile(user.uid, { country, languages: languageList });
        
        if (result.success) {
            toast({ title: "Profile Updated", description: "Let's move to the next step." });
            router.push('/onboarding/expertise');
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setIsLoading(false);
    };

    return (
        <Card>
            <form onSubmit={handleSubmit}>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Tell Us About Yourself</CardTitle>
                    <CardDescription>This information helps us tailor your experience and offer relevant contributions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="country">Country of Residence</Label>
                        <Select value={country} onValueChange={setCountry} required>
                            <SelectTrigger id="country">
                                <SelectValue placeholder="Select your country" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                                {COUNTRIES.map(c => (
                                    <SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="languages">Languages Spoken</Label>
                         <Input
                            id="languages"
                            value={languages}
                            onChange={(e) => setLanguages(e.target.value)}
                            placeholder="e.g., English, Spanish, French"
                            required
                        />
                        <p className="text-sm text-muted-foreground">Please separate languages with a comma.</p>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Continue
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
