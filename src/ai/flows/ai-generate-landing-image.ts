'use server';
/**
 * @fileOverview A flow to generate an image for the landing page using a text prompt.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const GenerateLandingImageInputSchema = z.object({
  prompt: z.string().describe('A text prompt to generate an image from.'),
});
export type GenerateLandingImageInput = z.infer<typeof GenerateLandingImageInputSchema>;

export const GenerateLandingImageOutputSchema = z.object({
    imageDataUri: z.string().describe("The generated image as a data URI. Expected format: 'data:image/png;base64,<encoded_data>'."),
});
export type GenerateLandingImageOutput = z.infer<typeof GenerateLandingImageOutputSchema>;

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
