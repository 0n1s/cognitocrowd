'use server';
/**
 * @fileOverview An AI flow to rank a user's contribution response against others.
 *
 * - rankTaskResponse - Ranks a new response compared to existing ones for the same contribution.
 * - RankResponseInput - The input type for the rankTaskResponse function.
 * - RankResponseOutput - The return type for the rankTaskResponse function.
 */

import { ai, getAiClient } from '@/ai/genkit';
import { z } from 'genkit';
import { Task, TaskResponse } from '@/lib/types';
import type { AiProviderConfig } from '@/lib/types';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';
import { adminDb } from '@/lib/firebase-admin';
import { logJsonEvent } from '@/lib/json-logger';

const RankResponseInputSchema = z.object({
  taskId: z.string().describe('The ID of the contribution being responded to.'),
  response: z.object({
    userId: z.string(),
    responseData: z.record(z.any()),
  }).describe("The new response to be ranked."),
});
export type RankResponseInput = z.infer<typeof RankResponseInputSchema>;

const RankResponseOutputSchema = z.object({
  isValid: z.boolean().describe('Whether the response actually addresses the task question and instructions.'),
  verification: z.string().describe('Short verification note explaining why the answer is valid or invalid.'),
  rank: z.number().min(1).max(10).describe('A quality score from 1 (poor) to 10 (excellent).'),
  explanation: z.string().describe('A brief explanation for the assigned rank.'),
});
export type RankResponseOutput = z.infer<typeof RankResponseOutputSchema>;

// Internal type for the prompt, which includes fetched data.
const RankPromptInputSchema = RankResponseInputSchema.extend({
    task: z.custom<Task>(),
    existingResponses: z.array(z.custom<TaskResponse>()),
});

function clampRank(value: unknown, fallback = 5): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.min(10, Math.round(value)));
}

function parseProvidedDataFromOriginalMessage(originalMessage: string): Record<string, unknown> | null {
  const match = originalMessage.match(/Provided data:\n\n([\s\S]*?)\n\nRequired JSON schema:/);
  if (!match || !match[1]) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[1].trim());
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function toLogSafeJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, currentValue) => {
      if (typeof currentValue === 'bigint') {
        return currentValue.toString();
      }
      if (currentValue instanceof Date) {
        return currentValue.toISOString();
      }
      if (currentValue && typeof currentValue === 'object' && 'toDate' in (currentValue as Record<string, unknown>)) {
        const toDate = (currentValue as { toDate?: unknown }).toDate;
        if (typeof toDate === 'function') {
          try {
            return (toDate as () => Date)().toISOString();
          } catch {
            return currentValue;
          }
        }
      }
      return currentValue;
    },
    2
  );
}

function toPlainRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function unwrapSchemaLikePayload(raw: Record<string, unknown>): Record<string, unknown> {
  const nested = toPlainRecord(raw.properties);
  return nested || raw;
}

function readBooleanField(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
  }
  return null;
}

function readNumberField(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readStringField(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return null;
}

function normalizeRecoveredOutput(raw: Record<string, unknown>): RankResponseOutput | null {
  const source = unwrapSchemaLikePayload(raw);
  const verification = readStringField(source.verification);
  const explanation = readStringField(source.explanation);
  const rankValue = readNumberField(source.rank);
  const isValidValue = readBooleanField(source.isValid);

  const hasAnyMeaningfulField =
    verification !== null ||
    explanation !== null ||
    rankValue !== null ||
    isValidValue !== null;

  if (!hasAnyMeaningfulField) {
    return null;
  }

  const rank = clampRank(rankValue ?? 5, 5);
  const isValid = isValidValue ?? rank >= 4;

  return {
    isValid,
    verification: verification || 'Recovered from malformed model output.',
    rank,
    explanation: explanation || 'Recovered from malformed model output.',
  };
}

function recoverOutputFromPromptError(error: unknown): RankResponseOutput | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const message = (error as { originalMessage?: unknown }).originalMessage;
  if (typeof message !== 'string') {
    return null;
  }

  const providedData = parseProvidedDataFromOriginalMessage(message);
  if (!providedData) {
    return null;
  }

  return normalizeRecoveredOutput(providedData);
}

function extractTextFromGenerateResult(result: unknown): string {
  const maybeText = (result as { text?: unknown })?.text;
  if (typeof maybeText === 'string' && maybeText.trim()) {
    return maybeText.trim();
  }

  const output = (result as { output?: unknown })?.output;
  const outputText = (output as { text?: unknown })?.text;
  if (typeof outputText === 'string' && outputText.trim()) {
    return outputText.trim();
  }

  return '';
}

function parseRankOutputFromText(text: string): RankResponseOutput | null {
  const blockMatch = text.match(/\{[\s\S]*\}/);
  if (blockMatch) {
    try {
      const parsed = JSON.parse(blockMatch[0]);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return normalizeRecoveredOutput(parsed as Record<string, unknown>);
      }
    } catch {
      // fall through to regex extraction
    }
  }

  const isValidMatch = text.match(/"?isValid"?\s*[:=]\s*(true|false)/i);
  const rankMatch = text.match(/"?rank"?\s*[:=]\s*(\d{1,2})/i);
  const verificationMatch = text.match(/"?verification"?\s*[:=]\s*"?([^\n\"]+)"?/i);
  const explanationMatch = text.match(/"?explanation"?\s*[:=]\s*"?([^\n\"]+)"?/i);

  if (!isValidMatch && !rankMatch) {
    return null;
  }

  const isValid = isValidMatch ? isValidMatch[1].toLowerCase() === 'true' : true;
  const rank = clampRank(rankMatch ? Number(rankMatch[1]) : 5, 5);
  const verification = verificationMatch?.[1]?.trim() || 'Recovered from text fallback output.';
  const explanation = explanationMatch?.[1]?.trim() || 'Recovered from text fallback output.';

  return {
    isValid,
    rank,
    verification,
    explanation,
  };
}

function flattenResponseText(responseData: Record<string, unknown>): string {
  const values = Object.values(responseData || {});
  const parts: string[] = [];

  for (const value of values) {
    if (typeof value === 'string') {
      parts.push(value);
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          parts.push(item);
        }
      }
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      parts.push(String(value));
    }
  }

  return parts.join(' ').trim();
}

function applyRankingGuardrails(
  task: Task,
  responseData: Record<string, unknown>,
  aiOutput: RankResponseOutput
): RankResponseOutput {
  const question = `${task.title || ''} ${task.description || ''}`.toLowerCase();
  const responseText = flattenResponseText(responseData).toLowerCase();

  const asksForCause = /\bwhy\b|\breason\b|\bcause\b/.test(question);
  const looksLikeGenericTroubleshooting = /\b(check|try|make sure|reset|contact support|clear cache|reinstall)\b/.test(responseText);
  const hasCausalLanguage = /\b(because|since|due to|caused by|the reason)\b/.test(responseText);

  if (asksForCause && looksLikeGenericTroubleshooting && !hasCausalLanguage) {
    return {
      isValid: false,
      rank: Math.min(aiOutput.rank, 3),
      verification:
        'Response gives generic troubleshooting advice but does not explain the cause asked by the question.',
      explanation:
        'Low score because the answer is not directly responsive to the why/reason prompt.',
    };
  }

  return aiOutput;
}

export async function rankTaskResponse(input: RankResponseInput): Promise<RankResponseOutput> {
  return rankResponseFlow(input);
}

const promptTemplate = `You are an expert evaluator of user-submitted contribution responses. Your goal is to rank a new response by comparing it to the original contribution and other existing responses.

  CONTRIBUTION DETAILS:
  - Title: {{task.title}}
  - Description: {{task.description}}
  - Type: {{task.type}}
  - Options (if any): {{json task.options}}
  - Task settings (if any): {{json task.settings}}
  - Award Criteria (if any): {{json task.award_criteria}}
  - Full Task Payload: {{json task}}

  NEW RESPONSE TO EVALUATE (from user {{response.userId}}):
  - Full response payload: {{json response}}
  - {{json response.responseData}}

  EXISTING RESPONSES FOR COMPARISON:
  - Full existing responses payload: {{json existingResponses}}

  Evaluate with this strict rubric (highest priority first):
  1) Directness to question: does it answer what is being asked, not a different question?
  2) Instruction compliance: does it follow the task type and constraints?
  3) Relevance and factual alignment with task context/options.
  4) Clarity and usefulness.

  Validity rules:
  - Set isValid=true only if the response directly addresses the task's asked outcome.
  - If the task asks for a cause/reason (e.g. "why"), a generic troubleshooting tip is not sufficient.
  - If response is off-topic, generic, or answers a different question, set isValid=false.
  - For invalid responses, rank must be between 1 and 3.

  Ranking anchors:
  - 1-3: Off-topic, generic, or non-answer.
  - 4-6: Partially relevant but incomplete or weak.
  - 7-8: Relevant and clear with minor gaps.
  - 9-10: Fully responsive, precise, and high quality.

  Return concise, objective reasoning. Avoid subjective opinions not tied to the rubric.
  `;

const rankResponseFlow = ai.defineFlow(
  {
    name: 'rankResponseFlow',
    inputSchema: RankResponseInputSchema,
    outputSchema: RankResponseOutputSchema,
  },
  async (input) => {
    console.log('[ai-rank] start', {
      taskId: input.taskId,
      userId: input.response.userId,
      responseKeys: Object.keys(input.response.responseData || {}),
    });
    await logJsonEvent('[ai-rank] start', {
      taskId: input.taskId,
      userId: input.response.userId,
      responseKeys: Object.keys(input.response.responseData || {}),
    });

    // 1. Fetch the original contribution and existing responses with Admin SDK
    const taskSnap = await adminDb.collection('tasks').doc(input.taskId).get();
    if (!taskSnap.exists) {
      console.error('[ai-rank] task-not-found', { taskId: input.taskId });
      await logJsonEvent('[ai-rank] task-not-found', { taskId: input.taskId }, 'error');
      throw new Error(`Contribution with ID ${input.taskId} not found.`);
    }
    const task = {
      id: taskSnap.id,
      ...(taskSnap.data() || {}),
    } as Task;

    // Fetch up to 10 other responses for context
    const responsesSnap = await adminDb
      .collection('task_responses')
      .where('taskId', '==', input.taskId)
      .limit(20)
      .get();

    const existingResponses = responsesSnap.docs
      .map((doc) => ({
        id: doc.id,
        ...(doc.data() || {}),
      }) as TaskResponse)
      .filter((response) => response.userId !== input.response.userId)
      .slice(0, 10);
    console.log('[ai-rank] context', {
      taskId: input.taskId,
      comparisonCount: existingResponses.length,
    });
    await logJsonEvent('[ai-rank] context', {
      taskId: input.taskId,
      comparisonCount: existingResponses.length,
    });
    
    // 2. Get the configured AI model
    const settingsSnap = await adminDb.collection('settings').doc('main').get();
    const settings = (settingsSnap.data() || {}) as {
      defaultTextGenAiModel?: string;
      aiProviders?: AiProviderConfig[];
    };
    const runtimeAi = getAiClient({
      providers: settings.aiProviders,
    });
    const runtimePrompt = runtimeAi.definePrompt({
      name: 'rankResponsePromptRuntime',
      input: { schema: RankPromptInputSchema },
      output: { schema: RankResponseOutputSchema },
      prompt: promptTemplate,
    });
    const configuredTextModel = (settings.defaultTextGenAiModel || '').trim();
    const configuredModel = resolveConfiguredModel(configuredTextModel || undefined, 'text');
    const model = validateModelAvailability(configuredModel, 'text', settings.aiProviders);
    console.log('[ai-rank] model', {
      modelSource: configuredTextModel ? 'defaultTextGenAiModel' : 'text-fallback',
      configuredModel,
      selectedModel: model,
    });
    await logJsonEvent('[ai-rank] model', {
      modelSource: configuredTextModel ? 'defaultTextGenAiModel' : 'text-fallback',
      configuredModel,
      selectedModel: model,
    });

    if (!model || !model.trim()) {
      const noModelFallback: RankResponseOutput = {
        isValid: true,
        verification: 'AI ranking skipped because no text model is configured.',
        rank: 5,
        explanation: 'No model configured; neutral fallback score applied.',
      };
      console.warn('[ai-rank] model-missing-fallback', {
        taskId: input.taskId,
        userId: input.response.userId,
        configuredModel,
        selectedModel: model,
      });
      await logJsonEvent('[ai-rank] model-missing-fallback', {
        taskId: input.taskId,
        userId: input.response.userId,
        configuredModel,
        selectedModel: model,
      }, 'warn');
      return noModelFallback;
    }

    // 3. Call the prompt with all the necessary data
    const promptInput = {
      ...input,
      task,
      existingResponses,
    };

    console.log('[ai-rank] request', {
      taskId: input.taskId,
      userId: input.response.userId,
      model,
      promptInput,
    });
    const promptInputExpandedJson = toLogSafeJson(promptInput);
    console.log('[ai-rank] request-expanded-json', promptInputExpandedJson);
    await logJsonEvent('[ai-rank] request', {
      taskId: input.taskId,
      userId: input.response.userId,
      model,
      promptInput,
      promptInputExpandedJson,
    });

    let output: RankResponseOutput;
    try {
      const result = await runtimePrompt(promptInput, { model });
      if (!result.output) {
        throw new Error('AI ranking returned no structured output.');
      }
      output = result.output;
    } catch (error) {
      const recovered = recoverOutputFromPromptError(error);
      if (recovered) {
        console.warn('[ai-rank] output-recovered-from-error', {
          taskId: input.taskId,
          userId: input.response.userId,
          recovered,
        });
        await logJsonEvent('[ai-rank] output-recovered-from-error', {
          taskId: input.taskId,
          userId: input.response.userId,
          recovered: recovered as unknown as Record<string, unknown>,
          error,
        }, 'warn');
        output = recovered;
      } else {
        console.warn('[ai-rank] structured-prompt-failed-trying-text-fallback', {
          taskId: input.taskId,
          userId: input.response.userId,
          error,
        });
        await logJsonEvent('[ai-rank] structured-prompt-failed-trying-text-fallback', {
          taskId: input.taskId,
          userId: input.response.userId,
          error,
        }, 'warn');

        if (!model || !model.trim()) {
          output = {
            isValid: true,
            verification: 'AI ranking fallback skipped because no text model is configured.',
            rank: 5,
            explanation: 'No model configured; neutral fallback score applied.',
          };
          await logJsonEvent('[ai-rank] text-fallback-skipped-no-model', {
            taskId: input.taskId,
            userId: input.response.userId,
          }, 'warn');
          const guardedOutputNoModel = applyRankingGuardrails(task, input.response.responseData, output);
          return guardedOutputNoModel;
        }

        const fallbackPrompt = `${promptTemplate}\n\nReturn ONLY valid JSON with exactly these keys: isValid (boolean), verification (string), rank (number 1-10), explanation (string).`;
        const generated = await runtimeAi.generate({
          model,
          prompt: fallbackPrompt
            .replace('{{task.title}}', task.title || '')
            .replace('{{task.description}}', task.description || '')
            .replace('{{task.type}}', task.type || '')
            .replace('{{json task.options}}', JSON.stringify(task.options || []))
            .replace('{{json task.award_criteria}}', JSON.stringify(task.award_criteria || {}))
            .replace('{{response.userId}}', input.response.userId)
            .replace('{{json response.responseData}}', JSON.stringify(input.response.responseData || {}))
            .replace('{{#if existingResponses}}', '')
            .replace('{{#each existingResponses}}', '')
            .replace('{{/each}}', '')
            .replace('{{else}}', '')
            .replace('{{/if}}', ''),
        });

        const fallbackText = extractTextFromGenerateResult(generated);
        const parsedFallback = parseRankOutputFromText(fallbackText);

        if (parsedFallback) {
          output = parsedFallback;
          await logJsonEvent('[ai-rank] text-fallback-recovered', {
            taskId: input.taskId,
            userId: input.response.userId,
            parsedFallback: parsedFallback as unknown as Record<string, unknown>,
            fallbackText,
          }, 'warn');
        } else {
          await logJsonEvent('[ai-rank] prompt-failed', {
            taskId: input.taskId,
            userId: input.response.userId,
            error,
            fallbackText,
          }, 'error');
          output = {
            isValid: true,
            verification: 'AI ranking parse failed; fallback baseline score applied.',
            rank: 5,
            explanation: 'Could not parse model output reliably; used neutral fallback score.',
          };
        }
      }
    }

    const guardedOutput = applyRankingGuardrails(task, input.response.responseData, output);

    if (guardedOutput !== output) {
      console.log('[ai-rank] guardrail-adjusted', {
        taskId: input.taskId,
        userId: input.response.userId,
        before: output,
        after: guardedOutput,
      });
      await logJsonEvent('[ai-rank] guardrail-adjusted', {
        taskId: input.taskId,
        userId: input.response.userId,
        before: output as unknown as Record<string, unknown>,
        after: guardedOutput as unknown as Record<string, unknown>,
      }, 'warn');
    }

    console.log('[ai-rank] output', {
      taskId: input.taskId,
      userId: input.response.userId,
      isValid: guardedOutput?.isValid,
      rank: guardedOutput?.rank,
      verification: guardedOutput?.verification,
      explanation: guardedOutput?.explanation,
    });
    await logJsonEvent('[ai-rank] output', {
      taskId: input.taskId,
      userId: input.response.userId,
      isValid: guardedOutput?.isValid,
      rank: guardedOutput?.rank,
      verification: guardedOutput?.verification,
      explanation: guardedOutput?.explanation,
    });

    return guardedOutput;
  }
);
