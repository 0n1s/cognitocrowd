// src/ai/flows/ai-assistant-chat.ts
'use server';

/**
 * @fileOverview AI assistant chat flow for providing task guidance.
 *
 * - aiAssistantTaskGuidance - A function that handles the AI assistant chat process.
 * - AiAssistantTaskGuidanceInput - The input type for the aiAssistantTaskGuidance function.
 * - AiAssistantTaskGuidanceOutput - The return type for the aiAssistantTaskGuidance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiAssistantTaskGuidanceInputSchema = z.object({
  query: z.string().describe('The user query for task guidance.'),
});
export type AiAssistantTaskGuidanceInput = z.infer<typeof AiAssistantTaskGuidanceInputSchema>;

const AiAssistantTaskGuidanceOutputSchema = z.object({
  response: z.string().describe('The AI assistant response providing task guidance.'),
});
export type AiAssistantTaskGuidanceOutput = z.infer<typeof AiAssistantTaskGuidanceOutputSchema>;

export async function aiAssistantTaskGuidance(input: AiAssistantTaskGuidanceInput): Promise<AiAssistantTaskGuidanceOutput> {
  return aiAssistantTaskGuidanceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiAssistantTaskGuidancePrompt',
  input: {schema: AiAssistantTaskGuidanceInputSchema},
  output: {schema: AiAssistantTaskGuidanceOutputSchema},
  prompt: `You are a helpful AI assistant that provides guidance on available tasks.
  A user will ask you a question about the tasks, and you should respond with helpful and informative advice.
  User query: {{{query}}}`,
});

const aiAssistantTaskGuidanceFlow = ai.defineFlow(
  {
    name: 'aiAssistantTaskGuidanceFlow',
    inputSchema: AiAssistantTaskGuidanceInputSchema,
    outputSchema: AiAssistantTaskGuidanceOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
