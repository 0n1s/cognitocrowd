'use server';
/**
 * @fileOverview A flow to improve a raw video idea into a complete video-generation prompt.
 */

import { ai, getAiClient } from '@/ai/genkit';
import { z } from 'genkit';
import { getAppSettings } from '@/lib/database';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';
import { extractTextFromGenerateResult } from '@/ai/extract-text';

const ImproveVideoPromptInputSchema = z.object({
  rawIdea: z.string().min(1).describe('The user\'s raw video idea.'),
  durationSeconds: z.number().int().min(1).max(20).describe('The selected video length in seconds.'),
  aspectRatio: z.enum(['9:16', '16:9']).describe('The selected video aspect ratio.'),
  resolution: z.enum(['480x848', '848x480', '720x1280', '1280x720']).describe('The selected output resolution.'),
});
export type ImproveVideoPromptInput = z.infer<typeof ImproveVideoPromptInputSchema>;

const ImproveVideoPromptOutputSchema = z.object({
  improvedPrompt: z.string().describe('The final improved video prompt.'),
});
export type ImproveVideoPromptOutput = z.infer<typeof ImproveVideoPromptOutputSchema>;

export async function improveVideoPrompt(input: ImproveVideoPromptInput): Promise<ImproveVideoPromptOutput> {
  return improveVideoPromptFlow(input);
}

function buildFallbackPrompt(input: ImproveVideoPromptInput) {
  const clampedDuration = Math.max(1, Math.min(20, input.durationSeconds));
  const safeIdea = input.rawIdea.trim();
  const sectionCount = Math.min(clampedDuration, clampedDuration >= 13 ? 4 : clampedDuration >= 7 ? 3 : clampedDuration >= 2 ? 2 : 1);
  const baseLength = Math.floor(clampedDuration / sectionCount);
  const remainder = clampedDuration % sectionCount;

  let start = 0;
  const sections: string[] = [];
  for (let index = 0; index < sectionCount; index += 1) {
    const segmentLength = baseLength + (index < remainder ? 1 : 0);
    const end = index === sectionCount - 1 ? clampedDuration : Math.min(clampedDuration, start + Math.max(1, segmentLength));
    const isFirst = index === 0;
    const isLast = index === sectionCount - 1;
    const action = isFirst
      ? `Introduce the scene with an establishing shot that turns the raw idea into a clear cinematic setup. Keep the subject, location, wardrobe, and visual style stable.`
      : isLast
        ? `Finish with a strong final beat that resolves the motion and lands exactly at ${clampedDuration}s.`
        : `Advance the action with visible movement, camera motion, and concrete scene detail.`;

    sections.push(`[${start}s:${end}s] ${action}`);
    start = isLast ? clampedDuration : end;
  }

  return [
    `Create a cinematic, realistic ${input.aspectRatio} video at ${input.resolution} based on this raw idea: ${safeIdea}. Expand the idea into a richer scene with a clear subject, setting, visual style, camera style, lighting, mood, realism, and continuity. Make the scene feel intentional and visually specific, especially if the input idea is vague.`,
    ...sections,
  ].join('\n');
}

const promptTemplate = `You are a video prompt packaging agent.
Take the user's raw video idea and the selected video duration, then convert them into one complete video-generation prompt ready for the video middleware.

Inputs:
USER_IDEA: {{rawIdea}}
DURATION_SECONDS: {{durationSeconds}}
ASPECT_RATIO: {{aspectRatio}}
RESOLUTION: {{resolution}}

Return only the final prompt. Do not explain anything. Do not use markdown.

The final prompt must:
Start with a clear global description of the video concept, subject, setting, visual style, camera style, lighting, mood, realism, and continuity.
Describe the action in chronological order from the beginning to the end of the clip.
Use time-based sections that cover the full selected duration with no gaps.
Use ranges like [0s:3s], [3s:6s], [6s:10s].
Make the final timed section end exactly at DURATION_SECONDS.
Keep characters, objects, wardrobe, location, visual style, and story continuity stable unless the user asks for a change.
Use concrete visible actions instead of random keyword tags.
Include camera movement, framing, lighting, environment, emotion, and physical motion where useful.
If there is dialogue, narration, or on-screen text, put the exact words in double quotes and clearly say who says them or where the text appears.
Keep dialogue short and suitable for the selected duration.
If the user idea is vague, creatively expand it into a clear cinematic video while preserving the core idea.
Avoid impossible motion, random scene changes, or inconsistent characters unless the user specifically asks for fantasy, surreal, sci-fi, or dreamlike visuals.
For adverts, include product beauty shots, lifestyle context, emotional appeal, and a strong final hero shot.
For action clips, include clear stakes, fast movement, obstacles, tension, and a strong ending.
For comedy clips, keep the acting serious and make the absurd situation visually clear.
For sci-fi clips, describe the futuristic setting, scale, design, lighting, and believable motion.
For music videos, describe performance, rhythm, mood, lighting, camera movement, and visual energy.
For documentary or news-style clips, keep the visuals grounded, realistic, and clearly structured.
Do not add extra commentary before or after the final prompt.`;

const improveVideoPromptFlow = ai.defineFlow(
  {
    name: 'improveVideoPromptFlow',
    inputSchema: ImproveVideoPromptInputSchema,
    outputSchema: ImproveVideoPromptOutputSchema,
  },
  async (input) => {
    const settings = await getAppSettings();
    const runtimeAi = getAiClient({ providers: settings.aiProviders });
    const configuredModel = resolveConfiguredModel(settings.defaultTextGenAiModel || settings.defaultGenAiModel, 'text');
    const model = validateModelAvailability(configuredModel, 'text', settings.aiProviders);

    if (!model) {
      return { improvedPrompt: buildFallbackPrompt(input) };
    }

    try {
      const generated = await runtimeAi.generate({
        model,
        prompt: promptTemplate
          .replace('{{rawIdea}}', input.rawIdea)
          .replace('{{durationSeconds}}', String(input.durationSeconds))
          .replace('{{aspectRatio}}', input.aspectRatio)
          .replace('{{resolution}}', input.resolution),
      });

      const extracted = extractTextFromGenerateResult(generated).trim();
      return { improvedPrompt: extracted || buildFallbackPrompt(input) };
    } catch {
      return { improvedPrompt: buildFallbackPrompt(input) };
    }
  }
);