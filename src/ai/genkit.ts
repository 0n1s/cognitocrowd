import {genkit} from 'genkit';
import {openAICompatible} from '@genkit-ai/compat-oai';
import { FALLBACK_TEXT_MODEL } from '@/ai/models';
import type { AiProviderConfig } from '@/lib/types';

type OpenApiConfig = {
  baseUrl?: string;
  apiKey?: string;
  providerId?: string;
};

type MultiProviderConfig = {
  providers?: AiProviderConfig[];
};

const aiCache = new Map<string, ReturnType<typeof genkit>>();

export function getAiClient(config?: OpenApiConfig & MultiProviderConfig) {
  const singleProviderId = (config?.providerId || 'openapi').trim() || 'openapi';
  const singleProvider = {
    id: singleProviderId,
    name: 'OpenAPI Compatible',
    baseUrl: (config?.baseUrl || process.env.OPENAI_COMPATIBLE_BASE_URL || '').trim(),
    apiKey: (config?.apiKey || process.env.OPENAI_COMPATIBLE_API_KEY || 'openapi-compatible').trim(),
    supportsText: true,
    supportsImage: true,
    supportsVideo: true,
  } as AiProviderConfig;

  const configuredProviders = (config?.providers || []).filter((p) => p.baseUrl?.trim());
  const providers = configuredProviders.length > 0 ? configuredProviders : (singleProvider.baseUrl ? [singleProvider] : []);

  const providerCachePart = providers
    .map((p) => `${p.id}:${(p.baseUrl || '').trim()}:${(p.apiKey || '').trim()}`)
    .sort()
    .join('|');
  const cacheKey = providerCachePart || 'openai-compatible-only';

  const cached = aiCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const plugins: ReturnType<typeof openAICompatible>[] = [];

  providers.forEach((provider) => {
    plugins.push(
      openAICompatible({
        name: provider.id,
        baseURL: provider.baseUrl,
        apiKey: provider.apiKey || 'openapi-compatible',
      })
    );
  });

  const client = genkit({
    plugins,
    model: FALLBACK_TEXT_MODEL,
  });

  aiCache.set(cacheKey, client);
  return client;
}

export const ai = getAiClient();
