import {z} from 'genkit';

const TaskOptionSchema = z.union([
  z.string(),
  z.object({ text: z.string() }),
  z.object({ label: z.string(), text: z.string() }),
]).describe("An option for a contribution. Can be a simple string or a structured object.");

const LikertScaleSchema = z.object({
  min: z.number().int().describe("The minimum value of the scale."),
  max: z.number().int().describe("The maximum value of the scale."),
  labels: z.record(z.string()).describe("Labels for the scale values, e.g., {'1': 'Strongly Disagree', '5': 'Strongly Agree'}"),
}).describe("Configuration for a Likert scale contribution.");

const TaskSettingsSchema = z.object({
    allow_comment: z.boolean().optional().describe("Whether to allow users to add a comment."),
    allow_confidence: z.boolean().optional().describe("Whether to allow users to specify their confidence level."),
    min_chars: z.number().int().optional().describe("Minimum character count for open text feedback."),
    max_chars: z.number().int().optional().describe("Maximum character count for open text feedback."),
    allow_multi_select: z.boolean().optional().describe("Whether multiple options can be selected."),
}).describe("Settings for a contribution.");

export const GenerateTaskOutputSchema = z.object({
  prompt: z.string().describe("The main question or prompt for the contribution. This will be the contribution title."),
  description: z.string().describe("The context or additional description for the contribution."),
  options: z.array(TaskOptionSchema).optional().describe("The generated contribution options, if applicable (e.g., for multiple choice, ranking, etc)."),
  scale: LikertScaleSchema.optional().describe("The scale for a Likert scale contribution. Should only be present for 'likert_scale' type."),
  settings: TaskSettingsSchema.optional().describe("Additional settings for the contribution."),
  award_criteria: z.object({
    explanation: z.string().describe("Explanation of why this contribution is valuable.")
  }).optional().describe("Criteria for awarding points."),
});
