'use server';
/**
 * @fileOverview A flow to generate music from lyrics and optional style caption.
 */

import { ai } from '@/ai/genkit';
import { getAppSettings } from '@/lib/database';
import { GenerateMusicInputSchema, GenerateMusicOutputSchema, type GenerateMusicInput, type GenerateMusicOutput } from '@/ai/schemas';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';
import { generateOpenAiCompatibleMusic } from '@/ai/openai-music';

export async function generateMusic(input: GenerateMusicInput): Promise<GenerateMusicOutput> {
  return generateMusicFlow(input);
}

const generateMusicFlow = ai.defineFlow(
  {
    name: 'generateMusicFlow',
    inputSchema: GenerateMusicInputSchema,
    outputSchema: GenerateMusicOutputSchema,
  },
  async (input) => {
    const settings = await getAppSettings();

    const configuredProviderModel = resolveConfiguredModel(settings.defaultAudioGenAiModel, 'audio');
    const model = validateModelAvailability(configuredProviderModel, 'audio', settings.aiProviders, false);

    const result = await generateOpenAiCompatibleMusic({
      model: model || 'wangp-music',
      prompt: input.prompt,
      altPrompt: input.altPrompt,
      durationSeconds: input.durationSeconds,
      numInferenceSteps: input.numInferenceSteps,
      sampleSolver: input.sampleSolver,
      providers: settings.aiProviders,
    });

    return {
      audioUrl: result.audioUrl,
    };
  }
);
