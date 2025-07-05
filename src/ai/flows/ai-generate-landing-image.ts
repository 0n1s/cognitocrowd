'use server';
/**
 * @fileOverview A flow to generate an image for the landing page using a text prompt.
 */

import {ai} from '@/ai/genkit';
import { GenerateLandingImageInputSchema, GenerateLandingImageOutputSchema, type GenerateLandingImageInput, type GenerateLandingImageOutput } from '@/ai/schemas';

export async function generateLandingImage(input: GenerateLandingImageInput): Promise<GenerateLandingImageOutput> {
  return generateLandingImageFlow(input);
}

const generateLandingImageFlow = ai.defineFlow(
  {
    name: 'generateLandingImageFlow',
    inputSchema: GenerateLandingImageInputSchema,
    outputSchema: GenerateLandingImageOutputSchema,
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
