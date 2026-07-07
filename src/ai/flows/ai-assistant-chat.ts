// src/ai/flows/ai-assistant-chat.ts
'use server';

/**
 * @fileOverview AI assistant chat flow for providing contribution guidance.
 *
 * - aiAssistantTaskGuidance - A function that handles the AI assistant chat process.
 * - AiAssistantTaskGuidanceInput - The input type for the aiAssistantTaskGuidance function.
 * - AiAssistantTaskGuidanceOutput - The return type for the aiAssistantTaskGuidance function.
 */

import {ai, getAiClient} from '@/ai/genkit';
import {z} from 'genkit';
import { getAppSettings } from '@/lib/database';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';
import type { AppSettings } from '@/lib/types';

const AiAssistantTaskGuidanceInputSchema = z.object({
  query: z.string().describe('The user query for contribution guidance.'),
  chatModel: z.enum(['normal', 'uncensored', 'coding', 'hacking']).optional().default('normal'),
});
export type AiAssistantTaskGuidanceInput = z.infer<typeof AiAssistantTaskGuidanceInputSchema>;

const AiAssistantTaskGuidancePromptInputSchema = AiAssistantTaskGuidanceInputSchema.extend({
  modeInstruction: z.string(),
});

const AiAssistantTaskGuidanceOutputSchema = z.object({
  response: z.string().describe('The AI assistant response providing contribution guidance.'),
  reasoningSummary: z.string().optional().describe('Optional concise summary extracted from internal reasoning tags.'),
});
export type AiAssistantTaskGuidanceOutput = z.infer<typeof AiAssistantTaskGuidanceOutputSchema>;

export async function aiAssistantTaskGuidance(input: AiAssistantTaskGuidanceInput): Promise<AiAssistantTaskGuidanceOutput> {
  return aiAssistantTaskGuidanceFlow(input);
}

const promptTemplate = `You are a helpful AI assistant that provides guidance on available contributions.
  A user will ask you a question about the contributions, and you should respond with helpful and informative advice.

  Active chat mode: {{{chatModel}}}
  Mode behavior: {{{modeInstruction}}}
  
  If the user asks who you are, what model you are, or a similar question about your identity, you MUST respond with: "I am currently under training and enhancement." Do not reveal that you are an AI model or mention that you are an assistant.

  User query: {{{query}}}`;

function getModeInstruction(chatModel: AiAssistantTaskGuidanceInput['chatModel']) {
  if (chatModel === 'uncensored') {
    return 'Be direct and candid while still staying relevant to contribution guidance.';
  }
  if (chatModel === 'coding') {
    return 'Prioritize technical and coding-focused help where relevant.';
  }
  if (chatModel === 'hacking') {
    return 'Focus on security and adversarial thinking in a defensive and ethical way.';
  }
  return 'Provide balanced, general-purpose guidance.';
}

function getConfiguredChatModelForMode(settings: AppSettings, chatModel: AiAssistantTaskGuidanceInput['chatModel']) {
  if (chatModel === 'uncensored') {
    return settings.defaultUncensoredAiModel || settings.defaultTextGenAiModel || settings.defaultGenAiModel;
  }
  if (chatModel === 'coding') {
    return settings.defaultCodingAiModel || settings.defaultTextGenAiModel || settings.defaultGenAiModel;
  }
  if (chatModel === 'hacking') {
    return settings.defaultHackingAiModel || settings.defaultTextGenAiModel || settings.defaultGenAiModel;
  }
  return settings.defaultTextGenAiModel || settings.defaultGenAiModel;
}

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

function sanitizeModelResponse(rawText: string): { response: string; reasoningSummary?: string } {
  const thinkMatches = Array.from(rawText.matchAll(/<think>([\s\S]*?)<\/think>/gi));
  const thinkContent = thinkMatches
    .map((match) => (match[1] || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  const withoutThinkBlocks = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
    .replace(/<think>[\s\S]*$/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!thinkContent) {
    return { response: withoutThinkBlocks || rawText.trim() };
  }

  const reasoningSummary = thinkContent.length > 240
    ? `${thinkContent.slice(0, 237)}...`
    : thinkContent;

  return {
    response: withoutThinkBlocks || 'Sorry, I could not produce a clean response. Please try again.',
    reasoningSummary,
  };
}

const aiAssistantTaskGuidanceFlow = ai.defineFlow(
  {
    name: 'aiAssistantTaskGuidanceFlow',
    inputSchema: AiAssistantTaskGuidanceInputSchema,
    outputSchema: AiAssistantTaskGuidanceOutputSchema,
  },
  async input => {
    const normalizedInput = {
      ...input,
      chatModel: input.chatModel || 'normal',
    };
    const settings = await getAppSettings();
    const runtimeAi = getAiClient({
      providers: settings.aiProviders,
    });
    const runtimePrompt = runtimeAi.definePrompt({
      name: 'aiAssistantTaskGuidancePromptRuntime',
      input: {schema: AiAssistantTaskGuidancePromptInputSchema},
      output: {schema: AiAssistantTaskGuidanceOutputSchema},
      prompt: promptTemplate,
    });
    const configuredModelForMode = getConfiguredChatModelForMode(settings, normalizedInput.chatModel);
    const configuredModel = resolveConfiguredModel(configuredModelForMode, 'text');
    const model = validateModelAvailability(configuredModel, 'text', settings.aiProviders);

    const promptInput = {
      ...normalizedInput,
      modeInstruction: getModeInstruction(normalizedInput.chatModel),
    };

    try {
      const {output} = await runtimePrompt(promptInput, { model });
      if (output?.response && output.response.trim()) {
        const sanitized = sanitizeModelResponse(output.response);
        return {
          response: sanitized.response,
          reasoningSummary: output.reasoningSummary || sanitized.reasoningSummary,
        };
      }
      throw new Error('Structured output missing response field.');
    } catch (error) {
      console.warn('Structured chat output failed; retrying with plain text fallback.', error);
      const plainPrompt = `You are a helpful AI assistant that provides guidance on available contributions.\n\nActive chat mode: ${promptInput.chatModel}\nMode behavior: ${promptInput.modeInstruction}\n\nIf the user asks who you are, what model you are, or a similar question about your identity, you MUST respond with: \"I am currently under training and enhancement.\" Do not reveal that you are an AI model or mention that you are an assistant.\n\nUser query: ${promptInput.query}`;
      const generated = await runtimeAi.generate({
        model,
        prompt: plainPrompt,
      });
      const responseText = extractTextFromGenerateResult(generated);
      const sanitized = sanitizeModelResponse(responseText || '');
      return {
        response: sanitized.response || 'Sorry, I encountered an error while generating a response. Please try again.',
        reasoningSummary: sanitized.reasoningSummary,
      };
    }
  }
);
