'use server';
/**
 * @fileOverview A flow to generate an image for the landing page using a text prompt.
 */

import {ai} from '@/ai/genkit';
import { GenerateLandingImageInputSchema, GenerateLandingImageOutputSchema, type GenerateLandingImageInput, type GenerateLandingImageOutput } from '@/ai/schemas';
import { getAppSettings } from '@/lib/database';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';
import { generateOpenAiCompatibleImage } from '@/ai/openai-image';

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
    const settings = await getAppSettings();
    const configuredModel = resolveConfiguredModel(settings.defaultImageGenAiModel, 'image');
    const model = validateModelAvailability(configuredModel, 'image', settings.aiProviders, false);

    if (!model) {
      throw new Error('Selected image model is unavailable for current provider configuration.');
    }

    const imageDataUri = await generateOpenAiCompatibleImage({
      model,
      prompt: input.prompt,
      providers: settings.aiProviders,
    });
    return { imageDataUri };
  }
);
