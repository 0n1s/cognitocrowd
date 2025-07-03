
'use server';
/**
 * @fileOverview AI-powered bulk contribution generator for admins.
 *
 * - bulkGenerateTasks - A function that generates a batch of contributions.
 * - BulkGenerateTasksInput - The input type for the bulkGenerateTasks function.
 * - BulkGenerateTasksOutput - The return type for the bulkGenerateTasks function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {GenerateTaskOutputSchema} from '@/ai/schemas';
import { getAppSettings } from '@/lib/database';

const TASK_TYPES = [
  'multiple_choice_preference',
  'ranking',
  'likert_scale',
  'classification',
  'sentiment',
  'topic_classification',
  'open_text_feedback',
  'compare_pairwise',
  'label_multiple',
] as const;

const BulkGenerateTasksInputSchema = z.object({
  count: z.number().int().min(1).max(10).describe('The number of contributions to generate.'),
  expertise: z.string().describe('The expertise area for which to generate contributions.'),
  taskTypes: z.array(z.enum(TASK_TYPES)).describe("The types of contributions to generate.")
});
export type BulkGenerateTasksInput = z.infer<typeof BulkGenerateTasksInputSchema>;

const BulkGenerateTasksOutputSchema = z.object({
  tasks: z.array(
    GenerateTaskOutputSchema.extend({
      taskType: z.enum(TASK_TYPES).describe("The type of the generated contribution."),
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
  prompt: `You are an AI contribution generator that helps admins create a batch of engaging and diverse contributions for users within the expertise area of "{{expertise}}".

Generate {{count}} contributions. For each contribution, randomly select a contribution type from the following list:
{{#each taskTypes}}
- {{this}}
{{/each}}

For each generated contribution, you MUST provide a JSON object that strictly adheres to the output schema. The generated contributions should be diverse, but all related to the core expertise of "{{expertise}}".

Here are the requirements for each field:
- "taskType": (Required) The type of the generated contribution, from the list provided.
- "prompt": (Required) The main question for the user. This will be the contribution title.
- "description": (Required) The context or detailed instruction for the contribution.
- "options": (Required for 'multiple_choice_preference', 'ranking', 'classification') Provide an array of string options.
- "settings": (Optional) An object to configure the contribution. You can include:
    - "allow_comment": boolean
    - "allow_confidence": boolean
    - "min_chars", "max_chars": numbers (only for 'open_text_feedback')
- "award_criteria": (Optional) An object with an "explanation" string describing why the contribution is useful.

Please output a JSON object with a single key "tasks", which is an array of the generated contribution objects.
`,
});

const bulkGenerateTasksFlow = ai.defineFlow(
  {
    name: 'bulkGenerateTasksFlow',
    inputSchema: BulkGenerateTasksInputSchema,
    outputSchema: BulkGenerateTasksOutputSchema,
  },
  async (input) => {
    const settings = await getAppSettings();
    const model = settings.defaultGenAiModel || 'googleai/gemini-2.0-flash';
    const {output} = await prompt(input, { model });
    return output!;
  }
);
