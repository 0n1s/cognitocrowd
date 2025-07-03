
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { submitQualificationTest } from "@/lib/actions";

const TEST_QUESTION = {
  title: "Grammar and Spelling Correction",
  description: "Please select the sentence that is grammatically correct and has no spelling errors.",
  options: [
    "Their going to the store to buy they're groceries.",
    "They're going to the store to buy there groceries.",
    "They're going to the store to buy their groceries.",
    "There going to the store to buy their groceries.",
  ],
  name: "grammar_test"
};

export default function OnboardingTestPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [selectedValue, setSelectedValue] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            toast({ title: "Error", description: "You are not logged in.", variant: "destructive" });
            return;
        }
        if (!selectedValue) {
            toast({ title: "No Answer Selected", description: "Please select an answer to submit the test.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        const formData = new FormData();
        formData.append(TEST_QUESTION.name, selectedValue);

        const result = await submitQualificationTest(user.uid, formData);
        
        if (result.success) {
            toast({ title: "Test Submitted!", description: "Your application is now under review." });
            router.push('/onboarding/pending');
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <form onSubmit={handleSubmit}>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Qualification Test</CardTitle>
                    <CardDescription>Please complete this short test to demonstrate your skills. Your response will be reviewed by our team.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <h3 className="font-semibold">{TEST_QUESTION.title}</h3>
                        <p className="text-muted-foreground text-sm">{TEST_QUESTION.description}</p>
                    </div>
                    <RadioGroup name={TEST_QUESTION.name} onValueChange={setSelectedValue}>
                        {TEST_QUESTION.options.map((option, index) => (
                            <div key={index} className="flex items-center space-x-3 p-3 border rounded-md">
                                <RadioGroupItem value={option} id={`option-${index}`} />
                                <Label htmlFor={`option-${index}`} className="font-normal">{option}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit Test for Review
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
