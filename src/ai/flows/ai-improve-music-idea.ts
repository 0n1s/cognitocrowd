'use server';
/**
 * @fileOverview A flow to improve or invent a free-form song description.
 */

import { ai, getAiClient } from '@/ai/genkit';
import {
  ImproveMusicPromptInputSchema,
  ImproveMusicPromptOutputSchema,
  type ImproveMusicPromptInput,
  type ImproveMusicPromptOutput,
} from '@/ai/schemas';
import { getAppSettings } from '@/lib/database';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';
import { extractTextFromGenerateResult } from '@/ai/extract-text';

export async function improveMusicIdea(input: ImproveMusicPromptInput): Promise<ImproveMusicPromptOutput> {
  return improveMusicIdeaFlow(input);
}

const promptTemplate = `You are a creative song concept editor.
Turn the user's idea into one vivid, concise song description that a songwriter can use to create lyrics and production guidance.
Preserve any specific story, characters, genre, mood, language, or message they requested.
If the user asks for a random idea, invent an original and surprising concept with a clear story, mood, genre, and musical energy.
Do not write lyrics. Return only the song description as plain text. Do not use JSON or Markdown code fences.

User request: "{{prompt}}"`;

const improveMusicIdeaFlow = ai.defineFlow(
  {
    name: 'improveMusicIdeaFlow',
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
    if (!improvedPrompt) throw new Error('AI did not return a song description.');
    return { improvedPrompt };
  }
);
