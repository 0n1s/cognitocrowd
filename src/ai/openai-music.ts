import type { AiProviderConfig } from '@/lib/types';

type OpenAiMusicInput = {
  model?: string;
  prompt: string;
  altPrompt?: string;
  durationSeconds?: number;
  numInferenceSteps?: number;
  sampleSolver?: string;
  providers?: AiProviderConfig[];
};

type MusicResult = {
  audioUrl: string;
};

function extractAudioResult(payload: any): MusicResult | null {
  const fromArray = payload?.data?.[0] || payload?.output?.[0];
  const url =
    payload?.audioUrl ||
    payload?.audio_url ||
    payload?.url ||
    payload?.audio?.url ||
    fromArray?.audioUrl ||
    fromArray?.audio_url ||
    fromArray?.url ||
    fromArray?.audio?.url;

  if (!url || typeof url !== 'string') return null;

  return { audioUrl: url };
}

export async function generateOpenAiCompatibleMusic(input: OpenAiMusicInput): Promise<MusicResult> {
  const requestedModel = (input.model || 'wangp-music').trim();
  const [providerId] = requestedModel.includes('/') ? requestedModel.split('/') : [''];

  const candidateProviders = (input.providers || []).filter(
    (item) => item.baseUrl?.trim() && (item.supportsAudio === true || item.supportsVideo === true)
  );

  const provider = providerId
    ? (input.providers || []).find((item) => item.id === providerId)
    : candidateProviders[0];

  if (!provider?.baseUrl?.trim()) {
    throw new Error('No OpenAI-compatible media provider is configured for music generation.');
  }

  const modelId = requestedModel.includes('/') ? requestedModel.split('/').slice(1).join('/') : requestedModel;
  const baseUrl = provider.baseUrl.trim().replace(/\/+$/, '');
  const endpoint = `${baseUrl}/audio/generations`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: modelId || 'wangp-music',
      prompt: input.prompt,
      alt_prompt: input.altPrompt || undefined,
      duration_seconds: input.durationSeconds ?? 40,
      num_inference_steps: input.numInferenceSteps ?? 100,
      sample_solver: input.sampleSolver || 'euler',
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Music generation failed for ${provider.id}/${modelId} at ${endpoint} (${response.status}): ${text || response.statusText}`
    );
  }

  const payload = await response.json().catch(() => ({}));
  const result = extractAudioResult(payload);
  if (!result) {
    throw new Error('Music generation completed but no audio URL was returned.');
  }

  return result;
}
