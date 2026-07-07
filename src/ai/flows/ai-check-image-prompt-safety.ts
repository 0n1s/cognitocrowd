'use server';

import { ai, getAiClient } from '@/ai/genkit';
import { z } from 'genkit';
import { getAppSettings } from '@/lib/database';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';

const CheckImagePromptSafetyInputSchema = z.object({
  prompt: z.string().describe('The image prompt to classify as safe-for-work or not safe-for-work.'),
});
export type CheckImagePromptSafetyInput = z.infer<typeof CheckImagePromptSafetyInputSchema>;

const CheckImagePromptSafetyOutputSchema = z.object({
  isSafe: z.boolean().describe('True when the prompt is safe for work.'),
  reason: z.string().optional().describe('Short reason when unsafe.'),
});
export type CheckImagePromptSafetyOutput = z.infer<typeof CheckImagePromptSafetyOutputSchema>;

const promptTemplate = `You are a strict SFW policy classifier for image generation prompts.

Classify the prompt as safe or unsafe for work.

Mark as unsafe if it requests any sexual/explicit content, nudity, fetish content, pornographic themes, graphic gore, or extreme violence.

Return only JSON matching the schema with:
- isSafe: boolean
- reason: short string if unsafe

Prompt: {{{prompt}}}`;

function extractTextFromGenerateResult(result: unknown): string {
  if (!result || typeof result !== 'object') return '';
  const obj = result as {
    text?: unknown;
    output?: { text?: unknown; content?: unknown };
    message?: { content?: unknown };
    content?: unknown;
  };

  if (typeof obj.text === 'string' && obj.text.trim()) return obj.text.trim();
  if (typeof obj.output?.text === 'string' && obj.output.text.trim()) return obj.output.text.trim();

  const possibleContent = [obj.output?.content, obj.message?.content, obj.content];
  for (const content of possibleContent) {
    if (typeof content === 'string' && content.trim()) return content.trim();
    if (Array.isArray(content)) {
      const joined = content
        .map((part) => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object' && 'text' in part && typeof (part as { text?: unknown }).text === 'string') {
            return (part as { text: string }).text;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n')
        .trim();
      if (joined) return joined;
    }
  }

  return '';
}

function parseSafetyFromText(text: string): CheckImagePromptSafetyOutput {
  const normalized = text.toLowerCase();
  const hasUnsafeSignal = /\b(unsafe|not safe|nsfw|explicit|sexual|nudity|nude|porn|gore|extreme violence)\b/.test(normalized);

  return {
    isSafe: !hasUnsafeSignal,
    reason: hasUnsafeSignal ? 'Prompt appears unsafe for work.' : undefined,
  };
}

export async function checkImagePromptSafety(input: CheckImagePromptSafetyInput): Promise<CheckImagePromptSafetyOutput> {
  return checkImagePromptSafetyFlow(input);
}

const checkImagePromptSafetyFlow = ai.defineFlow(
  {
    name: 'checkImagePromptSafetyFlow',
    inputSchema: CheckImagePromptSafetyInputSchema,
    outputSchema: CheckImagePromptSafetyOutputSchema,
  },
  async (input) => {
    const settings = await getAppSettings();
    const runtimeAi = getAiClient({ providers: settings.aiProviders });

    const runtimePrompt = runtimeAi.definePrompt({
      name: 'checkImagePromptSafetyRuntime',
      input: { schema: CheckImagePromptSafetyInputSchema },
      output: { schema: CheckImagePromptSafetyOutputSchema },
      prompt: promptTemplate,
    });

    const configuredModel = resolveConfiguredModel(settings.defaultTextGenAiModel || settings.defaultGenAiModel, 'text');
    const model = validateModelAvailability(configuredModel, 'text', settings.aiProviders);

    try {
      const { output } = await runtimePrompt(input, { model });
      if (typeof output?.isSafe === 'boolean') {
        return output;
      }
      throw new Error('Structured output missing safety field.');
    } catch (error) {
      console.warn('Image prompt safety structured output failed; retrying with plain text fallback.', error);
      const generated = await runtimeAi.generate({
        model,
        prompt: `${promptTemplate.replace('{{{prompt}}}', input.prompt)}\n\nReply with one line: SAFE or UNSAFE, then optional reason.`,
      });
      const text = extractTextFromGenerateResult(generated);
      return parseSafetyFromText(text);
    }
  }
);
