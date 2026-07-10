import type { AiProviderConfig } from '@/lib/types';

type OpenAiVideoInput = {
  model: string;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  frames?: number;
  steps?: number;
  guidance?: number;
  seed?: number;
  providers?: AiProviderConfig[];
  pollIntervalMs?: number;
  timeoutMs?: number;
};

type OpenAiVideoJobInput = {
  model: string;
  jobId: string;
  providers?: AiProviderConfig[];
};

type VideoResult = {
  videoUrl: string;
  thumbnailUrl?: string;
};

type VideoJob = {
  jobId: string;
  status?: string;
  progress?: number;
  result?: VideoResult;
};

const LABELED_VIDEO_MODELS: Record<string, string> = {
  'wangp-t2v_1.3B': 'wangp-t2v_1.3B (480p|10sec ~33s)',
  ltx2_distilled_gguf_q4_k_m: 'ltx2_distilled_gguf_q4_k_m (480p|10sec ~41s)',
  'wangp-ltx2_distilled_gguf_q4_k_m': 'wangp-ltx2_distilled_gguf_q4_k_m (480p|10sec ~41s)',
  'wangp-ltx2_22B_distilled_gguf_q4_k_m': 'wangp-ltx2_22B_distilled_gguf_q4_k_m (480p|10sec ~41s)',
  'wangp-ltxv_13B': 'wangp-ltxv_13B (480p|10sec ~41s)',
  'wangp-hunyuan_1_5_480_t2v': 'wangp-hunyuan_1_5_480_t2v (480p|10sec ~41s)',
};

function normalizeVideoModelId(modelId: string) {
  const trimmed = modelId.trim();
  if (trimmed.includes('(')) {
    return trimmed;
  }
  return LABELED_VIDEO_MODELS[trimmed] || trimmed;
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

function extractVideoResult(payload: any): VideoResult | null {
  const source = payload?.result || payload;
  const fromArray = source?.videos?.[0] || source?.data?.[0] || source?.output?.[0];
  const url =
    source?.videoUrl ||
    source?.video_url ||
    source?.url ||
    source?.video?.url ||
    fromArray?.videoUrl ||
    fromArray?.video_url ||
    fromArray?.url ||
    fromArray?.video?.url;

  if (!url || typeof url !== 'string') return null;

  const thumbnailUrl =
    source?.thumbnailUrl ||
    source?.thumbnail_url ||
    source?.video?.thumbnailUrl ||
    source?.video?.thumbnail_url ||
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

function buildEndpointCandidates(baseUrl: string, endpoints: string[]) {
  if (/\/videos?\/generations$/i.test(baseUrl)) {
    return [''];
  }

  const includeVersioned = !/\/v\d+$/i.test(baseUrl);
  const candidates = endpoints.flatMap((endpoint) => (
    includeVersioned ? [`/v1${endpoint}`, endpoint] : [endpoint]
  ));
  return Array.from(new Set(candidates));
}

function buildStatusEndpointCandidates(baseUrl: string, jobId: string) {
  if (/\/videos?\/generations$/i.test(baseUrl)) {
    return [`/${jobId}`];
  }

  return buildEndpointCandidates(baseUrl, [`/video/generations/${jobId}`]);
}

function resolveVideoProvider(input: { model: string; providers?: AiProviderConfig[] }) {
  const [providerId, ...modelParts] = (input.model || '').split('/');
  const modelId = normalizeVideoModelId(modelParts.join('/'));

  if (!providerId || !modelId) {
    throw new Error('Selected model is not an OpenAI-compatible provider model.');
  }

  const provider = (input.providers || []).find((item) => item.id === providerId);
  if (!provider?.baseUrl?.trim()) {
    throw new Error(`Provider ${providerId} is not configured for video generation.`);
  }

  const baseUrl = provider.baseUrl.trim().replace(/\/+$/, '');
  return { provider, modelId, baseUrl };
}

export async function submitOpenAiCompatibleVideo(input: OpenAiVideoInput): Promise<VideoJob> {
  const { provider, modelId, baseUrl } = resolveVideoProvider(input);

  const generationEndpoints = buildEndpointCandidates(baseUrl, ['/video/generations']);
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
          width: input.width ?? 480,
          height: input.height ?? 848,
          frames: input.frames ?? 120,
          steps: input.steps ?? 4,
          guidance: input.guidance ?? 5,
          seed: input.seed ?? -1,
        }),
        cache: 'no-store',
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Video generation failed (${response.status}) at ${endpoint || requestUrl}: ${text || response.statusText}`);
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
    return {
      jobId: extractJobId(payload) || `completed-${Date.now()}`,
      status: 'completed',
      progress: 100,
      result: immediate,
    };
  }

  const jobId = extractJobId(payload);
  if (!jobId) {
    throw new Error('Video generation did not return a video URL or job ID.');
  }

  return {
    jobId,
    status: getStatusValue(payload),
    progress: getProgressValue(payload),
  };
}

export async function pollOpenAiCompatibleVideoJob(input: OpenAiVideoJobInput): Promise<VideoJob> {
  const { provider, baseUrl } = resolveVideoProvider(input);
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
        lastError = new Error(`Video status check failed (${response.status}) at ${endpoint}: ${await response.text().catch(() => response.statusText)}`);
        continue;
      }

      const statusPayload = await response.json().catch(() => ({}));
      const result = extractVideoResult(statusPayload);
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
          `Video generation failed with status: ${status}`;
        throw new Error(errorMessage);
      }

      return { jobId: input.jobId, status, progress };
    } catch (error) {
      lastError = error;
    }
  }

  const message = lastError instanceof Error ? lastError.message : 'Unable to check video generation status.';
  throw new Error(message);
}

export async function generateOpenAiCompatibleVideo(input: OpenAiVideoInput): Promise<VideoResult> {
  const pollIntervalMs = Math.max(1000, input.pollIntervalMs || 5000);
  const timeoutMs = Math.max(10000, input.timeoutMs || 600000);
  const submitted = await submitOpenAiCompatibleVideo(input);

  if (submitted.result) {
    return submitted.result;
  }

  const start = Date.now();
  let lastStatus = submitted.status;
  let lastProgress = submitted.progress;
  let lastError: unknown;

  while (Date.now() - start < timeoutMs) {
    try {
      const checked = await pollOpenAiCompatibleVideoJob({
        model: input.model,
        jobId: submitted.jobId,
        providers: input.providers,
      });
      lastStatus = checked.status || lastStatus;
      lastProgress = checked.progress ?? lastProgress;

      if (checked.result) {
        return checked.result;
      }

      if (isTerminalSuccessStatus(checked.status)) {
        throw new Error('Video generation completed but no video URL was returned.');
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  const progressText = lastProgress !== undefined ? ` at ${lastProgress}%` : '';
  const statusText = lastStatus ? ` Last status: ${lastStatus}${progressText}.` : '';
  const message = lastError instanceof Error
    ? `${lastError.message}${statusText}`
    : `Video generation polling timed out.${statusText}`;
  throw new Error(message);
}
