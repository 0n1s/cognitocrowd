"use client";

import { Task } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";

export function TaskForms({ task }: { task: Task }) {
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Here you would typically handle form submission to a server action
    console.log("Form submitted for task:", task.id);
    
    toast({
      title: "Task Submitted!",
      description: `You've earned ${task.points} points for completing "${task.title}".`,
      className: "bg-green-100 border-green-300 text-green-800 dark:bg-green-900 dark:border-green-700 dark:text-green-100",
    });

    // Redirect to dashboard after a short delay
    setTimeout(() => {
        router.push('/dashboard');
    }, 1500);
  };
  
  const renderForm = () => {
    switch (task.type) {
      case "open_text_feedback":
        return (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              placeholder="Type your feedback here..."
              rows={8}
              required
            />
            <Button type="submit">Submit Feedback</Button>
          </form>
        );
      case "multiple_choice_preference":
      case "classification":
        return (
          <form onSubmit={handleSubmit} className="space-y-4">
            <RadioGroup required>
              {task.options?.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`option-${index}`} />
                  <Label htmlFor={`option-${index}`}>{option}</Label>
                </div>
              ))}
            </RadioGroup>
            <Button type="submit">Submit Selection</Button>
          </form>
        );
      case "ranking":
        return (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-muted-foreground">Drag and drop to rank the items (1 is highest).</p>
            {/* A real implementation would use a drag-and-drop library */}
            <div className="space-y-2">
                {task.options?.map((option, index) => (
                    <div key={index} className="flex items-center p-3 border rounded-md bg-muted">
                        <span className="font-bold mr-4">{index + 1}</span>
                        <span>{option}</span>
                    </div>
                ))}
            </div>
            <Button type="submit">Submit Ranking</Button>
          </form>
        );
      default:
        return <p>This task type is not supported yet.</p>;
    }
  };

  return <div className="mt-6">
    <Separator className="mb-6"/>
    <h3 className="text-lg font-semibold mb-4">Your Response</h3>
    {renderForm()}
  </div>;
}
