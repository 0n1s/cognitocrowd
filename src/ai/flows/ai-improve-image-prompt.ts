'use server';
/**
 * @fileOverview A flow to improve an image generation prompt using AI.
 */

import { ai } from '@/ai/genkit';
import { ImproveImagePromptInputSchema, ImproveImagePromptOutputSchema, type ImproveImagePromptInput, type ImproveImagePromptOutput } from '@/ai/schemas';
import { getAiClient } from '@/ai/genkit';
import { getAppSettings } from '@/lib/database';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';
import { extractTextFromGenerateResult } from '@/ai/extract-text';

export async function improveImagePrompt(input: ImproveImagePromptInput): Promise<ImproveImagePromptOutput> {
  return improveImagePromptFlow(input);
}

const promptTemplate = `You are an expert prompt engineer for an AI image generator. 
Your task is to take a user's basic prompt and expand it into a more detailed, descriptive, and visually rich prompt. 
Add details about style (e.g., photorealistic, watercolor, anime), lighting, composition, and mood. 
Return only the improved prompt as plain text.
Do not return JSON.
Do not return Markdown code fences.

Original Prompt: "{{prompt}}"`;

function extractImprovedPrompt(raw: string): string {
  const text = raw.trim();
  if (!text) return '';

  const jsonBlockMatch = text.match(/\{[\s\S]*\}/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[0]) as { improvedPrompt?: unknown };
      if (typeof parsed.improvedPrompt === 'string' && parsed.improvedPrompt.trim()) {
        return parsed.improvedPrompt.trim();
      }
    } catch {
      // Ignore JSON parse errors and treat as plain text.
    }
  }

  return text
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

const improveImagePromptFlow = ai.defineFlow(
  {
    name: 'improveImagePromptFlow',
    inputSchema: ImproveImagePromptInputSchema,
    outputSchema: ImproveImagePromptOutputSchema,
  },
  async (input) => {
    const settings = await getAppSettings();
    const runtimeAi = getAiClient({ providers: settings.aiProviders });
    const configuredModel = resolveConfiguredModel(settings.defaultTextGenAiModel || settings.defaultGenAiModel, 'text');
    const model = validateModelAvailability(configuredModel, 'text', settings.aiProviders);

    if (!model || !model.trim()) {
      return { improvedPrompt: input.prompt.trim() };
    }

    try {
      const generated = await runtimeAi.generate({
        model,
        prompt: promptTemplate.replace('{{prompt}}', input.prompt),
      });

      const extracted = extractTextFromGenerateResult(generated);
      const improvedPrompt = extractImprovedPrompt(extracted);
      if (!improvedPrompt) {
        return { improvedPrompt: input.prompt.trim() };
      }

      return { improvedPrompt };
    } catch {
      return { improvedPrompt: input.prompt.trim() };
    }
  }
);
