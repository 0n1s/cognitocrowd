
'use server';
/**
 * @fileOverview A flow to generate an image using a text prompt.
 */

import {ai} from '@/ai/genkit';
import { GenerateImageInputSchema, GenerateImageOutputSchema, type GenerateImageInput, type GenerateImageOutput } from '@/ai/schemas';
import { getAppSettings } from '@/lib/database';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';
import {
  generateOpenAiCompatibleImage,
  imageCandidateToDataUri,
  pollOpenAiCompatibleImageJob,
  submitOpenAiCompatibleImage,
} from '@/ai/openai-image';
import type { AppSettings } from '@/lib/types';

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
  return generateImageFlow(GenerateImageInputSchema.parse(input));
}

export type ImageGenerationJobResult = {
  jobId: string;
  status: string;
  progress?: number;
  providerModel: string;
  imageDataUri?: string;
};

function getConfiguredImageModelForMode(settings: AppSettings, imageModel: GenerateImageInput['imageModel']) {
  if (imageModel === 'uncensored') {
    return settings.defaultUncensoredAiModel || settings.defaultImageGenAiModel;
  }
  return settings.defaultImageGenAiModel;
}

function resolveImageModel(settings: AppSettings, imageModel: GenerateImageInput['imageModel']) {
  const configuredModel = resolveConfiguredModel(getConfiguredImageModelForMode(settings, imageModel), 'image');
  const model = validateModelAvailability(configuredModel, 'image', settings.aiProviders, false);

  if (!model) {
    throw new Error('Selected image model is unavailable for current provider configuration.');
  }

  return model;
}

export async function submitImageGeneration(input: GenerateImageInput): Promise<ImageGenerationJobResult> {
  const parsed = GenerateImageInputSchema.parse(input);
  const settings = await getAppSettings();
  const model = resolveImageModel(settings, parsed.imageModel);
  const submitted = await submitOpenAiCompatibleImage({
    model,
    prompt: parsed.prompt,
    negativePrompt: parsed.negativePrompt,
    size: parsed.size,
    n: parsed.n,
    steps: parsed.steps,
    guidanceScale: parsed.guidanceScale,
    providers: settings.aiProviders,
  });

  return {
    jobId: submitted.jobId,
    status: submitted.status,
    progress: submitted.progress,
    providerModel: model,
    imageDataUri: submitted.result ? await imageCandidateToDataUri(submitted.result) : undefined,
  };
}

export async function checkImageGenerationJob(input: {
  jobId: string;
  providerModel: string;
}): Promise<ImageGenerationJobResult> {
  const settings = await getAppSettings();
  const checked = await pollOpenAiCompatibleImageJob({
    model: input.providerModel,
    jobId: input.jobId,
    providers: settings.aiProviders,
  });

  return {
    jobId: checked.jobId,
    status: checked.status,
    progress: checked.progress,
    providerModel: input.providerModel,
    imageDataUri: checked.result ? await imageCandidateToDataUri(checked.result) : undefined,
  };
}

const generateImageFlow = ai.defineFlow(
  {
    name: 'generateImageFlow',
    inputSchema: GenerateImageInputSchema,
    outputSchema: GenerateImageOutputSchema,
  },
  async (input) => {
    const settings = await getAppSettings();
    const model = resolveImageModel(settings, input.imageModel);

    const imageDataUri = await generateOpenAiCompatibleImage({
      model,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      size: input.size,
      n: input.n,
      steps: input.steps,
      guidanceScale: input.guidanceScale,
      providers: settings.aiProviders,
    });
    return { imageDataUri };
  }
);

    
