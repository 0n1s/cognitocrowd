import type { AiProviderConfig } from '@/lib/types';

type OpenAiImageInput = {
  model: string;
  prompt: string;
  providers?: AiProviderConfig[];
  size?: string;
};

export async function generateOpenAiCompatibleImage(input: OpenAiImageInput): Promise<string> {
  const [providerId, ...modelParts] = (input.model || '').split('/');
  const modelId = modelParts.join('/').trim();

  if (!providerId || !modelId) {
    throw new Error('Selected model is not an OpenAI-compatible provider model.');
  }

  const provider = (input.providers || []).find((item) => item.id === providerId);
  if (!provider?.baseUrl?.trim()) {
    throw new Error(`Provider ${providerId} is not configured for image generation.`);
  }

  const baseUrl = provider.baseUrl.trim().replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: modelId,
      prompt: input.prompt,
      size: input.size || '1024x1024',
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Image generation failed (${response.status}): ${errorText || response.statusText}`);
  }

  const payload = (await response.json().catch(() => ({}))) as {
    data?: Array<{ url?: string; b64_json?: string }>;
  };

  const first = payload.data?.[0];
  if (first?.url) {
    const imageResponse = await fetch(first.url, { cache: 'no-store' });
    if (!imageResponse.ok) {
      throw new Error(`Image generation returned a URL that could not be fetched (${imageResponse.status}).`);
    }

    const contentType = imageResponse.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png';
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    return `data:${contentType};base64,${imageBuffer.toString('base64')}`;
  }

  if (first?.b64_json) {
    return `data:image/png;base64,${first.b64_json}`;
  }

  throw new Error('Image generation returned no image data.');
}
