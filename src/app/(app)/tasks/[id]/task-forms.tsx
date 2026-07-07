

"use client";

import { Task, TaskOption, TaskSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useRef } from "react";
import { Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useDisplayCurrency } from "@/hooks/use-display-currency";

const AdditionalFeedback = ({ settings }: { settings?: TaskSettings }) => {
    if (!settings || (!settings.allow_comment && !settings.allow_confidence)) {
        return null;
    }

    return (
        <div className="mt-8 pt-6 border-t">
            <h3 className="text-lg font-semibold mb-4">Additional Feedback (Optional)</h3>
            <div className="space-y-6">
                {settings.allow_confidence && (
                    <div className="space-y-3">
                        <Label>How confident are you in your answer?</Label>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">Not Confident</span>
                            <Slider name="confidence" defaultValue={[50]} max={100} step={1} />
                            <span className="text-sm text-muted-foreground">Very Confident</span>
                        </div>
                    </div>
                )}
                {settings.allow_comment && (
                    <div className="space-y-2">
                        <Label htmlFor="comment">Comments</Label>
                        <Textarea id="comment" name="comment" placeholder="Add any comments here..." rows={3} />
                    </div>
                )}
            </div>
        </div>
    );
};

function getOptionText(option: TaskOption): string {
  if (typeof option === 'string') return option;
  if ('text' in option && typeof option.text === 'string') return option.text;
  if ('label' in option && typeof option.label === 'string') return option.label;
  return '';
}


export function TaskForms({ task }: { task: Task }) {
  const { toast } = useToast();
  const { formatAmount } = useDisplayCurrency();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  
  const initialRanking = task.type === 'ranking' ? task.options?.map(getOptionText).filter(Boolean) ?? [] : [];
  const [rankedItems, setRankedItems] = useState(initialRanking);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    dragItem.current = position;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    dragOverItem.current = position;
    e.currentTarget.classList.add('bg-accent');
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.currentTarget.classList.remove('bg-accent');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('bg-accent');
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
        dragItem.current = null;
        dragOverItem.current = null;
        return;
    }
    
    const newRankedItems = [...rankedItems];
    const dragItemContent = newRankedItems[dragItem.current];
    newRankedItems.splice(dragItem.current, 1);
    newRankedItems.splice(dragOverItem.current, 0, dragItemContent);
    
    dragItem.current = null;
    dragOverItem.current = null;
    
    setRankedItems(newRankedItems);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const buildResponseData = (taskType: Task["type"], formData: FormData) => {
    const responseData: Record<string, unknown> = {};

    if (taskType === "ranking") {
      formData.forEach((value, key) => {
        if (key !== "ranking") responseData[key] = value;
      });
      responseData.ranking = formData.getAll("ranking");
      return responseData;
    }

    if (taskType === "label_multiple") {
      const labels: string[] = [];
      formData.forEach((value, key) => {
        if (key.startsWith("label-")) {
          if (value === "on") labels.push(key.replace("label-", ""));
        } else {
          responseData[key] = value;
        }
      });
      responseData.labels = labels;
      return responseData;
    }

    formData.forEach((value, key) => {
      responseData[key] = value;
    });
    return responseData;
  };


  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    
    if (!user) {
        toast({ title: "Authentication Error", description: "You must be logged in to submit a contribution.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    const formData = new FormData(event.currentTarget);
    
    if (task.type === 'ranking') {
        rankedItems.forEach(item => {
            formData.append('ranking', item);
        });
    }
    
    if (!auth?.currentUser) {
      toast({
        title: "Authentication Error",
        description: "Session expired. Please log in again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    const responseData = buildResponseData(task.type, formData);

    let result: {
      success: boolean;
      message?: string;
      nextTaskId?: string | null;
      earnings?: number;
      pointsEarned?: number;
      maxPoints?: number;
      scorePercent?: number;
    };
    try {
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch('/api/tasks/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          taskId: task.id,
          taskType: task.type,
          responseData,
        }),
      });

      result = await response.json();
      if (!response.ok && result.success !== false) {
        result = { success: false, message: 'Failed to submit contribution.' };
      }
    } catch {
      result = { success: false, message: 'Network error while submitting contribution.' };
    }

    if (result.success) {
      const scorePercent = typeof result.scorePercent === 'number' ? result.scorePercent : 100;
      const amountEarned = typeof result.earnings === 'number'
        ? result.earnings
        : typeof result.pointsEarned === 'number'
        ? result.pointsEarned / 100
        : task.points / 100;
        toast({
            title: "Contribution Submitted!",
        description: `Accuracy: ${scorePercent}%. Amount earned: ${formatAmount(amountEarned, 'USD')}. Loading next contribution...`,
        });

        // Redirect to the next available task, or back to the list if none are left.
        setTimeout(() => {
            if ('nextTaskId' in result && result.nextTaskId) {
                router.push(`/tasks/${result.nextTaskId}`);
            } else {
                toast({
                    title: "All done for now!",
                    description: "You have completed all available contributions. Check back later.",
                });
                router.push('/dashboard');
            }
        }, 1500);
    } else {
        toast({
            title: "Submission Failed",
            description: result.message,
            variant: "destructive",
        });
        setIsSubmitting(false);
    }
  };
  
  const renderForm = () => {
    let formContent;
    switch (task.type) {
      case "open_text_feedback":
        formContent = (
            <Textarea
              name="feedback"
              placeholder="Type your feedback here..."
              rows={8}
              required
              minLength={task.settings?.min_chars}
              maxLength={task.settings?.max_chars}
            />
        );
        break;
      case "multiple_choice_preference":
        formContent = (
          <RadioGroup name="preference" required>
            {task.options?.map((option, index) => {
              const optText = typeof option === 'string' ? option : (option as { text: string }).text;
              return (
                <div key={index} className="flex items-center space-x-2 p-3 border rounded-md">
                  <RadioGroupItem value={optText} id={`option-${index}`} />
                  <Label htmlFor={`option-${index}`}>{optText}</Label>
                </div>
              )
            })}
          </RadioGroup>
        );
        break;
      case "classification":
      case "sentiment":
      case "topic_classification":
        formContent = (
          <RadioGroup name="classification" required>
            {task.options?.map((option, index) => {
              const optionText = getOptionText(option);
              return (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={optionText} id={`option-${index}`} />
                <Label htmlFor={`option-${index}`}>{optionText}</Label>
              </div>
            )})}
          </RadioGroup>
        );
        break;
      case "ranking":
        formContent = (
          <>
            <p className="text-muted-foreground">Drag and drop to rank the items (1 is highest).</p>
            <div className="space-y-2">
                {rankedItems.map((option, index) => (
                    <div
                    key={option}
                        className="flex items-center p-3 border rounded-md bg-muted cursor-grab transition-colors active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnter={(e) => handleDragEnter(e, index)}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                      >
                        <span className="font-bold mr-4 text-muted-foreground">{index + 1}</span>
                        <span>{option}</span>
                    </div>
                ))}
            </div>
          </>
        );
        break;
        case "likert_scale": {
          const scale = task.scale ?? {
            min: 1,
            max: 5,
            labels: [
              { value: 1, label: 'Low' },
              { value: 5, label: 'High' },
            ],
          };
        const scaleOptions = Array.from({ length: scale.max - scale.min + 1 }, (_, i) => scale.min + i);
        
        let minLabel: string;
        let maxLabel: string;

        if (Array.isArray(scale.labels)) {
          minLabel = scale.labels.find(l => l.value === scale.min)?.label || scale.min.toString();
          maxLabel = scale.labels.find(l => l.value === scale.max)?.label || scale.max.toString();
        } else {
          // Handle old object format for backward compatibility
          const labelsObject = scale.labels as unknown as Record<string, string>;
          minLabel = labelsObject?.[scale.min] || scale.min.toString();
          maxLabel = labelsObject?.[scale.max] || scale.max.toString();
        }

        formContent = (
          <>
            <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
              <span>{minLabel}</span>
              <span>{maxLabel}</span>
            </div>
            <RadioGroup name="likert" required className="flex justify-between items-center bg-muted p-2 rounded-lg">
              {scaleOptions.map(value => (
                <div key={value} className="flex flex-col items-center space-y-1">
                   <Label htmlFor={`scale-${value}`} className="text-xs">{value}</Label>
                  <RadioGroupItem value={value.toString()} id={`scale-${value}`} />
                </div>
              ))}
            </RadioGroup>
          </>
        );
        break;
        }
      case "compare_pairwise":
        formContent = (
          <RadioGroup name="comparison" required className="space-y-4">
            {task.options?.map((option, index) => {
              const opt = option as { label: string; text: string };
              return (
                <div key={index} className="flex items-start space-x-3 rounded-md border p-4 has-[:checked]:border-primary">
                  <RadioGroupItem value={opt.label} id={`option-${index}`} className="mt-1" />
                  <div className="grid gap-1.5">
                    <Label htmlFor={`option-${index}`} className="font-bold">{opt.label}</Label>
                    <p className="text-sm text-muted-foreground">{opt.text}</p>
                  </div>
                </div>
              );
            })}
          </RadioGroup>
        );
        break;
       case "label_multiple":
        formContent = (
          <div className="space-y-2">
            {task.options?.map((option, index) => {
              const optionText = getOptionText(option);
              return (
              <div key={index} className="flex items-center space-x-2">
                <Checkbox name={`label-${optionText}`} id={`option-${index}`} />
                <Label htmlFor={`option-${index}`}>{optionText}</Label>
              </div>
            )})}
          </div>
        );
        break;
      default:
        formContent = <p>This task type is not supported yet.</p>;
    }
    
    return (
       <form onSubmit={handleSubmit} className="space-y-6">
            {formContent}
            <AdditionalFeedback settings={task.settings} />
            <Button type="submit" className="mt-4" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Response
            </Button>
        </form>
    )
  };

  return <div className="mt-6">
    <Separator className="mb-6"/>
    <h3 className="text-lg font-semibold mb-4">Your Response</h3>
    {renderForm()}
  </div>;
}
