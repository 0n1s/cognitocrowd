'use server';
/**
 * @fileOverview A flow to improve text content for the landing page using AI.
 */

import { ai } from '@/ai/genkit';
import { ImproveTextSchema, ImproveTextOutputSchema, type ImproveTextInput, type ImproveTextOutput } from '@/ai/schemas';
import { getAiClient } from '@/ai/genkit';
import { getAppSettings } from '@/lib/database';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';
import { extractTextFromGenerateResult } from '@/ai/extract-text';


export async function improveLandingPageText(input: ImproveTextInput): Promise<ImproveTextOutput> {
  return improveTextFlow(input);
}

const promptTemplate = `You are a professional marketing copywriter. Your task is to improve the provided text for a website's landing page.

Context: You are writing a "{{context}}".
Original Text: "{{originalText}}"

Rewrite the text to be more engaging, concise, and persuasive. The improved text should be suitable for a technology company that connects human experts with AI training tasks. Do not just rephrase; enhance the copy.
Return only the improved text as plain text.
Do not return JSON.
Do not return Markdown code fences.`;

function extractImprovedText(raw: string): string {
  const text = raw.trim();
  if (!text) return '';

  const jsonBlockMatch = text.match(/\{[\s\S]*\}/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[0]) as { improvedText?: unknown };
      if (typeof parsed.improvedText === 'string' && parsed.improvedText.trim()) {
        return parsed.improvedText.trim();
      }
    } catch {
      // Ignore malformed JSON and continue with plain text extraction.
    }
  }

  return text
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}


const improveTextFlow = ai.defineFlow(
  {
    name: 'improveTextFlow',
    inputSchema: ImproveTextSchema,
    outputSchema: ImproveTextOutputSchema,
  },
  async (input) => {
    const settings = await getAppSettings();
    const runtimeAi = getAiClient({ providers: settings.aiProviders });
    const configuredModel = resolveConfiguredModel(settings.defaultTextGenAiModel || settings.defaultGenAiModel, 'text');
    const model = validateModelAvailability(configuredModel, 'text', settings.aiProviders);

    if (!model || !model.trim()) {
      return { improvedText: input.originalText.trim() };
    }

    try {
      const prompt = promptTemplate
        .replace('{{context}}', input.context)
        .replace('{{originalText}}', input.originalText);

      const generated = await runtimeAi.generate({
        model,
        prompt,
      });

      const extracted = extractTextFromGenerateResult(generated);
      const improvedText = extractImprovedText(extracted);
      if (!improvedText) {
        return { improvedText: input.originalText.trim() };
      }

      return { improvedText };
    } catch {
      return { improvedText: input.originalText.trim() };
    }
  }
);
