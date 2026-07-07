
'use server';
/**
 * @fileOverview A flow to generate a video using a text prompt.
 */

import {ai} from '@/ai/genkit';
import { GenerateVideoInputSchema, GenerateVideoOutputSchema, type GenerateVideoInput, type GenerateVideoOutput } from '@/ai/schemas';
import { getAppSettings } from '@/lib/database';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';
import { generateOpenAiCompatibleVideo } from '@/ai/openai-video';

export async function generateVideo(input: GenerateVideoInput): Promise<GenerateVideoOutput> {
  return generateVideoFlow(input);
}

const generateVideoFlow = ai.defineFlow(
  {
    name: 'generateVideoFlow',
    inputSchema: GenerateVideoInputSchema,
    outputSchema: GenerateVideoOutputSchema,
  },
  async (input) => {
    const settings = await getAppSettings();
    const configuredVideoModel = resolveConfiguredModel(settings.defaultVideoGenAiModel, 'video');
    const model = validateModelAvailability(configuredVideoModel, 'video', settings.aiProviders, false);

    if (!model) {
      throw new Error('Selected video model is unavailable for current provider configuration.');
    }

    const result = await generateOpenAiCompatibleVideo({
      model,
      prompt: input.prompt,
      providers: settings.aiProviders,
    });

    return {
      videoUrl: result.videoUrl,
      thumbnailUrl: result.thumbnailUrl || 'https://placehold.co/400x300.png',
    };
  }
);
