
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getQualificationTestStatuses } from "@/lib/database";
import { generateAndSaveQualificationTest } from "@/lib/actions";
import { Wand2, Loader2, CheckCircle, XCircle } from "lucide-react";

const EXPERTISE_AREAS = [
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

const LoadingSkeleton = () => (
    <Table>
        <TableHeader>
            <TableRow>
              <TableHead>Expertise Area</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-10 w-36" /></TableCell>
                </TableRow>
            ))}
        </TableBody>
    </Table>
);


export function TestList() {
    const { toast } = useToast();
    const [statuses, setStatuses] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [generatingExpertise, setGeneratingExpertise] = useState<string | null>(null);

    const fetchStatuses = async () => {
        setLoading(true);
        try {
            const fetchedStatuses = await getQualificationTestStatuses();
            setStatuses(fetchedStatuses);
        } catch (error) {
            console.error("Failed to fetch test statuses:", error);
            toast({ title: "Error", description: "Could not load test statuses.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatuses();
    }, []);

    const handleGenerate = async (expertise: string) => {
        setGeneratingExpertise(expertise);
        try {
            const result = await generateAndSaveQualificationTest(expertise);
            if (result.success) {
                toast({ title: "Success", description: `Test for ${expertise} has been generated and saved.`});
                await fetchStatuses(); // Refresh the list
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "An unexpected error occurred while generating the test.", variant: "destructive" });
        } finally {
            setGeneratingExpertise(null);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Test Bank Status</CardTitle>
                <CardDescription>
                    Generate and manage the question banks for each expertise area. Users cannot take a test until a bank is generated.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? <LoadingSkeleton /> : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Expertise Area</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {EXPERTISE_AREAS.map(expertise => (
                                <TableRow key={expertise}>
                                    <TableCell className="font-medium">{expertise}</TableCell>
                                    <TableCell>
                                        {statuses[expertise] ? (
                                            <Badge variant="secondary" className="text-green-600 border-green-200 bg-green-50">
                                                <CheckCircle className="mr-1 h-3 w-3" /> Generated
                                            </Badge>
                                        ) : (
                                             <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">
                                                <XCircle className="mr-1 h-3 w-3" /> Not Generated
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button 
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleGenerate(expertise)}
                                            disabled={!!generatingExpertise}
                                        >
                                            {generatingExpertise === expertise ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <Wand2 className="mr-2 h-4 w-4" />
                                            )}
                                            {statuses[expertise] ? 'Regenerate Test' : 'Generate Test'}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
