
'use server';
/**
 * @fileOverview AI-powered bulk contribution generator for admins.
 *
 * - bulkGenerateTasks - A function that generates a batch of contributions.
 * - BulkGenerateTasksInput - The input type for the bulkGenerateTasks function.
 * - BulkGenerateTasksOutput - The return type for the bulkGenerateTasks function.
 */

import {ai, getAiClient} from '@/ai/genkit';
import {z} from 'genkit';
import { randomUUID } from 'crypto';
import {GenerateTaskOutputSchema} from '@/ai/schemas';
import { getAppSettings } from '@/lib/database';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';

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
  expertise: z.array(z.string()).min(1).describe('The expertise areas for which to generate contributions.'),
  taskTypes: z.array(z.enum(TASK_TYPES)).describe("The types of contributions to generate."),
  model: z.string().optional().describe('Optional provider-prefixed text model override.'),
});
export type BulkGenerateTasksInput = z.infer<typeof BulkGenerateTasksInputSchema>;

const BulkGenerateTasksOutputSchema = z.object({
  tasks: z.array(
    GenerateTaskOutputSchema.extend({
      taskType: z.enum(TASK_TYPES).describe("The type of the generated contribution."),
      expertise: z.string().describe("The expertise area for this specific contribution, chosen from the input list."),
    })
  ),
});
export type BulkGenerateTasksOutput = z.infer<typeof BulkGenerateTasksOutputSchema>;

export async function bulkGenerateTasks(input: BulkGenerateTasksInput): Promise<BulkGenerateTasksOutput> {
  return bulkGenerateTasksFlow(input);
}

const promptTemplate = `You are an AI contribution generator that helps admins create a batch of engaging and diverse contributions for users.

Generate {{count}} contributions. For each contribution, you MUST perform the following steps:
1. Randomly select an expertise area from this list:
{{#each expertise}}
- {{this}}
{{/each}}
2. Randomly select a contribution type from this list:
{{#each taskTypes}}
- {{this}}
{{/each}}

For each generated contribution, you MUST provide a JSON object that strictly adheres to the output schema. The generated contributions should be diverse, but each one must relate to its assigned expertise area.

Here are the requirements for each field:
- "expertise": (Required) The expertise area you selected for the contribution from the list provided.
- "taskType": (Required) The type of the generated contribution, from the list provided.
- "prompt": (Required) The main question for the user. This will be the contribution title.
- "description": (Required) The context or detailed instruction for the contribution.
- "points": (Required) A number between 10 and 500, based on the perceived complexity and effort required for the contribution.
- "options": (Required for 'multiple_choice_preference', 'ranking', 'classification') Provide an array of string options.
- "settings": (Optional) An object to configure the contribution. You can include:
    - "allow_comment": boolean
    - "allow_confidence": boolean
    - "min_chars", "max_chars": numbers (only for 'open_text_feedback')
- "award_criteria": (Optional) An object with an "explanation" string describing why the contribution is useful.

Please output a JSON object with a single key "tasks", which is an array of the generated contribution objects.
`;

const bulkGenerateTasksFlow = ai.defineFlow(
  {
    name: 'bulkGenerateTasksFlow',
    inputSchema: BulkGenerateTasksInputSchema,
    outputSchema: BulkGenerateTasksOutputSchema,
  },
  async (input) => {
    const settings = await getAppSettings();
    const runtimeAi = getAiClient({
      providers: settings.aiProviders,
    });
    const promptName = `bulkTaskGeneratorPromptRuntime-${randomUUID()}`;
    const runtimePrompt = runtimeAi.definePrompt({
      name: promptName,
      input: {schema: BulkGenerateTasksInputSchema},
      output: {schema: BulkGenerateTasksOutputSchema},
      prompt: promptTemplate,
    });
    const configuredModel = resolveConfiguredModel(input.model || settings.defaultTextGenAiModel || settings.defaultGenAiModel, 'text');
    const model = validateModelAvailability(configuredModel, 'text', settings.aiProviders);
    const {output} = await runtimePrompt(input, { model });
    return output!;
  }
);
