

"use client";

import { useState, useEffect } from "react";
import { QualificationQuestion } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getQualificationTest, getQualificationTestsSummary } from "@/lib/database";
import { deleteQualificationQuestion, generateAndSaveQualificationTest, toggleQualificationTestStatus } from "@/lib/admin-api";
import { Wand2, Loader2, CheckCircle, XCircle, Eye, Trash2 } from "lucide-react";

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

type Summary = { questionCount: number; isEnabled: boolean };

const LoadingSkeleton = () => (
    <Table>
        <TableHeader>
            <TableRow>
              <TableHead>Expertise Area</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Question Count</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-10 w-40" /></TableCell>
                </TableRow>
            ))}
        </TableBody>
    </Table>
);


export function TestList() {
    const { toast } = useToast();
    const [summaries, setSummaries] = useState<Record<string, Summary>>({});
    const [loading, setLoading] = useState(true);
    const [generatingExpertise, setGeneratingExpertise] = useState<string | null>(null);
    const [togglingExpertise, setTogglingExpertise] = useState<string | null>(null);
    const [questionsDialogOpen, setQuestionsDialogOpen] = useState(false);
    const [viewingExpertise, setViewingExpertise] = useState<string | null>(null);
    const [viewingQuestions, setViewingQuestions] = useState<QualificationQuestion[]>([]);
    const [viewingQuestionsLoading, setViewingQuestionsLoading] = useState(false);
    const [deletingQuestionIndex, setDeletingQuestionIndex] = useState<number | null>(null);

    const fetchSummaries = async () => {
        setLoading(true);
        try {
            const fetchedSummaries = await getQualificationTestsSummary();
            setSummaries(fetchedSummaries);
        } catch (error) {
            console.error("Failed to fetch test summaries:", error);
            toast({ title: "Error", description: "Could not load test statuses.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSummaries();
    }, []);

    const handleViewQuestions = async (expertise: string) => {
        setQuestionsDialogOpen(true);
        setViewingExpertise(expertise);
        setViewingQuestions([]);
        setViewingQuestionsLoading(true);

        try {
            const test = await getQualificationTest(expertise);
            setViewingQuestions(test?.questions || []);
        } catch (error) {
            console.error("Failed to load qualification questions:", error);
            toast({ title: "Error", description: "Could not load qualification questions.", variant: "destructive" });
        } finally {
            setViewingQuestionsLoading(false);
        }
    };

    const handleDeleteQuestion = async (questionIndex: number) => {
        if (!viewingExpertise) return;
        const confirmed = window.confirm('Delete this question from the qualification test?');
        if (!confirmed) return;

        setDeletingQuestionIndex(questionIndex);
        try {
            const result = await deleteQualificationQuestion(viewingExpertise, questionIndex);
            if (result.success) {
                setViewingQuestions((prev) => prev.filter((_, idx) => idx !== questionIndex));
                setSummaries((prev) => {
                    const existing = prev[viewingExpertise];
                    if (!existing) return prev;
                    return {
                        ...prev,
                        [viewingExpertise]: {
                            ...existing,
                            questionCount: Math.max(0, existing.questionCount - 1),
                        },
                    };
                });
                toast({ title: 'Question deleted', description: 'The question was removed from this test bank.' });
            } else {
                toast({ title: 'Error', description: result.message || 'Failed to delete question.', variant: 'destructive' });
            }
        } catch (error) {
            console.error('Failed to delete qualification question:', error);
            toast({ title: 'Error', description: 'Failed to delete question.', variant: 'destructive' });
        } finally {
            setDeletingQuestionIndex(null);
            fetchSummaries();
        }
    };

    const handleGenerate = async (expertise: string) => {
        setGeneratingExpertise(expertise);
        try {
            const result = await generateAndSaveQualificationTest(expertise);
            if (result.success) {
                toast({ title: "Success", description: result.message});
                await fetchSummaries(); // Refresh the list
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "An unexpected error occurred while generating the test.", variant: "destructive" });
        } finally {
            setGeneratingExpertise(null);
        }
    };

    const handleToggle = async (expertise: string, isEnabled: boolean) => {
        setTogglingExpertise(expertise);
        try {
            const result = await toggleQualificationTestStatus(expertise, isEnabled);
            if (result.success) {
                toast({ title: "Success", description: result.message });
                // Optimistic update before refetching
                setSummaries(prev => ({
                    ...prev,
                    [expertise]: { ...(prev[expertise] || { questionCount: 0 }), isEnabled: isEnabled }
                }));
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        } catch (error) {
             toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
        } finally {
            setTogglingExpertise(null);
            fetchSummaries();
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Test Bank Status</CardTitle>
                <CardDescription>
                    Generate and manage the question banks for each expertise area. Users cannot take a test until a bank is generated and enabled.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? <LoadingSkeleton /> : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Expertise Area</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Question Count</TableHead>
                                <TableHead>Enabled</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {EXPERTISE_AREAS.map(expertise => {
                                const summary = summaries[expertise];
                                const hasQuestions = !!summary && summary.questionCount > 0;
                                const isEnabled = summary?.isEnabled ?? false;
                                
                                return (
                                <TableRow key={expertise}>
                                    <TableCell className="font-medium">{expertise}</TableCell>
                                    <TableCell>
                                        {hasQuestions ? (
                                            <Badge variant="secondary" className="text-green-600 border-green-200 bg-green-50">
                                                <CheckCircle className="mr-1 h-3 w-3" /> Generated
                                            </Badge>
                                        ) : (
                                             <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">
                                                <XCircle className="mr-1 h-3 w-3" /> Not Generated
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="font-medium">{summary?.questionCount || 0}</TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={isEnabled}
                                            onCheckedChange={(checked) => handleToggle(expertise, checked)}
                                            disabled={togglingExpertise === expertise || generatingExpertise === expertise}
                                            aria-label={`Enable ${expertise} test`}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => handleViewQuestions(expertise)}
                                                disabled={!hasQuestions || !!generatingExpertise || !!togglingExpertise}
                                            >
                                                <Eye className="mr-2 h-4 w-4" />
                                                View Questions
                                            </Button>
                                            <Button 
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleGenerate(expertise)}
                                                disabled={!!generatingExpertise || !!togglingExpertise}
                                            >
                                                {generatingExpertise === expertise ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Wand2 className="mr-2 h-4 w-4" />
                                                )}
                                                {hasQuestions ? 'Add 10 Questions' : 'Generate Test'}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                )}

                <Dialog open={questionsDialogOpen} onOpenChange={setQuestionsDialogOpen}>
                    <DialogContent className="max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Qualification Questions</DialogTitle>
                            <DialogDescription>
                                {viewingExpertise ? `Viewing test bank for ${viewingExpertise}.` : 'Viewing test bank.'}
                            </DialogDescription>
                        </DialogHeader>

                        {viewingQuestionsLoading ? (
                            <div className="space-y-3 py-2">
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-full" />
                            </div>
                        ) : viewingQuestions.length === 0 ? (
                            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                                No questions found for this expertise area yet.
                            </div>
                        ) : (
                            <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
                                {viewingQuestions.map((question, index) => (
                                    <div key={`${question.question}-${index}`} className="rounded-md border p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="text-sm font-semibold">{index + 1}. {question.question}</p>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteQuestion(index)}
                                                disabled={deletingQuestionIndex !== null}
                                                className="text-destructive hover:text-destructive"
                                            >
                                                {deletingQuestionIndex === index ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                        <ul className="mt-3 space-y-2">
                                            {question.options.map((option, optionIndex) => {
                                                const isCorrect = option === question.answer;
                                                return (
                                                    <li
                                                        key={`${option}-${optionIndex}`}
                                                        className={`flex items-center justify-between rounded-sm px-2 py-1 text-sm ${isCorrect ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                                                    >
                                                        <span>{option}</span>
                                                        {isCorrect ? <Badge variant="secondary">Correct</Badge> : null}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
