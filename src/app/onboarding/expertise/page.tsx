
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowRight } from "lucide-react";
import { updateUserExpertise } from "@/lib/actions";

const EXPERTISE_OPTIONS = [
  "General Knowledge",
  "Mathematics",
  "Science (Physics, Chemistry, Biology)",
  "Software Development & Code",
  "History & Humanities",
  "Creative Writing & Literature",
  "Art & Design",
  "Business & Finance",
  "Health & Medicine",
];

export default function OnboardingExpertisePage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [selectedExpertise, setSelectedExpertise] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const handleCheckboxChange = (expertise: string) => {
        setSelectedExpertise(prev => 
            prev.includes(expertise) 
                ? prev.filter(item => item !== expertise) 
                : [...prev, expertise]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            toast({ title: "Error", description: "You are not logged in.", variant: "destructive" });
            return;
        }
        if (selectedExpertise.length === 0) {
            toast({ title: "No Selection Made", description: "Please select at least one area of expertise.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        const result = await updateUserExpertise(user.uid, { expertise: selectedExpertise });
        
        if (result.success) {
            const params = new URLSearchParams();
            selectedExpertise.forEach(exp => params.append("expertise", exp));
            router.push(`/onboarding/test?${params.toString()}`);
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <form onSubmit={handleSubmit}>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Select Your Expertise</CardTitle>
                    <CardDescription>Choose the fields you are most knowledgeable in. This will help us provide you with a relevant qualification test.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Label>Areas of Expertise (select all that apply)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {EXPERTISE_OPTIONS.map(option => (
                            <div key={option} className="flex items-center space-x-2">
                                <Checkbox
                                    id={option}
                                    onCheckedChange={() => handleCheckboxChange(option)}
                                    checked={selectedExpertise.includes(option)}
                                />
                                <Label htmlFor={option} className="font-normal">{option}</Label>
                            </div>
                        ))}
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Continue to Qualification Test <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
