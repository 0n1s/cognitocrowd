
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
  count: z.number().int().min(1).max(10).describe('The number of contributions to generate.'),
  expertise: z.string().describe('The expertise area for which to generate contributions.'),
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
- "options": (Required for specific types) Provide an array of options. The format of objects inside the array depends on the taskType:
    - For 'multiple_choice_preference': An array of objects, e.g., \`[{ "text": "Option A" }, { "text": "Option B" }]\`.
    - For 'compare_pairwise': An array of objects, e.g., \`[{ "label": "A", "text": "Details for A" }, { "label": "B", "text": "Details for B" }]\`.
    - For 'ranking', 'classification', 'sentiment', 'topic_classification', 'label_multiple': An array of strings, e.g., \`["Option 1", "Option 2"]\`.
    - For 'open_text_feedback' and 'likert_scale': This field should be omitted.
- "scale": (Required for 'likert_scale') An object with 'min', 'max', and 'labels'. Example: \`{ "min": 1, "max": 5, "labels": { "1": "Very unclear", "5": "Very clear" } }\`.
- "settings": (Optional) An object to configure the contribution. You can include:
    - "allow_comment": boolean
    - "allow_confidence": boolean
    - "allow_multi_select": boolean (only for 'label_multiple')
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
    const {output} = await prompt(
        {...input, taskTypes: TASK_TYPES as any}, 
        { model }
    );
    return output!;
  }
);
