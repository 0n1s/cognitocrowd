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

const GenerateTaskInputSchema = z.object({
  topic: z.string().describe('The topic or subject of the contribution.'),
  taskType: z.enum(['open_text_feedback', 'multiple_choice_preference', 'ranking', 'classification']).describe('The type of contribution to generate.'),
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

  Given the topic: "{{topic}}" and the task type: "{{taskType}}", generate a suitable contribution prompt and description.

  If the task type is 'multiple_choice_preference', also generate an array of options.
  Otherwise, the options field should be omitted from the output.

  Ensure the prompt is clear and concise, and the description provides sufficient context for users to complete the contribution effectively.

  Please output a JSON object.
  `,
});

const generateTaskFlow = ai.defineFlow(
  {
    name: 'generateTaskFlow',
    inputSchema: GenerateTaskInputSchema,
    outputSchema: GenerateTaskOutputSchema,
  },
  async input => {
    const {output} = await taskGeneratorPrompt(input);
    return output!;
  }
);
