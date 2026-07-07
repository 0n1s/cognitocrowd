'use server';
/**
 * @fileOverview A flow to generate a user profile image using a text prompt.
 */

import {ai} from '@/ai/genkit';
import { GenerateProfileImageInputSchema, GenerateProfileImageOutputSchema, type GenerateProfileImageInput, type GenerateProfileImageOutput } from '@/ai/schemas';
import { getAppSettings } from '@/lib/database';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';
import { generateOpenAiCompatibleImage } from '@/ai/openai-image';

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
    const settings = await getAppSettings();
    const configuredModel = resolveConfiguredModel(settings.defaultImageGenAiModel, 'image');
    const model = validateModelAvailability(configuredModel, 'image', settings.aiProviders, false);

    if (!model) {
      throw new Error('Selected image model is unavailable for current provider configuration.');
    }

    const prompt = `photorealistic avatar, ${input.prompt}, 4k, high detail`;
    const imageDataUri = await generateOpenAiCompatibleImage({
      model,
      prompt,
      providers: settings.aiProviders,
    });
    return { imageDataUri };
  }
);
