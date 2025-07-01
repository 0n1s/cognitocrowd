'use server';
/**
 * @fileOverview AI-powered bulk task generator for admins.
 *
 * - bulkGenerateTasks - A function that generates a batch of tasks.
 * - BulkGenerateTasksInput - The input type for the bulkGenerateTasks function.
 * - BulkGenerateTasksOutput - The return type for the bulkGenerateTasks function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {GenerateTaskOutputSchema} from '@/ai/schemas';

const TASK_TYPES = [
  'open_text_feedback',
  'multiple_choice_preference',
  'ranking',
  'classification',
  'sentiment',
  'topic_classification',
  'likert_scale',
  'compare_pairwise',
  'label_multiple',
] as const;

const BulkGenerateTasksInputSchema = z.object({
  count: z.number().int().min(1).max(10).describe('The number of tasks to generate.'),
  taskTypes: z.array(z.enum(TASK_TYPES)).min(1).describe('The types of tasks to generate from.'),
});
export type BulkGenerateTasksInput = z.infer<typeof BulkGenerateTasksInputSchema>;

const BulkGenerateTasksOutputSchema = z.object({
  tasks: z.array(
    GenerateTaskOutputSchema.extend({
      taskType: z.enum(TASK_TYPES).describe("The type of the generated task."),
    })
  ),
});
export type BulkGenerateTasksOutput = z.infer<typeof BulkGenerateTasksOutputSchema>;

export async function bulkGenerateTasks(input: BulkGenerateTasksInput): Promise<BulkGenerateTasksOutput> {
  return bulkGenerateTasksFlow(input);
}

const prompt = ai.definePrompt({
  name: 'bulkTaskGeneratorPrompt',
  input: {schema: BulkGenerateTasksInputSchema},
  output: {schema: BulkGenerateTasksOutputSchema},
  prompt: `You are an AI task generator that helps admins create a batch of engaging tasks for users.

Generate {{count}} tasks. For each task, randomly select a task type from the following list:
{{#each taskTypes}}
- {{this}}
{{/each}}

For each generated task, you must provide:
- a "taskType" from the list provided.
- a "prompt" (which will be the task title).
- a "description" (which provides context for the task).
- "options" if the task type requires them (e.g., 'multiple_choice_preference', 'ranking', 'classification', etc). The options field should be an array of strings. Omit it if not applicable.

The tasks should cover a diverse range of general knowledge subjects like science, history, art, and everyday situations. Ensure the prompts are clear and concise, and the descriptions provide sufficient context for users.

Please output a JSON object with a single key "tasks", which is an array of the generated task objects.
`,
});

const bulkGenerateTasksFlow = ai.defineFlow(
  {
    name: 'bulkGenerateTasksFlow',
    inputSchema: BulkGenerateTasksInputSchema,
    outputSchema: BulkGenerateTasksOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
