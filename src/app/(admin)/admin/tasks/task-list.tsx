
"use client";

import { useState, useEffect } from "react";
import { AdminTask, TaskType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Loader2, Wand2, Clipboard } from "lucide-react";
import { generateTask } from "@/ai/flows/ai-task-generator";
import { useToast } from "@/hooks/use-toast";
import { createAdminTask, bulkCreateAdminTasks } from "@/lib/actions";
import { getAdminTasks } from "@/lib/database";

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

const TASK_TYPE_OPTIONS: { id: TaskType; label: string }[] = [
  { id: "open_text_feedback", label: "Open Text Feedback" },
  { id: "multiple_choice_preference", label: "Multiple Choice" },
  { id: "ranking", label: "Ranking" },
  { id: "classification", label: "Classification" },
  { id: "likert_scale", label: "Likert Scale" },
  { id: "sentiment", label: "Sentiment Analysis" },
  { id: "topic_classification", label: "Topic Classification" },
  { id: "compare_pairwise", label: "Pairwise Comparison" },
  { id: "label_multiple", label: "Multi-Labeling" },
];

type AddTaskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated: () => void;
};

function AddTaskDialog({ open, onOpenChange, onTaskCreated }: AddTaskDialogProps) {
  const { toast } = useToast();
  const [taskType, setTaskType] = useState<TaskType>("open_text_feedback");
  const [expertise, setExpertise] = useState<string>("general");
  const [options, setOptions] = useState<string[]>([""]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState(100);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCopyError = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        toast({
          title: "Copied!",
          description: "Error details have been copied to your clipboard.",
        });
      },
      (err) => {
        toast({
          title: "Copy Failed",
          description: "Could not copy error to clipboard.",
          variant: "destructive",
        });
        console.error("Failed to copy text: ", err);
      }
    );
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => setOptions([...options, ""]);
  const removeOption = (index: number) => {
    if (options.length > 1) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleGenerate = async () => {
    if (!title || !expertise) {
        toast({ title: "Missing Info", description: "Please provide a topic and select an expertise to generate with AI.", variant: "destructive" });
        return;
    }
    setIsGenerating(true);
    try {
        const result = await generateTask({ topic: title, taskType, expertise });
        setTitle(result.prompt);
        setDescription(result.description);
        if (result.points) {
            setPoints(result.points);
        }
        if(result.options && result.options.length > 0) {
            const stringOptions = result.options.map(opt => {
                if (typeof opt === 'string') return opt;
                if (typeof opt === 'object' && opt !== null && 'text' in opt) return (opt as { text: string }).text;
                if (typeof opt === 'object' && opt !== null && 'label' in opt) return (opt as { label: string }).label;
                return '';
            }).filter(Boolean);
            setOptions(stringOptions.length > 0 ? stringOptions : ['']);
        }
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
        toast({
            title: "AI Generation Failed",
            variant: "destructive",
            duration: Infinity,
            description: (
                <div className="w-full">
                    <div className="flex justify-start items-center gap-4 mb-2">
                        <Button variant="ghost" size="sm" onClick={() => handleCopyError(errorMessage)}>
                            <Clipboard className="mr-2 h-4 w-4" /> Copy
                        </Button>
                        <p>The AI model returned an error:</p>
                    </div>
                    <pre className="mt-1 w-full rounded-md bg-destructive/20 p-2 font-mono text-sm text-destructive-foreground whitespace-pre-wrap">
                        {errorMessage}
                    </pre>
                </div>
            )
        });
    } finally {
        setIsGenerating(false);
    }
  };
  
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPoints(100);
    setTaskType("open_text_feedback");
    setExpertise("general");
    setOptions([""]);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const result = await createAdminTask({
        title,
        description,
        points,
        type: taskType,
        options: taskType.includes('choice') || taskType.includes('ranking') || taskType.includes('classification') ? options.filter(o => o.trim() !== '') : [],
        expertise: expertise === 'general' ? '' : expertise,
    });
    
    if (result.success) {
        toast({ title: "Success", description: result.message });
        onOpenChange(false);
        resetForm();
        onTaskCreated();
    } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-headline">Add New Contribution</DialogTitle>
          <DialogDescription>
            Configure the details for the new contribution. Use the title/topic and expertise to generate with AI.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Title/Topic
            </Label>
            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} className="col-span-3" placeholder="e.g., 'The ethics of AI in art'" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="expertise-add" className="text-right">
              Expertise
            </Label>
            <Select value={expertise} onValueChange={setExpertise}>
              <SelectTrigger id="expertise-add" className="col-span-3">
                <SelectValue placeholder="Select an expertise" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General (for all users)</SelectItem>
                {EXPERTISE_AREAS.map(area => (
                    <SelectItem key={area} value={area}>{area}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="description" className="text-right pt-2">
              Description
            </Label>
            <div className="col-span-3 space-y-2">
                <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="A detailed prompt for the user." />
                 <Button onClick={handleGenerate} disabled={isGenerating || !title || !expertise} variant="outline" size="sm">
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                    Generate with AI
                </Button>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="points" className="text-right">
              Points
            </Label>
            <Input id="points" type="number" value={points} onChange={e => setPoints(Number(e.target.value))} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="task-type" className="text-right">
              Contribution Type
            </Label>
            <Select
              value={taskType}
              onValueChange={(value) => setTaskType(value as TaskType)}
            >
              <SelectTrigger id="task-type" className="col-span-3">
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPE_OPTIONS.map(opt => (
                    <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(taskType === "multiple_choice_preference" || taskType === "ranking" || taskType === "classification") && (
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right pt-2">Options</Label>
              <div className="col-span-3 space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(index)}
                      disabled={options.length <= 1}
                    >
                      &times;
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addOption}>
                  Add Option
                </Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting || isGenerating}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Contribution
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type AutoGenerateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTasksGenerated: () => void;
};


function AutoGenerateDialog({ open, onOpenChange, onTasksGenerated }: AutoGenerateDialogProps) {
  const { toast } = useToast();
  const [count, setCount] = useState(5);
  const [expertise, setExpertise] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<TaskType[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleCopyError = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        toast({
          title: "Copied!",
          description: "Error details have been copied to your clipboard.",
        });
      },
      (err) => {
        toast({
          title: "Copy Failed",
          description: "Could not copy error to clipboard.",
          variant: "destructive",
        });
        console.error("Failed to copy text: ", err);
      }
    );
  };

  const handleTypeChange = (type: TaskType) => {
    setSelectedTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  };

  const handleExpertiseChange = (area: string) => {
    setExpertise((prev) =>
      prev.includes(area)
        ? prev.filter((a) => a !== area)
        : [...prev, area]
    );
  };
  
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTypes(TASK_TYPE_OPTIONS.map(t => t.id));
    } else {
      setSelectedTypes([]);
    }
  }

  const handleGenerate = async () => {
    if (count <= 0 || expertise.length === 0 || selectedTypes.length === 0) {
      toast({
        title: "Invalid Input",
        description: "Please provide a count, select at least one expertise, and choose at least one contribution type.",
        variant: "destructive",
      });
      return;
    }
    setIsGenerating(true);
    try {
      const result = await bulkCreateAdminTasks({
        count,
        expertise,
        taskTypes: selectedTypes,
      });

      if (result.success) {
        toast({ title: "Success", description: result.message });
        onOpenChange(false);
        setExpertise([]);
        setSelectedTypes([]);
        onTasksGenerated();
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
        toast({
            title: "Generation Failed",
            variant: "destructive",
            duration: Infinity,
            description: (
                <div className="w-full">
                    <div className="flex justify-start items-center gap-4 mb-2">
                      <Button variant="ghost" size="sm" onClick={() => handleCopyError(errorMessage)}>
                          <Clipboard className="mr-2 h-4 w-4" /> Copy
                      </Button>
                      <p>The AI model returned an error:</p>
                    </div>
                    <pre className="mt-1 w-full rounded-md bg-destructive/20 p-2 font-mono text-sm text-destructive-foreground whitespace-pre-wrap">
                        {errorMessage}
                    </pre>
                </div>
            )
        });
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-headline">Bulk Generate Contributions with AI</DialogTitle>
          <DialogDescription>
            Select the number of contributions, their types, and the expertise area for generation.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div>
            <Label htmlFor="count">Number of Contributions (1-10)</Label>
            <Input
              id="count"
              type="number"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              min="1"
              max="10"
              className="mt-2"
            />
          </div>
           <div>
            <Label>Expertise Areas</Label>
            <div className="mt-2 space-y-2 p-3 border rounded-md max-h-40 overflow-y-auto">
              {EXPERTISE_AREAS.map((area) => (
                <div key={area} className="flex items-center space-x-2">
                  <Checkbox
                    id={`bulk-${area}`}
                    checked={expertise.includes(area)}
                    onCheckedChange={() => handleExpertiseChange(area)}
                  />
                  <Label htmlFor={`bulk-${area}`} className="font-normal">{area}</Label>
                </div>
              ))}
            </div>
          </div>
           <div>
            <Label>Contribution Types</Label>
            <div className="mt-2 space-y-2 p-3 border rounded-md max-h-40 overflow-y-auto">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="select-all" 
                  onCheckedChange={(checked) => handleSelectAll(checked === true)}
                  checked={selectedTypes.length === TASK_TYPE_OPTIONS.length}
                />
                <Label htmlFor="select-all" className="font-bold">Select All</Label>
              </div>
              {TASK_TYPE_OPTIONS.map((type) => (
                <div key={type.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={type.id}
                    checked={selectedTypes.includes(type.id)}
                    onCheckedChange={() => handleTypeChange(type.id)}
                  />
                  <Label htmlFor={type.id} className="font-normal">{type.label}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleGenerate} disabled={isGenerating || count <= 0 || expertise.length === 0 || selectedTypes.length === 0}>
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const LoadingSkeleton = () => (
    <Table>
        <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Expertise</TableHead>
              <TableHead>Points</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-28 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell></TableCell>
                </TableRow>
            ))}
        </TableBody>
    </Table>
)


export function TaskList() {
    const [tasks, setTasks] = useState<AdminTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isAutoGenerateDialogOpen, setIsAutoGenerateDialogOpen] = useState(false);

    const fetchTasks = async () => {
      setLoading(true);
      try {
        const fetchedTasks = await getAdminTasks();
        setTasks(fetchedTasks);
      } catch (error) {
        console.error("Failed to fetch contributions:", error);
      } finally {
        setLoading(false);
      }
    };
    
    useEffect(() => {
        fetchTasks();
    }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle>All Contributions</CardTitle>
        <div className="flex gap-2">
            <Button onClick={() => setIsAutoGenerateDialogOpen(true)} variant="outline">
                <Wand2 className="mr-2 h-4 w-4" /> Bulk Generate
            </Button>
            <Button onClick={() => setIsAddDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Contribution
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <LoadingSkeleton /> : (
            <>
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Expertise</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                        <span className="sr-only">Actions</span>
                    </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tasks.map((task) => (
                    <TableRow key={task.id}>
                        <TableCell className="font-medium">{task.title}</TableCell>
                        <TableCell>{task.type}</TableCell>
                        <TableCell>
                            <Badge variant="outline">{task.expertise || 'General'}</Badge>
                        </TableCell>
                        <TableCell>{task.points}</TableCell>
                        <TableCell>
                        <Badge variant={task.status === "Active" ? "secondary" : "outline"}>
                            {task.status}
                        </Badge>
                        </TableCell>
                        <TableCell>
                        {/* Action buttons can go here */}
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
                {tasks.length === 0 && (
                    <div className="text-center p-8 text-muted-foreground">
                        No contributions found. Click 'Add Contribution' to create one.
                    </div>
                )}
            </>
        )}
      </CardContent>
       <AddTaskDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onTaskCreated={fetchTasks} />
       <AutoGenerateDialog open={isAutoGenerateDialogOpen} onOpenChange={setIsAutoGenerateDialogOpen} onTasksGenerated={fetchTasks} />
    </Card>
  );
}
