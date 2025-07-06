'use server';
/**
 * @fileOverview A flow to improve an image generation prompt using AI.
 */

import { ai } from '@/ai/genkit';
import { ImproveImagePromptInputSchema, ImproveImagePromptOutputSchema, type ImproveImagePromptInput, type ImproveImagePromptOutput } from '@/ai/schemas';

export async function improveImagePrompt(input: ImproveImagePromptInput): Promise<ImproveImagePromptOutput> {
  return improveImagePromptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'improveImagePrompt',
  input: { schema: ImproveImagePromptInputSchema },
  output: { schema: ImproveImagePromptOutputSchema },
  prompt: `You are an expert prompt engineer for an AI image generator. 
Your task is to take a user's basic prompt and expand it into a more detailed, descriptive, and visually rich prompt. 
Add details about style (e.g., photorealistic, watercolor, anime), lighting, composition, and mood. 
Return only the improved prompt in the 'improvedPrompt' field.

Original Prompt: "{{prompt}}"`,
});

const improveImagePromptFlow = ai.defineFlow(
  {
    name: 'improveImagePromptFlow',
    inputSchema: ImproveImagePromptInputSchema,
    outputSchema: ImproveImagePromptOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
