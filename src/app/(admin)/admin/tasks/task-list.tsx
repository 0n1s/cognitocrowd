
"use client";

import { useState, useEffect, useMemo } from "react";
import { Task, TaskType, TaskOption, AppSettings } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Loader2, Wand2, Clipboard, Eye, PauseCircle, PlayCircle, Trash2, ListChecks, Check, ChevronsUpDown } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { generateTask } from "@/ai/flows/ai-task-generator";
import { useToast } from "@/hooks/use-toast";
import { createAdminTask, bulkCreateAdminTasks, deleteAdminTask, updateAdminTaskStatus, deleteAllAdminTasks } from "@/lib/admin-api";
import { getAdminTasks, getAppSettings } from "@/lib/database";
import { getFallbackModel } from "@/ai/model-resolver";
import { format } from "date-fns";

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

const TASKS_PER_PAGE = 10;

const LAST_USED_CONTRIBUTION_MODEL_KEY = "admin-contribution-last-model";

type ModelOption = {
  id: string;
  name: string;
  modalities: string[];
};

function getContributionTextModelOptions(settings: AppSettings): ModelOption[] {
  const options = new Map<string, ModelOption>();

  const addOption = (id: string, name?: string, modalities: string[] = ["text"]) => {
    const normalizedId = String(id || "").trim();
    if (!normalizedId || options.has(normalizedId)) {
      return;
    }

    options.set(normalizedId, {
      id: normalizedId,
      name: name?.trim() || normalizedId,
      modalities: modalities.length > 0 ? modalities : ["text"],
    });
  };

  (settings.aiProviders || []).forEach((provider) => {
    if (!provider.baseUrl?.trim() || provider.supportsText === false) {
      return;
    }

    (provider.discoveredModels || []).forEach((modelId) => {
      const normalizedModelId = String(modelId || "").trim();
      if (!normalizedModelId) {
        return;
      }

      const modalities = provider.discoveredModelModalities?.[normalizedModelId];
      if (Array.isArray(modalities) && modalities.length > 0 && !modalities.includes("text")) {
        return;
      }

      addOption(
        `${provider.id}/${normalizedModelId}`,
        `${provider.name} - ${normalizedModelId}`,
        Array.isArray(modalities) && modalities.length > 0 ? modalities : ["text"]
      );
    });
  });

  [settings.defaultTextGenAiModel, settings.defaultGenAiModel, getFallbackModel("text")].forEach((modelId) => {
    const normalizedModelId = String(modelId || "").trim();
    if (!normalizedModelId) {
      return;
    }

    addOption(
      normalizedModelId,
      options.has(normalizedModelId) ? options.get(normalizedModelId)?.name : `Default - ${normalizedModelId}`,
      options.get(normalizedModelId)?.modalities || ["text"]
    );
  });

  return Array.from(options.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function ModelSelectField({
  id,
  modelOptions,
  selectedModel,
  onSelectedModelChange,
  disabled,
  placeholder,
  searchPlaceholder,
}: {
  id: string;
  modelOptions: ModelOption[];
  selectedModel: string;
  onSelectedModelChange: (value: string) => void;
  disabled: boolean;
  placeholder: string;
  searchPlaceholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedOption = useMemo(
    () => modelOptions.find((option) => option.id === selectedModel),
    [modelOptions, selectedModel]
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return modelOptions;
    }

    return modelOptions.filter((option) => {
      const haystack = `${option.name} ${option.id}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [modelOptions, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between"
        >
          <div className="min-w-0 text-left">
            <div className="truncate">{selectedOption?.name || placeholder}</div>
            {selectedOption?.modalities?.length ? (
              <div className="truncate text-xs text-muted-foreground">
                {selectedOption.modalities.map((modality) => modality.toUpperCase()).join(" • ")}
              </div>
            ) : null}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-3" align="start">
        <div className="space-y-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            autoComplete="off"
          />
          <ScrollArea className="h-64 pr-3">
            <div className="space-y-1">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => {
                  const isSelected = option.id === selectedModel;
                  return (
                    <Button
                      key={option.id}
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-start gap-2 px-2 py-2 text-left"
                      onClick={() => {
                        onSelectedModelChange(option.id);
                        setOpen(false);
                      }}
                    >
                      <Check className={`h-4 w-4 shrink-0 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{option.name}</div>
                        {option.modalities.length > 0 ? (
                          <div className="truncate text-xs text-muted-foreground">
                            {option.modalities.map((modality) => modality.toUpperCase()).join(" • ")}
                          </div>
                        ) : null}
                        <div className="truncate text-xs text-muted-foreground">{option.id}</div>
                      </div>
                    </Button>
                  );
                })
              ) : (
                <p className="px-2 py-3 text-sm text-muted-foreground">No models match your filter.</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Add/Edit Task Dialogs (no changes needed here, keeping them for context)

function AddTaskDialog({
  open,
  onOpenChange,
  onTaskCreated,
  modelOptions,
  selectedModel,
  onSelectedModelChange,
  modelsLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated: () => void;
  modelOptions: ModelOption[];
  selectedModel: string;
  onSelectedModelChange: (value: string) => void;
  modelsLoading: boolean;
}) {
  const { toast } = useToast();
  const [taskType, setTaskType] = useState<TaskType>("open_text_feedback");
  const [expertise, setExpertise] = useState<string>("General");
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
        const result = await generateTask({ topic: title, taskType, expertise, model: selectedModel || undefined });
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
        } else if (taskType === "multiple_choice_preference" || taskType === "ranking" || taskType === "classification") {
            setOptions(['']); // Reset to empty if AI fails to return options for relevant types
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
    setExpertise("General");
    setOptions([""]);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const result = await createAdminTask({
        title,
        description,
        points,
        type: taskType,
        options: taskType === "multiple_choice_preference" || taskType === "ranking" || taskType === "classification" ? options.filter(o => o.trim() !== '') : [],
        expertise: expertise,
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
                <SelectItem value="General">General (for all users)</SelectItem>
                {EXPERTISE_AREAS.map(area => (
                    <SelectItem key={area} value={area}>{area}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="contribution-model-add" className="text-right">
              AI Model
            </Label>
            <div className="col-span-3 space-y-2">
              <ModelSelectField
                id="contribution-model-add"
                modelOptions={modelOptions}
                selectedModel={selectedModel}
                onSelectedModelChange={onSelectedModelChange}
                disabled={modelsLoading || modelOptions.length === 0}
                placeholder={modelsLoading ? "Loading models..." : "Select a text model"}
                searchPlaceholder="Filter models..."
              />
              <p className="text-xs text-muted-foreground">The last selected model is remembered for future AI contribution generation.</p>
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="description" className="text-right pt-2">
              Description
            </Label>
            <div className="col-span-3 space-y-2">
                <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="A detailed prompt for the user." />
                 <Button onClick={handleGenerate} disabled={isGenerating || modelsLoading || !selectedModel || !title || !expertise} variant="outline" size="sm">
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

function AutoGenerateDialog({
  open,
  onOpenChange,
  onTasksGenerated,
  modelOptions,
  selectedModel,
  onSelectedModelChange,
  modelsLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTasksGenerated: () => void;
  modelOptions: ModelOption[];
  selectedModel: string;
  onSelectedModelChange: (value: string) => void;
  modelsLoading: boolean;
}) {
  const { toast } = useToast();
  const [count, setCount] = useState(5);
  const [minPoints, setMinPoints] = useState(50);
  const [maxPoints, setMaxPoints] = useState(300);
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

    if (minPoints <= 0 || maxPoints <= 0 || minPoints > maxPoints) {
      toast({
        title: "Invalid Points Range",
        description: "Please provide a valid points range where min is less than or equal to max.",
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
        minPoints,
        maxPoints,
        model: selectedModel || undefined,
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="min-points">Min Points</Label>
              <Input
                id="min-points"
                type="number"
                value={minPoints}
                onChange={(e) => setMinPoints(Number(e.target.value))}
                min="1"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="max-points">Max Points</Label>
              <Input
                id="max-points"
                type="number"
                value={maxPoints}
                onChange={(e) => setMaxPoints(Number(e.target.value))}
                min="1"
                className="mt-2"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="bulk-contribution-model">AI Model</Label>
            <div className="mt-2">
              <ModelSelectField
                id="bulk-contribution-model"
                modelOptions={modelOptions}
                selectedModel={selectedModel}
                onSelectedModelChange={onSelectedModelChange}
                disabled={modelsLoading || modelOptions.length === 0}
                placeholder={modelsLoading ? "Loading models..." : "Select a text model"}
                searchPlaceholder="Filter models..."
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">The last selected model is reused the next time you generate contributions.</p>
          </div>
           <div>
            <Label>Expertise Areas</Label>
            <div className="mt-2 space-y-2 p-3 border rounded-md max-h-40 overflow-y-auto">
              {["General", ...EXPERTISE_AREAS].map((area) => (
                <div key={area} className="flex items-center space-x-2">
                  <Checkbox
                    id={`bulk-${area}`}
                    checked={expertise.includes(area)}
                    onCheckedChange={() => handleExpertiseChange(area)}
                  />
                  <Label htmlFor={`bulk-${area}`} className="font-normal">{area === 'General' ? 'General (for all users)' : area}</Label>
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
          <Button onClick={handleGenerate} disabled={isGenerating || modelsLoading || !selectedModel || count <= 0 || expertise.length === 0 || selectedTypes.length === 0}>
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// New Dialogs for View and Delete

const getOptionText = (option: TaskOption): string => {
    if (typeof option === 'string') return option;
    if (typeof option === 'object' && option !== null && 'text' in option) return (option as { text: string }).text;
    if (typeof option === 'object' && option !== null && 'label' in option) return (option as { label: string }).label;
    return '';
};

function TaskPreview({ task }: { task: Task }) {
  const getRankedItems = (task: Task) => task.options?.map(opt => getOptionText(opt)) ?? [];
  const noOptionsMessage = <p className="text-muted-foreground text-center p-4 border rounded-md">No options have been configured for this contribution.</p>;

  switch (task.type) {
    case 'open_text_feedback':
      return <Textarea placeholder="User feedback will appear here." disabled />;
    
    case 'multiple_choice_preference':
    case 'classification':
    case 'sentiment':
    case 'topic_classification':
      if (!task.options || task.options.length === 0) return noOptionsMessage;
      return (
        <RadioGroup disabled>
          {task.options?.map((option, index) => (
            <div key={index} className="flex items-center space-x-2 p-3 border rounded-md">
              <RadioGroupItem value={getOptionText(option)} id={`preview-${task.id}-${index}`} />
              <Label htmlFor={`preview-${task.id}-${index}`}>{getOptionText(option)}</Label>
            </div>
          ))}
        </RadioGroup>
      );

    case 'ranking':
      const rankedItems = getRankedItems(task);
      if (rankedItems.length === 0) return noOptionsMessage;
      return (
        <div className="space-y-2">
          {rankedItems.map((item, index) => (
            <div key={index} className="flex items-center p-3 border rounded-md bg-muted">
              <span className="font-bold mr-4 text-muted-foreground">{index + 1}</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      );
    
    case 'likert_scale':
        if (!task.scale) return <p>Task configuration error.</p>;
        const scaleOptions = Array.from({ length: task.scale.max - task.scale.min + 1 }, (_, i) => task.scale.min + i);

        let minLabel: string;
        let maxLabel: string;

        if (Array.isArray(task.scale.labels)) {
            minLabel = task.scale.labels.find(l => l.value === task.scale.min)?.label || task.scale.min.toString();
            maxLabel = task.scale.labels.find(l => l.value === task.scale.max)?.label || task.scale.max.toString();
        } else {
            // Handle old object format for backward compatibility
            const labelsObject = task.scale.labels as unknown as Record<string, string>;
            minLabel = labelsObject?.[task.scale.min] || task.scale.min.toString();
            maxLabel = labelsObject?.[task.scale.max] || task.scale.max.toString();
        }

        return (
            <>
                <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
                    <span>{minLabel}</span>
                    <span>{maxLabel}</span>
                </div>
                <RadioGroup disabled className="flex justify-between items-center bg-muted p-2 rounded-lg">
                    {scaleOptions.map(value => (
                        <div key={value} className="flex flex-col items-center space-y-1">
                              <Label htmlFor={`preview-scale-${value}`} className="text-xs">{value}</Label>
                            <RadioGroupItem value={value.toString()} id={`preview-scale-${value}`} />
                        </div>
                    ))}
                </RadioGroup>
            </>
        );
    
    case 'compare_pairwise':
       if (!task.options || task.options.length === 0) return noOptionsMessage;
      return (
        <RadioGroup disabled className="space-y-4">
          {task.options?.map((option, index) => {
            const opt = option as { label: string; text: string };
            return (
              <div key={index} className="flex items-start space-x-3 rounded-md border p-4">
                <RadioGroupItem value={opt.label} id={`preview-${task.id}-${index}`} className="mt-1" />
                <div className="grid gap-1.5">
                  <Label htmlFor={`preview-${task.id}-${index}`} className="font-bold">{opt.label}</Label>
                  <p className="text-sm text-muted-foreground">{opt.text}</p>
                </div>
              </div>
            );
          })}
        </RadioGroup>
      );

    case 'label_multiple':
      if (!task.options || task.options.length === 0) return noOptionsMessage;
      return (
        <div className="space-y-2">
          {task.options?.map((option, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Checkbox id={`preview-${task.id}-${index}`} disabled />
              <Label htmlFor={`preview-${task.id}-${index}`}>{getOptionText(option)}</Label>
            </div>
          ))}
        </div>
      );
    default:
      return <p className="text-muted-foreground text-center">Preview not available for this contribution type.</p>;
  }
}

function ViewTaskDialog({ task, open, onOpenChange }: { task: Task | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-headline">{task.title}</DialogTitle>
          <DialogDescription>{task.description}</DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[60vh] overflow-y-auto pr-2">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground">User Preview</h3>
            <TaskPreview task={task} />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteTaskDialog({ task, open, onOpenChange, onTaskDeleted }: { task: Task | null; open: boolean; onOpenChange: (open: boolean) => void; onTaskDeleted: () => void; }) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  if (!task) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await deleteAdminTask(task.id);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      onTaskDeleted();
      onOpenChange(false);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsDeleting(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the contribution "{task.title}".
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className={buttonVariants({ variant: "destructive" })}>
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Contribution
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteAllTasksDialog({ open, onOpenChange, onTasksDeleted }: { open: boolean, onOpenChange: (open: boolean) => void, onTasksDeleted: () => void }) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await deleteAllAdminTasks();
    if (result.success) {
      toast({ title: "Success", description: result.message });
      onTasksDeleted();
      onOpenChange(false);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsDeleting(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete ALL contributions from the database.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className={buttonVariants({ variant: "destructive" })}>
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Yes, delete all contributions
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
              <TableHead className="text-right">Actions</TableHead>
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
                    <TableCell className="text-right"><Skeleton className="h-8 w-10 rounded-md" /></TableCell>
                </TableRow>
            ))}
        </TableBody>
    </Table>
);


export function TaskList() {
    const [tasks, setTasks] = useState<Task[]>([]);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [modelsLoading, setModelsLoading] = useState(true);
    const [loading, setLoading] = useState(true);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isAutoGenerateDialogOpen, setIsAutoGenerateDialogOpen] = useState(false);
    const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
    const [viewingTask, setViewingTask] = useState<Task | null>(null);
    const [deletingTask, setDeletingTask] = useState<Task | null>(null);
    const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const { toast } = useToast();

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

    useEffect(() => {
      let isMounted = true;

      const loadContributionModels = async () => {
        setModelsLoading(true);
        try {
          const settings = await getAppSettings();
          const options = getContributionTextModelOptions(settings);
          const savedModel = typeof window === "undefined"
            ? ""
            : String(window.localStorage.getItem(LAST_USED_CONTRIBUTION_MODEL_KEY) || "").trim();
          const preferredModel = [savedModel, settings.defaultTextGenAiModel, settings.defaultGenAiModel, options[0]?.id]
            .map((value) => String(value || "").trim())
            .find(Boolean) || "";
          const normalizedSelection = options.some((option) => option.id === preferredModel)
            ? preferredModel
            : options[0]?.id || preferredModel;

          if (!isMounted) {
            return;
          }

          setModelOptions(options);
          setSelectedModel(normalizedSelection);
        } catch (error) {
          console.error("Failed to load contribution models:", error);
          if (!isMounted) {
            return;
          }

          const fallbackModel = getFallbackModel("text");
                setModelOptions([{ id: fallbackModel, name: `Default - ${fallbackModel}`, modalities: ["text"] }]);
          setSelectedModel(fallbackModel);
        } finally {
          if (isMounted) {
            setModelsLoading(false);
          }
        }
      };

      loadContributionModels();

      return () => {
        isMounted = false;
      };
    }, []);

    useEffect(() => {
      if (!selectedModel || typeof window === "undefined") {
        return;
      }

      window.localStorage.setItem(LAST_USED_CONTRIBUTION_MODEL_KEY, selectedModel);
    }, [selectedModel]);

    const handleStatusToggle = async (taskId: string, currentStatus: string) => {
        setUpdatingTaskId(taskId);
        const newStatus = currentStatus === 'Active' ? 'Paused' : 'Active';
        const result = await updateAdminTaskStatus(taskId, newStatus);
        if (result.success) {
            toast({ title: "Status Updated", description: result.message });
            fetchTasks();
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setUpdatingTaskId(null);
    };

    const paginatedTasks = useMemo(() => {
        const startIndex = (currentPage - 1) * TASKS_PER_PAGE;
        return tasks.slice(startIndex, startIndex + TASKS_PER_PAGE);
    }, [tasks, currentPage]);

    const taskSummary = useMemo(() => {
        const byExpertise = new Map<string, number>();

        tasks.forEach((task) => {
            const expertise = task.expertise?.trim() || 'General';
            byExpertise.set(expertise, (byExpertise.get(expertise) || 0) + 1);
        });

        return Array.from(byExpertise.entries())
            .map(([expertise, count]) => ({ expertise, count }))
            .sort((a, b) => b.count - a.count || a.expertise.localeCompare(b.expertise));
    }, [tasks]);
    
    const totalPages = Math.ceil(tasks.length / TASKS_PER_PAGE);

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
             <Button onClick={() => setIsDeleteAllDialogOpen(true)} variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete All
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <LoadingSkeleton /> : (
            <>
                <div className="mb-6 grid gap-4 lg:grid-cols-[220px_1fr]">
                    <div className="rounded-xl border bg-muted/30 p-4">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-primary/10 p-2 text-primary">
                                <ListChecks className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total contributions</p>
                                <p className="text-2xl font-semibold">{tasks.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border p-4">
                        <p className="mb-3 text-sm font-medium">Contributions by expertise</p>
                        {taskSummary.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {taskSummary.map(({ expertise, count }) => (
                                    <Badge key={expertise} variant="secondary" className="gap-2 px-3 py-1">
                                        <span>{expertise}</span>
                                        <span className="rounded-full bg-background/80 px-1.5 text-xs tabular-nums">{count}</span>
                                    </Badge>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No expertise data available.</p>
                        )}
                    </div>
                </div>
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Expertise</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {paginatedTasks.map((task) => (
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
                        <TableCell className="text-right">
                           {updatingTaskId === task.id ? <Loader2 className="h-4 w-4 animate-spin ml-auto" /> : (
                            <div className="flex justify-end items-center gap-1">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={() => setViewingTask(task)}>
                                            <Eye className="h-4 w-4" />
                                            <span className="sr-only">View Contribution</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>View</p></TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={() => handleStatusToggle(task.id, task.status || 'Paused')}>
                                            {task.status === 'Active' ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                                            <span className="sr-only">{task.status === 'Active' ? 'Pause' : 'Resume'} Contribution</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{task.status === 'Active' ? 'Pause' : 'Resume'}</p></TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeletingTask(task)}>
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Delete Contribution</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Delete</p></TooltipContent>
                                </Tooltip>
                            </div>
                           )}
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
      {totalPages > 1 && (
        <CardFooter className="flex items-center justify-between border-t pt-4">
            <div className="text-xs text-muted-foreground">
                Showing page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>Previous</Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>Next</Button>
            </div>
        </CardFooter>
      )}
      <AddTaskDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onTaskCreated={fetchTasks} modelOptions={modelOptions} selectedModel={selectedModel} onSelectedModelChange={setSelectedModel} modelsLoading={modelsLoading} />
      <AutoGenerateDialog open={isAutoGenerateDialogOpen} onOpenChange={setIsAutoGenerateDialogOpen} onTasksGenerated={fetchTasks} modelOptions={modelOptions} selectedModel={selectedModel} onSelectedModelChange={setSelectedModel} modelsLoading={modelsLoading} />
       <ViewTaskDialog task={viewingTask} open={!!viewingTask} onOpenChange={(open) => !open && setViewingTask(null)} />
       <DeleteTaskDialog task={deletingTask} open={!!deletingTask} onOpenChange={(open) => !open && setDeletingTask(null)} onTaskDeleted={fetchTasks} />
       <DeleteAllTasksDialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen} onTasksDeleted={fetchTasks} />
    </Card>
  );
}
