import type { AiProviderConfig } from '@/lib/types';

type OpenAiVideoInput = {
  model: string;
  prompt: string;
  providers?: AiProviderConfig[];
  pollIntervalMs?: number;
  timeoutMs?: number;
};

type VideoResult = {
  videoUrl: string;
  thumbnailUrl?: string;
};

function extractVideoResult(payload: any): VideoResult | null {
  const fromArray = payload?.data?.[0] || payload?.output?.[0];
  const url =
    payload?.videoUrl ||
    payload?.video_url ||
    payload?.url ||
    payload?.video?.url ||
    fromArray?.videoUrl ||
    fromArray?.video_url ||
    fromArray?.url ||
    fromArray?.video?.url;

  if (!url || typeof url !== 'string') return null;

  const thumbnailUrl =
    payload?.thumbnailUrl ||
    payload?.thumbnail_url ||
    payload?.video?.thumbnailUrl ||
    payload?.video?.thumbnail_url ||
    fromArray?.thumbnailUrl ||
    fromArray?.thumbnail_url ||
    fromArray?.thumbnail?.url;

  return {
    videoUrl: url,
    thumbnailUrl: typeof thumbnailUrl === 'string' ? thumbnailUrl : undefined,
  };
}

function extractJobId(payload: any): string | null {
  const candidate =
    payload?.id ||
    payload?.jobId ||
    payload?.job_id ||
    payload?.data?.[0]?.id ||
    payload?.output?.[0]?.id ||
    payload?.job?.id;

  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

function isTerminalFailureStatus(status: string | undefined): boolean {
  const normalized = (status || '').toLowerCase();
  return ['failed', 'error', 'cancelled', 'canceled'].includes(normalized);
}

function isTerminalSuccessStatus(status: string | undefined): boolean {
  const normalized = (status || '').toLowerCase();
  return ['succeeded', 'success', 'completed', 'done'].includes(normalized);
}

export async function generateOpenAiCompatibleVideo(input: OpenAiVideoInput): Promise<VideoResult> {
  const [providerId, ...modelParts] = (input.model || '').split('/');
  const modelId = modelParts.join('/').trim();

  if (!providerId || !modelId) {
    throw new Error('Selected model is not an OpenAI-compatible provider model.');
  }

  const provider = (input.providers || []).find((item) => item.id === providerId);
  if (!provider?.baseUrl?.trim()) {
    throw new Error(`Provider ${providerId} is not configured for video generation.`);
  }

  const baseUrl = provider.baseUrl.trim().replace(/\/+$/, '');
  const pollIntervalMs = Math.max(1000, input.pollIntervalMs || 3000);
  const timeoutMs = Math.max(10000, input.timeoutMs || 120000);

  const generationEndpoints = ['/videos/generations', '/video/generations'];
  let payload: any = null;
  let lastError: unknown;

  for (const endpoint of generationEndpoints) {
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: modelId,
          prompt: input.prompt,
        }),
        cache: 'no-store',
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Video generation failed (${response.status}) at ${endpoint}: ${text || response.statusText}`);
      }

      payload = await response.json().catch(() => ({}));
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!payload) {
    const message = lastError instanceof Error ? lastError.message : 'Unable to call video generation endpoint.';
    throw new Error(message);
  }

  const immediate = extractVideoResult(payload);
  if (immediate) {
    return immediate;
  }

  const jobId = extractJobId(payload);
  if (!jobId) {
    throw new Error('Video generation did not return a video URL or job ID.');
  }

  const statusEndpoints = [
    `/videos/${jobId}`,
    `/video/${jobId}`,
    `/videos/generations/${jobId}`,
    `/video/generations/${jobId}`,
  ];

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const endpoint of statusEndpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
          },
          cache: 'no-store',
        });

        if (!response.ok) {
          continue;
        }

        const statusPayload = await response.json().catch(() => ({}));
        const result = extractVideoResult(statusPayload);
        if (result) {
          return result;
        }

        const status =
          statusPayload?.status ||
          statusPayload?.state ||
          statusPayload?.data?.[0]?.status ||
          statusPayload?.output?.[0]?.status;

        if (isTerminalFailureStatus(status)) {
          const errorMessage =
            statusPayload?.error?.message ||
            statusPayload?.message ||
            `Video generation failed with status: ${status}`;
          throw new Error(errorMessage);
        }

        if (isTerminalSuccessStatus(status)) {
          throw new Error('Video generation completed but no video URL was returned.');
        }
      } catch (error) {
        lastError = error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  const message = lastError instanceof Error ? lastError.message : 'Video generation polling timed out.';
  throw new Error(message);
}
