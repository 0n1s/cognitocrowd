'use server';
/**
 * @fileOverview A flow to generate a random video idea as a fully described concept.
 */

import { ai, getAiClient } from '@/ai/genkit';
import { z } from 'genkit';
import { getAppSettings } from '@/lib/database';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';
import { extractTextFromGenerateResult } from '@/ai/extract-text';

const GenerateRandomVideoIdeaInputSchema = z.object({
  prompt: z.string().min(1).describe('A request for a random video idea.'),
});
export type GenerateRandomVideoIdeaInput = z.infer<typeof GenerateRandomVideoIdeaInputSchema>;

const GenerateRandomVideoIdeaOutputSchema = z.object({
  improvedPrompt: z.string().describe('The generated random video idea.'),
});
export type GenerateRandomVideoIdeaOutput = z.infer<typeof GenerateRandomVideoIdeaOutputSchema>;

export async function generateRandomVideoIdea(input: GenerateRandomVideoIdeaInput): Promise<GenerateRandomVideoIdeaOutput> {
  return generateRandomVideoIdeaFlow(input);
}

const fallbackIdeas = [
  'A lone night-shift baker discovers that every loaf in the quiet bakery rises into the shape of a different city skyline, then carefully turns the ovens into a glowing miniature metropolis as flour drifts through warm golden light.',
  'A commuter on a rain-soaked platform opens a bright yellow umbrella and the puddles around them reflect scenes from summer, with the camera circling as passing trains smear the colors into a hopeful final image.',
  'A tiny delivery robot crosses an empty office after midnight carrying one glowing cupcake, dodging rolling chairs and automatic doors before arriving at a desk where the candle lights up the whole room.',
  'A street artist paints a door on a blank concrete wall, and as the camera pushes closer the painted door appears to swing open onto a sunlit ocean cliff with wind, gull shadows, and a sudden burst of blue light.',
  'A child in a homemade astronaut helmet launches paper rockets in a quiet backyard at dusk, and each rocket briefly becomes a sparkling constellation before landing softly in the grass.'
];

function cleanIdeaText(value: string) {
  return value
    .replace(/^```(?:json|markdown|text)?/i, '')
    .replace(/```$/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

function buildFallbackRandomIdea() {
  return fallbackIdeas[Math.floor(Math.random() * fallbackIdeas.length)];
}

const promptTemplate = `You are a creative video concept generator.
Create one original video idea that describes the video itself in a clear, visual, filmable way.
The result must feel like a short concept someone could hand directly to a video creator.

Make sure the idea includes:
- a clear subject or main character
- a specific scene or setting
- a visible action or sequence of motion
- a mood or emotional tone
- a strong visual hook
- enough detail that the viewer can picture the video immediately

If the request is random, invent something surprising, fun, and cinematic, but still coherent and filmable.
Do not write a full prompt, shot list, or timed sections.
Do not mention that the idea is random.
Return only the generated video idea as plain text. Do not use JSON or Markdown code fences.

User request: "{{prompt}}"`;

const generateRandomVideoIdeaFlow = ai.defineFlow(
  {
    name: 'generateRandomVideoIdeaFlow',
    inputSchema: GenerateRandomVideoIdeaInputSchema,
    outputSchema: GenerateRandomVideoIdeaOutputSchema,
  },
  async (input) => {
    const settings = await getAppSettings();
    const runtimeAi = getAiClient({ providers: settings.aiProviders });
    const configuredModel = resolveConfiguredModel(settings.defaultTextGenAiModel || settings.defaultGenAiModel, 'text');
    const model = validateModelAvailability(configuredModel, 'text', settings.aiProviders);

    if (!model) {
      return { improvedPrompt: buildFallbackRandomIdea() };
    }

    try {
      const generated = await runtimeAi.generate({
        model,
        prompt: promptTemplate.replace('{{prompt}}', input.prompt),
      });

      const improvedPrompt = cleanIdeaText(extractTextFromGenerateResult(generated));
      return { improvedPrompt: improvedPrompt || buildFallbackRandomIdea() };
    } catch {
      return { improvedPrompt: buildFallbackRandomIdea() };
    }
  }
);
