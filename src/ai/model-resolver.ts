import { FALLBACK_AUDIO_MODEL, FALLBACK_IMAGE_MODEL, FALLBACK_TEXT_MODEL, FALLBACK_VIDEO_MODEL } from '@/ai/models';
import type { AiProviderConfig } from '@/lib/types';

type ModelModality = 'text' | 'image' | 'video' | 'audio';

export function getFallbackModel(modality: ModelModality): string {
  if (modality === 'image') return FALLBACK_IMAGE_MODEL;
  if (modality === 'video') return FALLBACK_VIDEO_MODEL;
  if (modality === 'audio') return FALLBACK_AUDIO_MODEL;
  return FALLBACK_TEXT_MODEL;
}

/**
 * Resolve a configured model ID and guard against missing OpenAPI-compatible configuration.
 */
export function resolveConfiguredModel(configuredModel: string | undefined, modality: ModelModality): string {
  return (configuredModel || getFallbackModel(modality)).trim();
}

export function validateModelAvailability(
  model: string,
  modality: ModelModality,
  providers?: AiProviderConfig[],
  allowFallback = true
): string {
  const [providerId] = model.split('/');
  if (!providerId) {
    return allowFallback ? getFallbackModel(modality) : '';
  }

  const matchedProvider = (providers || []).find((p) => p.id === providerId);
  if (!matchedProvider || !matchedProvider.baseUrl?.trim()) {
    console.warn(`No provider config found for model ${model}. Falling back.`);
    return allowFallback ? getFallbackModel(modality) : '';
  }

  const capabilityAllowed =
    modality === 'text'
      ? matchedProvider.supportsText !== false
      : modality === 'image'
      ? matchedProvider.supportsImage === true
      : modality === 'video'
      ? matchedProvider.supportsVideo === true
      : matchedProvider.supportsAudio === true;

  if (!capabilityAllowed) {
    console.warn(`Provider ${providerId} is not enabled for ${modality}. Falling back.`);
    return allowFallback ? getFallbackModel(modality) : '';
  }

  return model;
}

export function shouldRetryImageGenerationError(error: unknown): boolean {
  const status = typeof error === 'object' && error !== null ? (error as { status?: number }).status : undefined;
  if (status === 404) {
    return true;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    message.includes('404 status code') ||
    message.includes('not found') ||
    message.includes('no longer available') ||
    message.includes('not supported')
  );
}
