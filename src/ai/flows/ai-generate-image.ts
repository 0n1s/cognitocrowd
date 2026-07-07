
'use server';
/**
 * @fileOverview A flow to generate an image using a text prompt.
 */

import {ai} from '@/ai/genkit';
import { GenerateImageInputSchema, GenerateImageOutputSchema, type GenerateImageInput, type GenerateImageOutput } from '@/ai/schemas';
import { getAppSettings } from '@/lib/database';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';
import { generateOpenAiCompatibleImage } from '@/ai/openai-image';
import type { AppSettings } from '@/lib/types';

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
  return generateImageFlow(input);
}

function getConfiguredImageModelForMode(settings: AppSettings, imageModel: GenerateImageInput['imageModel']) {
  if (imageModel === 'uncensored') {
    return settings.defaultUncensoredAiModel || settings.defaultImageGenAiModel;
  }
  return settings.defaultImageGenAiModel;
}

const generateImageFlow = ai.defineFlow(
  {
    name: 'generateImageFlow',
    inputSchema: GenerateImageInputSchema,
    outputSchema: GenerateImageOutputSchema,
  },
  async (input) => {
    const settings = await getAppSettings();
    const configuredModel = resolveConfiguredModel(getConfiguredImageModelForMode(settings, input.imageModel), 'image');
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

    