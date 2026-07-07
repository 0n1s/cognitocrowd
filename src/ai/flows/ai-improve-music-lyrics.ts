'use server';
/**
 * @fileOverview A flow to improve song lyrics prompts for music generation.
 */

import { ai, getAiClient } from '@/ai/genkit';
import { ImproveMusicPromptInputSchema, ImproveMusicPromptOutputSchema, type ImproveMusicPromptInput, type ImproveMusicPromptOutput } from '@/ai/schemas';
import { getAppSettings } from '@/lib/database';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';
import { extractTextFromGenerateResult } from '@/ai/extract-text';

export async function improveMusicLyrics(input: ImproveMusicPromptInput): Promise<ImproveMusicPromptOutput> {
  return improveMusicLyricsFlow(input);
}

const promptTemplate = `You are a songwriting assistant.
The user may provide either draft lyrics or a free-form description of a song.
If they provide a description, write original, complete, singable lyrics that express its story, mood, and intent.
If they provide draft lyrics, refine them while preserving their intent.
Use clear section labels such as [Verse], [Chorus], and [Bridge] where appropriate.
Keep the result compact and usable for a music generation model.
Return only the lyrics as plain text. Do not use JSON or Markdown code fences.

Song description or draft lyrics: "{{prompt}}"`;

const improveMusicLyricsFlow = ai.defineFlow(
  {
    name: 'improveMusicLyricsFlow',
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
    if (!improvedPrompt) throw new Error('AI did not return improved lyrics.');
    return { improvedPrompt };
  }
);
