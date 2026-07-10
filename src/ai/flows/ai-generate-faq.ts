'use server';
/**
 * @fileOverview Generate FAQ items for the public landing page.
 */

import { ai, getAiClient } from '@/ai/genkit';
import { extractTextFromGenerateResult } from '@/ai/extract-text';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';
import { getAppSettings } from '@/lib/database';
import { z } from 'genkit';

const GenerateFaqInputSchema = z.object({
  count: z.number().int().min(1).max(10).optional().default(6),
});

const FaqItemSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

const GenerateFaqOutputSchema = z.object({
  items: z.array(FaqItemSchema),
});

export type GenerateFaqInput = z.input<typeof GenerateFaqInputSchema>;
export type GenerateFaqOutput = z.infer<typeof GenerateFaqOutputSchema>;

const fallbackFaqItems = [
  {
    question: 'How do I start earning on Trainly?',
    answer: 'Create an account, complete onboarding and qualification, then choose available contributions that match your approved expertise.',
  },
  {
    question: 'How does qualification work?',
    answer: 'You select your areas of expertise and complete a short test so Trainly can match you with the right tasks and maintain quality standards.',
  },
  {
    question: 'What AI tools are available?',
    answer: 'Depending on your plan, you can access AI chat, image generation, video generation, music generation, and creative prompt assistance.',
  },
  {
    question: 'How are deposits used?',
    answer: 'Deposits add funds to your wallet so you can purchase packages and unlock premium platform features.',
  },
  {
    question: 'When can I withdraw earnings?',
    answer: 'Withdrawals are available after you meet the configured minimum balance and follow the withdrawal schedule shown in your wallet.',
  },
  {
    question: 'Why does account approval matter?',
    answer: 'Approval keeps task quality high and helps ensure contributors receive work that matches their skills.',
  },
];

function parseFaqJson(rawText: string) {
  const text = rawText.trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  const candidate = jsonMatch?.[0] || text;
  const parsed = JSON.parse(candidate) as Array<{ question?: unknown; answer?: unknown }>;
  return parsed
    .map((item) => ({
      question: String(item.question || '').trim(),
      answer: String(item.answer || '').trim(),
    }))
    .filter((item) => item.question && item.answer);
}

export async function generateFaq(input: GenerateFaqInput = {}): Promise<GenerateFaqOutput> {
  return generateFaqFlow(GenerateFaqInputSchema.parse(input));
}

const generateFaqFlow = ai.defineFlow(
  {
    name: 'generateFaqFlow',
    inputSchema: GenerateFaqInputSchema,
    outputSchema: GenerateFaqOutputSchema,
  },
  async (input) => {
    const settings = await getAppSettings();
    const runtimeAi = getAiClient({ providers: settings.aiProviders });
    const configuredModel = resolveConfiguredModel(settings.defaultTextGenAiModel || settings.defaultGenAiModel, 'text');
    const model = validateModelAvailability(configuredModel, 'text', settings.aiProviders);
    const fallbackItems = fallbackFaqItems.slice(0, input.count);

    if (!model?.trim()) {
      return { items: fallbackItems };
    }

    try {
      const generated = await runtimeAi.generate({
        model,
        prompt: `Generate ${input.count} concise FAQ items for Trainly, a platform where human experts complete paid AI training contributions and use AI workspace tools like chat, image generation, video generation, and music generation.

Cover earning, qualification, account approval, deposits, withdrawals, and AI workspace access.

Return only a JSON array. Each item must have exactly:
[
  {"question":"...","answer":"..."}
]

No Markdown. No code fences. No commentary.`,
      });

      const items = parseFaqJson(extractTextFromGenerateResult(generated)).slice(0, input.count);
      return { items: items.length > 0 ? items : fallbackItems };
    } catch {
      return { items: fallbackItems };
    }
  }
);
