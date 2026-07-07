'use server';
/**
 * @fileOverview AI flows for generating and evaluating qualification tests.
 */

import {ai, getAiClient} from '@/ai/genkit';
import {z} from 'genkit';
import { getAppSettings } from '@/lib/database';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';

// Schema for a single generated question
const QuestionSchema = z.object({
  question: z.string().min(1).describe('The question text.'),
  options: z.array(z.string().min(1)).length(4).describe('An array of 4 possible answers.'),
  answer: z.string().min(1).describe('The correct answer from the options.'),
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

function normalizeText(value: unknown): string {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeQuestions(questions: unknown[]): GenerateTestOutput['questions'] {
  const sanitized = questions.slice(0, 10).map((rawQuestion, index) => {
    const questionObj = (rawQuestion && typeof rawQuestion === 'object') ? (rawQuestion as Record<string, unknown>) : {};
    const rawOptions = Array.isArray(questionObj.options) ? questionObj.options : [];

    const cleanedOptions: string[] = [];
    for (const option of rawOptions) {
      const text = normalizeText(option);
      if (!text) continue;
      if (cleanedOptions.some(existing => existing.toLowerCase() === text.toLowerCase())) continue;
      cleanedOptions.push(text);
      if (cleanedOptions.length === 4) break;
    }

    while (cleanedOptions.length < 4) {
      cleanedOptions.push(`Option ${String.fromCharCode(65 + cleanedOptions.length)}`);
    }

    const questionText = normalizeText(questionObj.question) || `Question ${index + 1}`;
    const answerText = normalizeText(questionObj.answer);
    const matchedOption = cleanedOptions.find(option => option.toLowerCase() === answerText.toLowerCase());
    const finalAnswer = matchedOption || cleanedOptions[0];

    return {
      question: questionText,
      options: cleanedOptions,
      answer: finalAnswer,
    };
  });

  if (sanitized.length >= 10) {
    return sanitized;
  }

  const fallbackQuestions: GenerateTestOutput['questions'] = [...sanitized];
  while (fallbackQuestions.length < 10) {
    const idx = fallbackQuestions.length + 1;
    fallbackQuestions.push({
      question: `Question ${idx}`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      answer: 'Option A',
    });
  }
  return fallbackQuestions;
}

const generateTestPromptTemplate = `You are an expert curriculum designer. Generate a qualification test with 10 multiple-choice questions based on the following user-selected areas of expertise: {{#each expertise}}{{{this}}}{{/each}}.

  The questions should be challenging enough to verify a user's knowledge in these fields. For each question, provide the question text, four distinct options, and specify the correct answer.
  The answer must be non-empty and MUST match one of the four options exactly.

  The output MUST be a JSON object that strictly adheres to the provided schema.
  `;

const generateTestFlow = ai.defineFlow(
  {
    name: 'generateTestFlow',
    inputSchema: GenerateTestInputSchema,
    outputSchema: GenerateTestOutputSchema,
  },
  async input => {
    const settings = await getAppSettings();
    const runtimeAi = getAiClient({
      providers: settings.aiProviders,
    });
    const runtimePrompt = runtimeAi.definePrompt({
      name: 'generateQualificationTestPromptRuntime',
      input: {schema: GenerateTestInputSchema},
      output: {schema: GenerateTestOutputSchema},
      prompt: generateTestPromptTemplate,
    });
    const configuredModel = resolveConfiguredModel(settings.defaultTextGenAiModel || settings.defaultGenAiModel, 'text');
    const model = validateModelAvailability(configuredModel, 'text', settings.aiProviders);
    const {output} = await runtimePrompt(input, { model });

    return {
      questions: normalizeQuestions(output?.questions || []),
    };
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

const evaluateTestPromptTemplate = `You are an expert evaluator. A user has submitted a qualification test based on the expertise areas: {{#each expertise}}{{{this}}}{{/each}}.

    Here is their submission:
    {{#each submissions}}
    - Question: "{{this.question}}"
      - Correct Answer: "{{this.correctAnswer}}"
      - User's Answer: "{{this.userAnswer}}"
    {{/each}}

    Please evaluate their submission. Calculate the number of correct answers.
    Based on their performance, provide a final score from 0 to 100 and write a brief, constructive feedback summary for the user.
    The output must be a JSON object adhering to the schema.
    `;

const evaluateTestFlow = ai.defineFlow(
    {
        name: 'evaluateTestFlow',
        inputSchema: EvaluationInputSchema,
        outputSchema: EvaluationOutputSchema,
    },
    async input => {
        const normalizeAnswer = (value: unknown) =>
          String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');

        const totalCount = input.submissions.length;
        const correctCount = input.submissions.reduce((count, submission) => {
          const isCorrect = normalizeAnswer(submission.userAnswer) === normalizeAnswer(submission.correctAnswer);
          return isCorrect ? count + 1 : count;
        }, 0);

        const score = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

        const expertiseLabel = input.expertise.length > 0
          ? input.expertise.join(', ')
          : 'the selected expertise area';

        let feedback = '';
        if (totalCount === 0) {
          feedback = 'No answers were submitted. Please retake the test with complete responses.';
        } else if (score >= 90) {
          feedback = `Excellent work in ${expertiseLabel}. Your answers show strong subject mastery.`;
        } else if (score >= 70) {
          feedback = `Good progress in ${expertiseLabel}. Review the missed concepts to strengthen consistency.`;
        } else if (score >= 50) {
          feedback = `Fair attempt in ${expertiseLabel}. Focus on fundamentals and practice before retrying.`;
        } else {
          feedback = `Your current result in ${expertiseLabel} is below the expected level. Revisit core concepts and try again.`;
        }

        return {
          score,
          feedback,
          correctCount,
          totalCount,
        };
    }
);
