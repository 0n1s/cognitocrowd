"use client";

import { useState } from "react";
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
import { PlusCircle, Loader2, Wand2 } from "lucide-react";
import { generateTask } from "@/ai/flows/ai-task-generator";
import { useToast } from "@/hooks/use-toast";
import { createAdminTask, bulkCreateAdminTasks } from "@/lib/actions";

type AddTaskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function AddTaskDialog({ open, onOpenChange }: AddTaskDialogProps) {
  const { toast } = useToast();
  const [taskType, setTaskType] = useState<TaskType>("open_text_feedback");
  const [options, setOptions] = useState<string[]>([""]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState(100);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (!title) return;
    setIsGenerating(true);
    try {
        const result = await generateTask({ topic: title, taskType });
        setTitle(result.prompt);
        setDescription(result.description);
        if(result.options && result.options.length > 0) {
            setOptions(result.options);
        }
    } catch (e) {
        console.error(e);
        toast({ title: "AI Generation Failed", description: "Could not generate task content.", variant: "destructive" });
    } finally {
        setIsGenerating(false);
    }
  };
  
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPoints(100);
    setTaskType("open_text_feedback");
    setOptions([""]);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const result = await createAdminTask({
        title,
        description,
        points,
        type: taskType,
        options: taskType.includes('choice') || taskType.includes('ranking') || taskType.includes('label') ? options : [],
    });
    
    if (result.success) {
        toast({ title: "Success", description: result.message });
        onOpenChange(false);
        resetForm();
    } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-headline">Add New Task</DialogTitle>
          <DialogDescription>
            Configure the details for the new task. Use the title field to provide a topic for AI generation.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Title/Topic
            </Label>
            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} className="col-span-3" placeholder="e.g., 'Describe a sunset'" />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="description" className="text-right pt-2">
              Description
            </Label>
            <div className="col-span-3 space-y-2">
                <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="A detailed prompt for the user." />
                 <Button onClick={handleGenerate} disabled={isGenerating || !title} variant="outline" size="sm">
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
              Task Type
            </Label>
            <Select
              value={taskType}
              onValueChange={(value) => setTaskType(value as TaskType)}
            >
              <SelectTrigger id="task-type" className="col-span-3">
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open_text_feedback">Open Text Feedback</SelectItem>
                <SelectItem value="multiple_choice_preference">Multiple Choice</SelectItem>
                <SelectItem value="ranking">Ranking</SelectItem>
                <SelectItem value="classification">Classification</SelectItem>
                <SelectItem value="sentiment">Sentiment Analysis</SelectItem>
                <SelectItem value="topic_classification">Topic Classification</SelectItem>
                <SelectItem value="likert_scale">Likert Scale</SelectItem>
                <SelectItem value="compare_pairwise">Pairwise Comparison</SelectItem>
                <SelectItem value="label_multiple">Multi-label</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(taskType === "multiple_choice_preference" || taskType === "ranking" || taskType === "classification" || taskType === "sentiment" || taskType === "topic_classification" || taskType === "compare_pairwise" || taskType === "label_multiple") && (
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
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const TASK_TYPE_OPTIONS: { id: TaskType; label: string }[] = [
  { id: "open_text_feedback", label: "Open Text Feedback" },
  { id: "multiple_choice_preference", label: "Multiple Choice" },
  { id: "ranking", label: "Ranking" },
  { id: "classification", label: "Classification" },
  { id: "sentiment", label: "Sentiment Analysis" },
  { id: "topic_classification", label: "Topic Classification" },
  { id: "likert_scale", label: "Likert Scale" },
  { id: "compare_pairwise", label: "Pairwise Comparison" },
  { id: "label_multiple", label: "Multi-label" },
];

function AutoGenerateDialog({ open, onOpenChange }: AddTaskDialogProps) {
  const { toast } = useToast();
  const [count, setCount] = useState(5);
  const [selectedTypes, setSelectedTypes] = useState<TaskType[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleTypeChange = (type: TaskType) => {
    setSelectedTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
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
    if (count <= 0 || selectedTypes.length === 0) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid count and select at least one task type.",
        variant: "destructive",
      });
      return;
    }
    setIsGenerating(true);
    const result = await bulkCreateAdminTasks({
      count,
      taskTypes: selectedTypes,
    });
    if (result.success) {
      toast({ title: "Success", description: result.message });
      onOpenChange(false);
      setSelectedTypes([]);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsGenerating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-headline">Auto-generate Tasks</DialogTitle>
          <DialogDescription>
            Select the number of tasks and the types you want to generate.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div>
            <Label htmlFor="count">Number of Tasks (1-10)</Label>
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
            <Label>Task Types</Label>
            <div className="mt-2 space-y-2 p-3 border rounded-md max-h-60 overflow-y-auto">
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
                  <Label htmlFor={type.id}>{type.label}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleGenerate} disabled={isGenerating || count <= 0 || selectedTypes.length === 0}>
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


export function TaskList({ initialTasks }: { initialTasks: AdminTask[] }) {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isAutoGenerateDialogOpen, setIsAutoGenerateDialogOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle>All Tasks</CardTitle>
        <div className="flex gap-2">
            <Button onClick={() => setIsAutoGenerateDialogOpen(true)} variant="outline">
                <Wand2 className="mr-2 h-4 w-4" /> Auto-generate
            </Button>
            <Button onClick={() => setIsAddDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Task
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Points</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialTasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell className="font-medium">{task.title}</TableCell>
                <TableCell>{task.type}</TableCell>
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
         {initialTasks.length === 0 && (
            <div className="text-center p-8 text-muted-foreground">
                No tasks found. Click 'Add Task' to create one.
            </div>
        )}
      </CardContent>
       <AddTaskDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
       <AutoGenerateDialog open={isAutoGenerateDialogOpen} onOpenChange={setIsAutoGenerateDialogOpen} />
    </Card>
  );
}
