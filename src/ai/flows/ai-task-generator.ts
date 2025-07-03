
// src/ai/flows/ai-task-generator.ts
'use server';

/**
 * @fileOverview AI-powered contribution generator for admins. Allows generating contribution prompts and descriptions based on a given topic.
 *
 * - generateTask - A function that generates a contribution based on the given topic.
 * - GenerateTaskInput - The input type for the generateTask function.
 * - GenerateTaskOutput - The return type for the generateTask function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { GenerateTaskOutputSchema } from '@/ai/schemas';
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

const GenerateTaskInputSchema = z.object({
  topic: z.string().describe('The topic or subject of the contribution.'),
  taskType: z.enum(TASK_TYPES).describe('The type of contribution to generate.'),
  expertise: z.string().optional().describe('The expertise area for the contribution.'),
});
export type GenerateTaskInput = z.infer<typeof GenerateTaskInputSchema>;

export type GenerateTaskOutput = z.infer<typeof GenerateTaskOutputSchema>;

export async function generateTask(input: GenerateTaskInput): Promise<GenerateTaskOutput> {
  return generateTaskFlow(input);
}

const taskGeneratorPrompt = ai.definePrompt({
  name: 'taskGeneratorPrompt',
  input: {schema: GenerateTaskInputSchema},
  output: {schema: GenerateTaskOutputSchema},
  prompt: `You are an AI contribution generator that helps admins create engaging contributions for users.

  Your task is to generate a single contribution based on the following inputs:
  - Topic: "{{topic}}"
  - Expertise Area: "{{expertise}}"
  - Contribution Type: "{{taskType}}"

  Here are the requirements for the output JSON object:
  - "prompt": (Required) A clear and concise question for the user, based on the topic. This will be the contribution title.
  - "description": (Required) A detailed description providing context for the user.
  - "points": (Required) An integer between 10 and 500, reflecting the contribution's complexity.
  - "options": This field is REQUIRED if the task type is 'multiple_choice_preference', 'ranking', or 'classification'. You MUST generate a relevant array of string options for these types. For all other task types, this field MUST be omitted.

  Ensure the final output is a single JSON object that strictly adheres to the output schema.
  `,
});

const generateTaskFlow = ai.defineFlow(
  {
    name: 'generateTaskFlow',
    inputSchema: GenerateTaskInputSchema,
    outputSchema: GenerateTaskOutputSchema,
  },
  async input => {
    const settings = await getAppSettings();
    const model = settings.defaultGenAiModel || 'googleai/gemini-2.0-flash';
    const {output} = await taskGeneratorPrompt(input, { model });
    return output!;
  }
);
