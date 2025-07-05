'use server';
/**
 * @fileOverview A flow to improve text content for the landing page using AI.
 */

import { ai } from '@/ai/genkit';
import { ImproveTextSchema, ImproveTextOutputSchema, type ImproveTextInput, type ImproveTextOutput } from '@/ai/schemas';


export async function improveLandingPageText(input: ImproveTextInput): Promise<ImproveTextOutput> {
  return improveTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'improveLandingPageTextPrompt',
  input: { schema: ImproveTextSchema },
  output: { schema: ImproveTextOutputSchema },
  prompt: `You are a professional marketing copywriter. Your task is to improve the provided text for a website's landing page.

Context: You are writing a "{{context}}".
Original Text: "{{originalText}}"

Rewrite the text to be more engaging, concise, and persuasive. The improved text should be suitable for a technology company that connects human experts with AI training tasks. Do not just rephrase; enhance the copy. Return only the improved text in the 'improvedText' field.`,
});

const improveTextFlow = ai.defineFlow(
  {
    name: 'improveTextFlow',
    inputSchema: ImproveTextSchema,
    outputSchema: ImproveTextOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
