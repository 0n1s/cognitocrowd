'use server';
/**
 * @fileOverview A flow to improve or invent a raw video idea.
 */

import { ai, getAiClient } from '@/ai/genkit';
import { z } from 'genkit';
import { getAppSettings } from '@/lib/database';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';
import { extractTextFromGenerateResult } from '@/ai/extract-text';

const ImproveVideoIdeaInputSchema = z.object({
  prompt: z.string().min(1).describe('The raw or random video idea request.'),
});
export type ImproveVideoIdeaInput = z.infer<typeof ImproveVideoIdeaInputSchema>;

const ImproveVideoIdeaOutputSchema = z.object({
  improvedPrompt: z.string().describe('The improved or invented video idea.'),
});
export type ImproveVideoIdeaOutput = z.infer<typeof ImproveVideoIdeaOutputSchema>;

export async function improveVideoIdea(input: ImproveVideoIdeaInput): Promise<ImproveVideoIdeaOutput> {
  return improveVideoIdeaFlow(input);
}

function cleanIdeaText(value: string) {
  return value
    .replace(/^```(?:json|markdown|text)?/i, '')
    .replace(/```$/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

function buildFallbackImprovedIdea(rawPrompt: string) {
  const idea = rawPrompt.trim();
  return `A cinematic short video about ${idea}, staged as one clear scene with a memorable subject, a specific setting, visible motion, expressive lighting, and a strong final visual hook. The action should feel coherent from start to finish, with the camera following the subject through a small but noticeable transformation.`;
}

const promptTemplate = `You are a creative video idea editor.
Turn the user's rough idea into one vivid video concept that clearly describes the video itself, not just the topic.
Expand vague ideas into a clear cinematic scene with subject, setting, action, motion, camera energy, lighting, mood, and a strong visual hook.
Preserve any specific characters, products, locations, style, emotion, or story details the user provided.
If the user asks for a random idea, invent an original video concept that is clearly described and immediately filmable, with a scene, subject, motion, mood, and visual hook.
Keep it concise, but more descriptive than the raw idea.
Write 1 compact paragraph, roughly 45-80 words.
Do not write a full generation prompt, shot list, or timed sections.
Return only the improved video idea as plain text. Do not use JSON or Markdown code fences.

User request: "{{prompt}}"`;

const improveVideoIdeaFlow = ai.defineFlow(
  {
    name: 'improveVideoIdeaFlow',
    inputSchema: ImproveVideoIdeaInputSchema,
    outputSchema: ImproveVideoIdeaOutputSchema,
  },
  async (input) => {
    const settings = await getAppSettings();
    const runtimeAi = getAiClient({ providers: settings.aiProviders });
    const configuredModel = resolveConfiguredModel(settings.defaultTextGenAiModel || settings.defaultGenAiModel, 'text');
    const model = validateModelAvailability(configuredModel, 'text', settings.aiProviders);

    if (!model) {
      return { improvedPrompt: buildFallbackImprovedIdea(input.prompt) };
    }

    try {
      const generated = await runtimeAi.generate({
        model,
        prompt: promptTemplate.replace('{{prompt}}', input.prompt),
      });

      const improvedPrompt = cleanIdeaText(extractTextFromGenerateResult(generated));
      return { improvedPrompt: improvedPrompt || buildFallbackImprovedIdea(input.prompt) };
    } catch {
      return { improvedPrompt: buildFallbackImprovedIdea(input.prompt) };
    }
  }
);
