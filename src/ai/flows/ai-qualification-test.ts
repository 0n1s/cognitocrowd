'use server';
/**
 * @fileOverview AI flows for generating and evaluating qualification tests.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getAppSettings } from '@/lib/database';

// Schema for a single generated question
const QuestionSchema = z.object({
  question: z.string().describe('The question text.'),
  options: z.array(z.string()).min(4).max(4).describe('An array of 4 possible answers.'),
  answer: z.string().describe('The correct answer from the options.'),
});

// Schema for generating the test
const GenerateTestInputSchema = z.object({
  expertise: z.array(z.string()).describe('A list of user-selected areas of expertise.'),
});
export type GenerateTestInput = z.infer<typeof GenerateTestInputSchema>;

const GenerateTestOutputSchema = z.object({
  questions: z.array(QuestionSchema).length(10).describe('An array of 10 generated questions.'),
});
export type GenerateTestOutput = z.infer<typeof GenerateTestOutputSchema>;

export async function generateQualificationTest(input: GenerateTestInput): Promise<GenerateTestOutput> {
  return generateTestFlow(input);
}

const generateTestPrompt = ai.definePrompt({
  name: 'generateQualificationTestPrompt',
  input: {schema: GenerateTestInputSchema},
  output: {schema: GenerateTestOutputSchema},
  prompt: `You are an expert curriculum designer. Generate a qualification test with 10 multiple-choice questions based on the following user-selected areas of expertise: {{#each expertise}}{{{this}}}{{/each}}.

  The questions should be challenging enough to verify a user's knowledge in these fields. For each question, provide the question text, four distinct options, and specify the correct answer.

  The output MUST be a JSON object that strictly adheres to the provided schema.
  `,
});

const generateTestFlow = ai.defineFlow(
  {
    name: 'generateTestFlow',
    inputSchema: GenerateTestInputSchema,
    outputSchema: GenerateTestOutputSchema,
  },
  async input => {
    const settings = await getAppSettings();
    const model = settings.defaultGenAiModel || 'googleai/gemini-2.0-flash';
    const {output} = await generateTestPrompt(input, { model });
    return output!;
  }
);


// Schema for evaluating the test submission
const EvaluationInputSchema = z.object({
    submissions: z.array(z.object({
        question: z.string(),
        userAnswer: z.string(),
        correctAnswer: z.string(),
    })).describe("The user's submitted answers compared to the correct answers."),
    expertise: z.array(z.string()).describe('The expertise areas the test was based on.'),
});
export type EvaluationInput = z.infer<typeof EvaluationInputSchema>;

const EvaluationOutputSchema = z.object({
    score: z.number().min(0).max(100).describe('A score from 0 to 100 based on the user\'s performance.'),
    feedback: z.string().describe('A brief, constructive feedback summary for the user.'),
    correctCount: z.number().int().describe('The total number of correct answers.'),
    totalCount: z.number().int().describe('The total number of questions.'),
});
export type EvaluationOutput = z.infer<typeof EvaluationOutputSchema>;

export async function evaluateQualificationTest(input: EvaluationInput): Promise<EvaluationOutput> {
    return evaluateTestFlow(input);
}

const evaluateTestPrompt = ai.definePrompt({
    name: 'evaluateQualificationTestPrompt',
    input: {schema: EvaluationInputSchema},
    output: {schema: EvaluationOutputSchema},
    prompt: `You are an expert evaluator. A user has submitted a qualification test based on the expertise areas: {{#each expertise}}{{{this}}}{{/each}}.

    Here is their submission:
    {{#each submissions}}
    - Question: "{{this.question}}"
      - Correct Answer: "{{this.correctAnswer}}"
      - User's Answer: "{{this.userAnswer}}"
    {{/each}}

    Please evaluate their submission. Calculate the number of correct answers.
    Based on their performance, provide a final score from 0 to 100 and write a brief, constructive feedback summary for the user.
    The output must be a JSON object adhering to the schema.
    `,
});

const evaluateTestFlow = ai.defineFlow(
    {
        name: 'evaluateTestFlow',
        inputSchema: EvaluationInputSchema,
        outputSchema: EvaluationOutputSchema,
    },
    async input => {
        const settings = await getAppSettings();
        const model = settings.defaultGenAiModel || 'googleai/gemini-2.0-flash';
        const {output} = await evaluateTestPrompt(input, { model });
        return output!;
    }
);
