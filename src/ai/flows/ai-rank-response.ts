'use server';
/**
 * @fileOverview An AI flow to rank a user's contribution response against others.
 *
 * - rankTaskResponse - Ranks a new response compared to existing ones for the same contribution.
 * - RankResponseInput - The input type for the rankTaskResponse function.
 * - RankResponseOutput - The return type for the rankTaskResponse function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getTask, getTaskResponses } from '@/lib/database';
import { Task, TaskResponse } from '@/lib/types';

const RankResponseInputSchema = z.object({
  taskId: z.string().describe('The ID of the contribution being responded to.'),
  response: z.object({
    userId: z.string(),
    responseData: z.record(z.any()),
  }).describe("The new response to be ranked."),
});
export type RankResponseInput = z.infer<typeof RankResponseInputSchema>;

const RankResponseOutputSchema = z.object({
  rank: z.number().min(1).max(10).describe('A quality score from 1 (poor) to 10 (excellent).'),
  explanation: z.string().describe('A brief explanation for the assigned rank.'),
});
export type RankResponseOutput = z.infer<typeof RankResponseOutputSchema>;

// Internal type for the prompt, which includes fetched data.
const RankPromptInputSchema = RankResponseInputSchema.extend({
    task: z.custom<Task>(),
    existingResponses: z.array(z.custom<TaskResponse>()),
});

export async function rankTaskResponse(input: RankResponseInput): Promise<RankResponseOutput> {
  return rankResponseFlow(input);
}

const prompt = ai.definePrompt({
  name: 'rankResponsePrompt',
  input: { schema: RankPromptInputSchema },
  output: { schema: RankResponseOutputSchema },
  prompt: `You are an expert evaluator of user-submitted contribution responses. Your goal is to rank a new response by comparing it to the original contribution and other existing responses.

  CONTRIBUTION DETAILS:
  - Title: {{task.title}}
  - Description: {{task.description}}
  - Type: {{task.type}}

  NEW RESPONSE TO EVALUATE (from user {{response.userId}}):
  - {{json response.responseData}}

  EXISTING RESPONSES FOR COMPARISON:
  {{#if existingResponses}}
    {{#each existingResponses}}
    - Response from user {{this.userId}}: {{json this.responseData}}
    {{/each}}
  {{else}}
    - No other responses exist yet.
  {{/if}}

  Based on the contribution's goal, the new response, and the context from other responses, please provide a quality score from 1 (poor) to 10 (excellent) for the new response. Also provide a brief, constructive explanation for your score. Consider factors like clarity, helpfulness, adherence to instructions, and originality.
  `,
});

const rankResponseFlow = ai.defineFlow(
  {
    name: 'rankResponseFlow',
    inputSchema: RankResponseInputSchema,
    outputSchema: RankResponseOutputSchema,
  },
  async (input) => {
    // 1. Fetch the original contribution and existing responses
    const task = await getTask(input.taskId);
    if (!task) {
      throw new Error(`Contribution with ID ${input.taskId} not found.`);
    }

    // Fetch up to 10 other responses for context
    const existingResponses = (await getTaskResponses(input.taskId))
        .filter(r => r.userId !== input.response.userId)
        .slice(0, 10);

    // 2. Call the prompt with all the necessary data
    const { output } = await prompt({
        ...input,
        task,
        existingResponses
    });

    return output!;
  }
);
