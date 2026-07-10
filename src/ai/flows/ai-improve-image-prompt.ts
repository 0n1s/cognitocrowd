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

const fallbackRandomImagePrompts = [
  'Generate an image of a glass greenhouse floating above a misty forest at sunrise, warm golden light, lush plants pressing against fogged windows, ultra-detailed, shallow depth of field, photorealistic.',
  'Generate an image of a tiny robot painter sitting on a rooftop at blue hour, painting the city skyline on a canvas, neon reflections on wet concrete, whimsical mood, 35mm lens, richly textured digital art.',
  'Generate an image of a surreal desert library with towering shelves half-buried in sand, a lone traveler reading under a floating moon, dramatic shadows, matte painting style, highly detailed, atmospheric.',
  'Generate an image of a luxury matte black perfume bottle on rippled silver fabric, soft studio lighting, crisp reflections, elegant minimal composition, high-end commercial photography.',
  'Generate an image of a cozy fantasy kitchen inside a giant tree, glowing jars, copper pots, herbs hanging from wooden beams, warm lantern light, storybook realism, intricate environmental detail.'
];

function buildFallbackImprovedPrompt(rawPrompt: string) {
  const prompt = rawPrompt.trim();
  return `Generate an image of ${prompt}, with a clear subject, intentional composition, detailed background, expressive lighting, rich textures, coherent color palette, and a polished high-resolution visual style.`;
}

function buildFallbackRandomImagePrompt() {
  return fallbackRandomImagePrompts[Math.floor(Math.random() * fallbackRandomImagePrompts.length)];
}

function isRandomPromptRequest(prompt: string) {
  const normalized = prompt.trim().toLowerCase();
  return /\b(random|surprise|invent|generate an idea|new idea)\b/.test(normalized);
}

const promptTemplate = `You are an expert prompt engineer for an AI image generator. 
Your task is to take a user's basic prompt and expand it into a more detailed, descriptive, and visually rich prompt. 
Add details about style (e.g., photorealistic, watercolor, anime), lighting, composition, and mood. 
If the user asks for a random idea, invent one original image prompt with a clear subject, setting, composition, lighting, color palette, and visual style.
Do not return JSON.
Do not return Markdown code fences.
Return only the improved prompt as plain text without any additional commentary or explanation starting with "Generate an image of" and ending with a period.
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
      return { improvedPrompt: isRandomPromptRequest(input.prompt) ? buildFallbackRandomImagePrompt() : buildFallbackImprovedPrompt(input.prompt) };
    }

    try {
      const generated = await runtimeAi.generate({
        model,
        prompt: promptTemplate.replace('{{prompt}}', input.prompt),
      });

      const extracted = extractTextFromGenerateResult(generated);
      const improvedPrompt = extractImprovedPrompt(extracted);
      if (!improvedPrompt) {
        return { improvedPrompt: isRandomPromptRequest(input.prompt) ? buildFallbackRandomImagePrompt() : buildFallbackImprovedPrompt(input.prompt) };
      }

      return { improvedPrompt };
    } catch {
      return { improvedPrompt: isRandomPromptRequest(input.prompt) ? buildFallbackRandomImagePrompt() : buildFallbackImprovedPrompt(input.prompt) };
    }
  }
);
