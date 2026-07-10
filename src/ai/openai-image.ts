import type { AiProviderConfig } from '@/lib/types';

type OpenAiImageInput = {
  model: string;
  prompt: string;
  providers?: AiProviderConfig[];
  size?: string;
  negativePrompt?: string;
  n?: number;
  steps?: number;
  guidanceScale?: number;
  pollIntervalMs?: number;
  timeoutMs?: number;
};

export type ImageCandidate = {
  url?: string;
  b64_json?: string;
};

export type ImageJob = {
  jobId: string;
  status: string;
  progress?: number;
  result?: ImageCandidate;
};

function buildEndpointCandidates(baseUrl: string, endpoints: string[]) {
  if (/\/images\/generations$/i.test(baseUrl)) {
    return [''];
  }

  const includeVersioned = !/\/v\d+$/i.test(baseUrl);
  const candidates = endpoints.flatMap((endpoint) => (
    includeVersioned ? [`/v1${endpoint}`, endpoint] : [endpoint]
  ));
  return Array.from(new Set(candidates));
}

function buildStatusEndpointCandidates(baseUrl: string, jobId: string) {
  if (/\/images\/generations$/i.test(baseUrl)) {
    return [`/${jobId}`];
  }

  return buildEndpointCandidates(baseUrl, [`/images/generations/${jobId}`]);
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

function getStatusValue(payload: any): string | undefined {
  return (
    payload?.status ||
    payload?.state ||
    payload?.data?.[0]?.status ||
    payload?.output?.[0]?.status
  );
}

function getProgressValue(payload: any): number | undefined {
  const value = payload?.progress ?? payload?.data?.[0]?.progress ?? payload?.output?.[0]?.progress;
  const progress = Number(value);
  return Number.isFinite(progress) ? progress : undefined;
}

function isTerminalFailureStatus(status: string | undefined): boolean {
  const normalized = (status || '').toLowerCase();
  return ['failed', 'error', 'cancelled', 'canceled'].includes(normalized);
}

function isTerminalSuccessStatus(status: string | undefined): boolean {
  const normalized = (status || '').toLowerCase();
  return ['succeeded', 'success', 'completed', 'done'].includes(normalized);
}

function extractImageCandidate(payload: any): ImageCandidate | null {
  const source = payload?.result || payload;
  const first = source?.data?.[0] || source?.images?.[0] || source?.output?.[0];

  const url =
    source?.url ||
    source?.imageUrl ||
    source?.image_url ||
    first?.url ||
    first?.imageUrl ||
    first?.image_url;
  const b64Json = source?.b64_json || first?.b64_json;

  if (typeof url === 'string' && url.trim()) {
    return { url: url.trim() };
  }

  if (typeof b64Json === 'string' && b64Json.trim()) {
    return { b64_json: b64Json.trim() };
  }

  return null;
}

function normalizeJobStatus(status: string | undefined) {
  const normalized = (status || '').toLowerCase();
  if (['queued', 'pending', 'submitted', 'created'].includes(normalized)) return 'queued';
  if (['running', 'processing', 'in_progress', 'active'].includes(normalized)) return 'processing';
  if (isTerminalSuccessStatus(normalized)) return 'completed';
  if (isTerminalFailureStatus(normalized)) return 'failed';
  return normalized || 'queued';
}

function resolveProvider(input: Pick<OpenAiImageInput, 'model' | 'providers'>) {
  const [providerId, ...modelParts] = (input.model || '').split('/');
  const modelId = modelParts.join('/').trim();

  if (!providerId || !modelId) {
    throw new Error('Selected model is not an OpenAI-compatible provider model.');
  }

  const provider = (input.providers || []).find((item) => item.id === providerId);
  if (!provider?.baseUrl?.trim()) {
    throw new Error(`Provider ${providerId} is not configured for image generation.`);
  }

  return {
    provider,
    modelId,
    baseUrl: provider.baseUrl.trim().replace(/\/+$/, ''),
  };
}

export async function imageCandidateToDataUri(candidate: ImageCandidate) {
  if (candidate.url) {
    const imageResponse = await fetch(candidate.url, { cache: 'no-store' });
    if (!imageResponse.ok) {
      throw new Error(`Image generation returned a URL that could not be fetched (${imageResponse.status}).`);
    }

    const contentType = imageResponse.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png';
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    return `data:${contentType};base64,${imageBuffer.toString('base64')}`;
  }

  if (candidate.b64_json) {
    return `data:image/png;base64,${candidate.b64_json}`;
  }

  throw new Error('Image generation returned no image data.');
}

export async function submitOpenAiCompatibleImage(input: OpenAiImageInput): Promise<ImageJob> {
  const { provider, modelId, baseUrl } = resolveProvider(input);
  const generationEndpoints = buildEndpointCandidates(baseUrl, ['/images/generations']);
  let payload: any = null;
  let lastError: unknown;

  for (const endpoint of generationEndpoints) {
    try {
      const requestUrl = `${baseUrl}${endpoint}`;
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: modelId,
          prompt: input.prompt,
          negative_prompt: input.negativePrompt || '',
          size: input.size || '1024x1024',
          n: input.n ?? 1,
          steps: input.steps ?? 10,
          guidance_scale: input.guidanceScale ?? 2.5,
        }),
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Image generation failed (${response.status}) at ${endpoint || requestUrl}: ${errorText || response.statusText}`);
      }

      payload = await response.json().catch(() => ({}));
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!payload) {
    const message = lastError instanceof Error ? lastError.message : 'Unable to call image generation endpoint.';
    throw new Error(message);
  }

  const immediate = extractImageCandidate(payload);
  if (immediate) {
    return {
      jobId: extractJobId(payload) || `completed-${Date.now()}`,
      status: 'completed',
      progress: 100,
      result: immediate,
    };
  }

  const jobId = extractJobId(payload);
  if (!jobId) {
    throw new Error('Image generation did not return image data or a job ID.');
  }

  const status = getStatusValue(payload);
  if (isTerminalFailureStatus(status)) {
    const errorMessage =
      payload?.error?.message ||
      payload?.message ||
      `Image generation failed with status: ${status}`;
    throw new Error(errorMessage);
  }
  if (isTerminalSuccessStatus(status)) {
    throw new Error('Image generation completed but no image URL was returned.');
  }

  return {
    jobId,
    status: normalizeJobStatus(status),
    progress: getProgressValue(payload) ?? 0,
  };
}

export async function pollOpenAiCompatibleImageJob(input: {
  model: string;
  jobId: string;
  providers?: AiProviderConfig[];
}): Promise<ImageJob> {
  const { provider, baseUrl } = resolveProvider(input);
  const statusEndpoints = buildStatusEndpointCandidates(baseUrl, input.jobId);
  let lastError: unknown;

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
        const errorText = await response.text().catch(() => '');
        lastError = new Error(`Image job polling failed (${response.status}) at ${endpoint}: ${errorText || response.statusText}`);
        continue;
      }

      const statusPayload = await response.json().catch(() => ({}));
      const result = extractImageCandidate(statusPayload);
      const status = getStatusValue(statusPayload);
      const progress = getProgressValue(statusPayload);

      if (result) {
        return {
          jobId: input.jobId,
          status: 'completed',
          progress: 100,
          result,
        };
      }

      if (isTerminalFailureStatus(status)) {
        const errorMessage =
          statusPayload?.error?.message ||
          statusPayload?.message ||
          `Image generation failed with status: ${status}`;
        throw new Error(errorMessage);
      }

      if (isTerminalSuccessStatus(status)) {
        throw new Error('Image generation completed but no image URL was returned.');
      }

      return {
        jobId: input.jobId,
        status: normalizeJobStatus(status),
        progress: progress ?? 0,
      };
    } catch (error) {
      lastError = error;
    }
  }

  const message = lastError instanceof Error ? lastError.message : 'Unable to poll image generation endpoint.';
  throw new Error(message);
}

export async function generateOpenAiCompatibleImage(input: OpenAiImageInput): Promise<string> {
  const { provider, baseUrl } = resolveProvider(input);
  const pollIntervalMs = Math.max(1000, input.pollIntervalMs || 5000);
  const timeoutMs = Math.max(10000, input.timeoutMs || 180000);
  const submitted = await submitOpenAiCompatibleImage(input);

  if (submitted.result) {
    return imageCandidateToDataUri(submitted.result);
  }

  const jobId = submitted.jobId;
  const statusEndpoints = buildStatusEndpointCandidates(baseUrl, jobId);
  const start = Date.now();
  let lastError: unknown;
  let lastStatus: string | undefined;
  let lastProgress: number | undefined;

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
        const result = extractImageCandidate(statusPayload);
        if (result) {
          return imageCandidateToDataUri(result);
        }

        const status = getStatusValue(statusPayload);
        const progress = getProgressValue(statusPayload);
        lastStatus = status || lastStatus;
        lastProgress = progress ?? lastProgress;

        if (isTerminalFailureStatus(status)) {
          const errorMessage =
            statusPayload?.error?.message ||
            statusPayload?.message ||
            `Image generation failed with status: ${status}`;
          throw new Error(errorMessage);
        }

        if (isTerminalSuccessStatus(status)) {
          throw new Error('Image generation completed but no image URL was returned.');
        }
      } catch (error) {
        lastError = error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  const progressText = lastProgress !== undefined ? ` at ${lastProgress}%` : '';
  const statusText = lastStatus ? ` Last status: ${lastStatus}${progressText}.` : '';
  const message = lastError instanceof Error
    ? `${lastError.message}${statusText}`
    : `Image generation polling timed out.${statusText}`;
  throw new Error(message);
}
