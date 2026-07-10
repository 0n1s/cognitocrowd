
'use server';
/**
 * @fileOverview A flow to generate a video using a text prompt.
 */

import {ai} from '@/ai/genkit';
import { GenerateVideoInputSchema, GenerateVideoOutputSchema, type GenerateVideoInput, type GenerateVideoOutput } from '@/ai/schemas';
import { getAppSettings } from '@/lib/database';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';
import { generateOpenAiCompatibleVideo, pollOpenAiCompatibleVideoJob, submitOpenAiCompatibleVideo } from '@/ai/openai-video';

type VideoJobResult = {
  jobId: string;
  status?: string;
  progress?: number;
  providerModel: string;
  videoUrl?: string;
  thumbnailUrl?: string;
};

async function getConfiguredVideoGenerationContext() {
  const settings = await getAppSettings();
  const configuredVideoModel = resolveConfiguredModel(settings.defaultVideoGenAiModel, 'video');
  const model = validateModelAvailability(configuredVideoModel, 'video', settings.aiProviders, false);

  if (!model) {
    throw new Error('Selected video model is unavailable for current provider configuration.');
  }

  return { settings, model };
}

export async function generateVideo(input: GenerateVideoInput): Promise<GenerateVideoOutput> {
  return generateVideoFlow(GenerateVideoInputSchema.parse(input));
}

export async function submitVideoGeneration(input: GenerateVideoInput): Promise<VideoJobResult> {
  const parsed = GenerateVideoInputSchema.parse(input);
  const { settings, model } = await getConfiguredVideoGenerationContext();
  const result = await submitOpenAiCompatibleVideo({
    model,
    prompt: parsed.prompt,
    negativePrompt: parsed.negativePrompt,
    width: parsed.width,
    height: parsed.height,
    frames: parsed.frames,
    steps: parsed.steps,
    guidance: parsed.guidance,
    seed: parsed.seed,
    providers: settings.aiProviders,
  });

  return {
    jobId: result.jobId,
    status: result.status,
    progress: result.progress,
    providerModel: model,
    videoUrl: result.result?.videoUrl,
    thumbnailUrl: result.result?.thumbnailUrl,
  };
}

export async function checkVideoGenerationJob(input: { jobId: string; providerModel: string }): Promise<VideoJobResult> {
  const settings = await getAppSettings();
  const model = validateModelAvailability(input.providerModel, 'video', settings.aiProviders, false);
  if (!model) {
    throw new Error('Selected video model is unavailable for current provider configuration.');
  }

  const result = await pollOpenAiCompatibleVideoJob({
    model,
    jobId: input.jobId,
    providers: settings.aiProviders,
  });

  return {
    jobId: result.jobId,
    status: result.status,
    progress: result.progress,
    providerModel: model,
    videoUrl: result.result?.videoUrl,
    thumbnailUrl: result.result?.thumbnailUrl,
  };
}

const generateVideoFlow = ai.defineFlow(
  {
    name: 'generateVideoFlow',
    inputSchema: GenerateVideoInputSchema,
    outputSchema: GenerateVideoOutputSchema,
  },
  async (input) => {
    const { settings, model } = await getConfiguredVideoGenerationContext();

    const result = await generateOpenAiCompatibleVideo({
      model,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      width: input.width,
      height: input.height,
      frames: input.frames,
      steps: input.steps,
      guidance: input.guidance,
      seed: input.seed,
      providers: settings.aiProviders,
    });

    return {
      videoUrl: result.videoUrl,
      thumbnailUrl: result.thumbnailUrl || 'https://placehold.co/400x300.png',
    };
  }
);
