
'use server';
/**
 * @fileOverview A flow to generate an image using a text prompt.
 */

import {ai} from '@/ai/genkit';
import { GenerateImageInputSchema, GenerateImageOutputSchema, type GenerateImageInput, type GenerateImageOutput } from '@/ai/schemas';

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
  return generateImageFlow(input);
}

const generateImageFlow = ai.defineFlow(
  {
    name: 'generateImageFlow',
    inputSchema: GenerateImageInputSchema,
    outputSchema: GenerateImageOutputSchema,
  },
  async (input) => {
    const { media } = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: input.prompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media) {
      throw new Error('Image generation failed. No media was returned.');
    }

    return { imageDataUri: media.url };
  }
);

    