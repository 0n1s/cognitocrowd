'use server';
/**
 * @fileOverview A flow to generate a user profile image using a text prompt.
 */

import {ai} from '@/ai/genkit';
import { GenerateProfileImageInputSchema, GenerateProfileImageOutputSchema, type GenerateProfileImageInput, type GenerateProfileImageOutput } from '@/ai/schemas';

export async function generateProfileImage(input: GenerateProfileImageInput): Promise<GenerateProfileImageOutput> {
  return generateProfileImageFlow(input);
}

const generateProfileImageFlow = ai.defineFlow(
  {
    name: 'generateProfileImageFlow',
    inputSchema: GenerateProfileImageInputSchema,
    outputSchema: GenerateProfileImageOutputSchema,
  },
  async (input) => {
    const { media } = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: `photorealistic avatar, ${input.prompt}, 4k, high detail`,
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
