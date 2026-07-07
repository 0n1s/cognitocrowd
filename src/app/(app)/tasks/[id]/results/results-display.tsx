
"use client";

import { Task, TaskResponse, TaskOption } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { useMemo } from "react";
import { useDisplayCurrency } from "@/hooks/use-display-currency";

// Helper function to format response data for display
const formatResponseData = (responseData: Record<string, any>, taskType: Task['type']): string => {
    switch (taskType) {
        case 'open_text_feedback':
            return responseData.feedback;
        case 'multiple_choice_preference':
            return responseData.preference;
        case 'ranking':
            return (responseData.ranking || []).map((item: string, i: number) => `${i + 1}. ${item}`).join('\n');
        case 'classification':
        case 'sentiment':
        case 'topic_classification':
            return responseData.classification;
        case 'likert_scale':
            return `Rated: ${responseData.likert}`;
        case 'compare_pairwise':
            return `Selected: ${responseData.comparison}`;
        case 'label_multiple':
            return (responseData.labels || []).join(', ');
        default:
            return JSON.stringify(responseData);
    }
};

const getOptionText = (option: TaskOption): string => {
    if (typeof option === 'string') return option;
    if ('text' in option) return option.text;
    if ('label' in option) return option.label;
    return '';
};

const ResultsDisplay = ({ task, responses, userId }: { task: Task; responses: TaskResponse[]; userId: string }) => {
    const { formatAmount } = useDisplayCurrency();
    const currentUserResponse = useMemo(() => responses.find(r => r.userId === userId), [responses, userId]);

    const aggregatedData = useMemo(() => {
        const counts: { [key: string]: number } = {};
        
        switch (task.type) {
            case 'multiple_choice_preference':
            case 'compare_pairwise':
            case 'classification':
            case 'sentiment':
            case 'topic_classification':
                const key = task.type === 'multiple_choice_preference' ? 'preference' : task.type === 'compare_pairwise' ? 'comparison' : 'classification';
                (task.options || []).forEach(opt => {
                    counts[getOptionText(opt)] = 0;
                });
                responses.forEach(res => {
                    const answer = res.responseData[key];
                    if (answer in counts) {
                        counts[answer]++;
                    }
                });
                return Object.entries(counts).map(([name, value]) => ({ name, count: value }));

            case 'label_multiple':
                (task.options || []).forEach(opt => {
                    counts[getOptionText(opt)] = 0;
                });
                responses.forEach(res => {
                   (res.responseData.labels || []).forEach((label: string) => {
                       if (label in counts) counts[label]++;
                   });
                });
                 return Object.entries(counts).map(([name, value]) => ({ name, count: value }));
            
            case 'likert_scale':
                if (!task.scale) return [];
                for(let i = task.scale.min; i <= task.scale.max; i++) {
                    counts[i.toString()] = 0;
                }
                responses.forEach(res => {
                    const answer = res.responseData.likert;
                    if(answer in counts) counts[answer]++;
                });
                return Object.entries(counts).map(([name, value]) => ({ name: `Score ${name}`, count: value }));

            default:
                return null;
        }
    }, [task, responses]);

    const renderChart = () => {
        if (!aggregatedData) {
            return (
                 <Card>
                    <CardHeader>
                        <CardTitle>Response Summary</CardTitle>
                        <CardDescription>A summary of responses will be shown here once more data is collected.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">This task type does not support aggregated charts.</p>
                    </CardContent>
                </Card>
            );
        }

        return (
            <Card>
                <CardHeader>
                    <CardTitle>Response Summary</CardTitle>
                    <CardDescription>How everyone responded to this task.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={aggregatedData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip
                                contentStyle={{
                                    background: "hsl(var(--background))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "var(--radius)"
                                }}
                            />
                            <Legend />
                            <Bar dataKey="count" fill="hsl(var(--primary))" name="Total Votes">
                               <LabelList dataKey="count" position="top" />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="space-y-8">
            <Card className="bg-secondary">
                <CardHeader>
                    <CardTitle>Thank you for your submission!</CardTitle>
                    <CardDescription>Your contribution helps improve AI models.</CardDescription>
                </CardHeader>
                {currentUserResponse && (
                    <CardContent>
                        <h4 className="font-semibold mb-2">Your Response:</h4>
                        <p className="text-muted-foreground whitespace-pre-wrap">{formatResponseData(currentUserResponse.responseData, task.type)}</p>
                        {currentUserResponse.rank && (
                            <div className="mt-4 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Badge variant="default" className="flex items-center gap-1">
                                        <Star className="h-4 w-4" />
                                        AI Rank: {currentUserResponse.rank} / 10
                                    </Badge>
                                    {typeof currentUserResponse.scorePercent === 'number' ? (
                                        <Badge variant="secondary">Score: {currentUserResponse.scorePercent}%</Badge>
                                    ) : null}
                                    <p className="text-sm text-muted-foreground italic">"{currentUserResponse.rankExplanation}"</p>
                                </div>
                                {typeof currentUserResponse.scorePercent === 'number' ? (
                                    <p className="text-xs text-muted-foreground">
                                        Accuracy: {currentUserResponse.scorePercent}% | Amount earned: {formatAmount((currentUserResponse.pointsEarned || 0) / 100, 'USD')}
                                    </p>
                                ) : null}
                                {currentUserResponse.verificationExplanation ? (
                                    <p className="text-xs text-muted-foreground">Verification: {currentUserResponse.verificationExplanation}</p>
                                ) : null}
                            </div>
                        )}
                    </CardContent>
                )}
            </Card>

            {renderChart()}

        </div>
    );
};

export { ResultsDisplay };
