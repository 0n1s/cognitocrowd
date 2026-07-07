'use server';
/**
 * @fileOverview A flow to improve a music caption (alt_prompt) for style control.
 */

import { ai, getAiClient } from '@/ai/genkit';
import { ImproveMusicPromptInputSchema, ImproveMusicPromptOutputSchema, type ImproveMusicPromptInput, type ImproveMusicPromptOutput } from '@/ai/schemas';
import { getAppSettings } from '@/lib/database';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';
import { extractTextFromGenerateResult } from '@/ai/extract-text';

export async function improveMusicCaption(input: ImproveMusicPromptInput): Promise<ImproveMusicPromptOutput> {
  return improveMusicCaptionFlow(input);
}

const promptTemplate = `You are an expert music prompt engineer.
Convert the user's rough idea into a concise music caption suitable for an alt_prompt field.
Include genre, tempo, instrumentation, mood, vocal style, and production vibe when possible.
Keep it short (1-3 sentences).
Return only the caption as plain text. Do not use JSON or Markdown code fences.

Original music caption idea: "{{prompt}}"`;

const improveMusicCaptionFlow = ai.defineFlow(
  {
    name: 'improveMusicCaptionFlow',
    inputSchema: ImproveMusicPromptInputSchema,
    outputSchema: ImproveMusicPromptOutputSchema,
  },
  async (input) => {
    const settings = await getAppSettings();
    const runtimeAi = getAiClient({ providers: settings.aiProviders });
    const configuredModel = resolveConfiguredModel(settings.defaultTextGenAiModel || settings.defaultGenAiModel, 'text');
    const model = validateModelAvailability(configuredModel, 'text', settings.aiProviders);
    const generated = await runtimeAi.generate({
      model,
      prompt: promptTemplate.replace('{{prompt}}', input.prompt),
    });
    const improvedPrompt = extractTextFromGenerateResult(generated);
    if (!improvedPrompt) throw new Error('AI did not return an improved caption.');
    return { improvedPrompt };
  }
);
