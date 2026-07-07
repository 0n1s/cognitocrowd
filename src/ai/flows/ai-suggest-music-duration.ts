'use server';

import { z } from 'zod';
import { ai, getAiClient } from '@/ai/genkit';
import { extractTextFromGenerateResult } from '@/ai/extract-text';
import { getAppSettings } from '@/lib/database';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';

const SuggestMusicDurationInputSchema = z.object({
  lyrics: z.string().min(1),
  caption: z.string().optional(),
});

const SuggestMusicDurationOutputSchema = z.object({
  durationSeconds: z.number().int().min(10).max(240),
});

type SuggestMusicDurationInput = z.infer<typeof SuggestMusicDurationInputSchema>;
type SuggestMusicDurationOutput = z.infer<typeof SuggestMusicDurationOutputSchema>;

export async function suggestMusicDuration(input: SuggestMusicDurationInput): Promise<SuggestMusicDurationOutput> {
  return suggestMusicDurationFlow(input);
}

const suggestMusicDurationFlow = ai.defineFlow(
  {
    name: 'suggestMusicDurationFlow',
    inputSchema: SuggestMusicDurationInputSchema,
    outputSchema: SuggestMusicDurationOutputSchema,
  },
  async (input) => {
    const settings = await getAppSettings();
    const runtimeAi = getAiClient({ providers: settings.aiProviders });
    const configuredModel = resolveConfiguredModel(settings.defaultTextGenAiModel || settings.defaultGenAiModel, 'text');
    const model = validateModelAvailability(configuredModel, 'text', settings.aiProviders);
    const wordCount = input.lyrics.trim().split(/\s+/).filter(Boolean).length;

    const generated = await runtimeAi.generate({
      model,
      prompt: `Recommend a realistic duration in seconds for an AI-generated song.
Analyze the lyrics length, section markers, likely vocal delivery, and the requested musical style.
The lyrics contain approximately ${wordCount} words.
Allowed range: 10 to 240 seconds.
Return only one whole number with no explanation.

Lyrics:
${input.lyrics}

Music style/caption:
${input.caption || 'Not provided'}`,
    });

    const text = extractTextFromGenerateResult(generated);
    const parsed = Number.parseInt(text.match(/\d{1,3}/)?.[0] || '', 10);
    if (!Number.isFinite(parsed)) throw new Error('AI did not return a valid duration.');
    return { durationSeconds: Math.max(10, Math.min(240, parsed)) };
  }
);
