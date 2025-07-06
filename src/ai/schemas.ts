import {z} from 'genkit';

const TaskOptionSchema = z.union([
  z.string(),
  z.object({ text: z.string() }),
  z.object({ label: z.string(), text: z.string() }),
]).describe("An option for a contribution. Can be a simple string or a structured object.");

const LikertScaleSchema = z.object({
  min: z.number().int().describe("The minimum value of the scale."),
  max: z.number().int().describe("The maximum value of the scale."),
  labels: z.array(z.object({
      value: z.number().int().describe("The numeric value for the label."),
      label: z.string().describe("The text label for the value.")
  })).describe("An array of labels for specific scale values, e.g., [{value: 1, label: 'Strongly Disagree'}, {value: 5, label: 'Strongly Agree'}]"),
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
  points: z.number().int().min(10).max(500).optional().describe("An appropriate point value for the contribution based on its complexity, between 10 and 500."),
  options: z.array(TaskOptionSchema).optional().describe("The generated contribution options, if applicable (e.g., for multiple choice, ranking, etc)."),
  scale: LikertScaleSchema.optional().describe("The scale for a Likert scale contribution. Should only be present for 'likert_scale' type."),
  settings: TaskSettingsSchema.optional().describe("Additional settings for the contribution."),
  award_criteria: z.object({
    explanation: z.string().describe("Explanation of why this contribution is valuable.")
  }).optional().describe("Criteria for awarding points."),
});

export const GenerateLandingImageInputSchema = z.object({
  prompt: z.string().describe('A text prompt to generate an image from.'),
});
export type GenerateLandingImageInput = z.infer<typeof GenerateLandingImageInputSchema>;

export const GenerateLandingImageOutputSchema = z.object({
    imageDataUri: z.string().describe("The generated image as a data URI. Expected format: 'data:image/png;base64,<encoded_data>'."),
});
export type GenerateLandingImageOutput = z.infer<typeof GenerateLandingImageOutputSchema>;

export const ImproveTextSchema = z.object({
  originalText: z.string().describe('The original text to be improved.'),
  context: z.string().describe('The context of the text (e.g., "hero title", "feature description").'),
});
export type ImproveTextInput = z.infer<typeof ImproveTextSchema>;

export const ImproveTextOutputSchema = z.object({
  improvedText: z.string().describe('The AI-improved version of the text.'),
});
export type ImproveTextOutput = z.infer<typeof ImproveTextOutputSchema>;

export const GenerateProfileImageInputSchema = z.object({
  prompt: z.string().describe('A text prompt to generate a user profile picture.'),
});
export type GenerateProfileImageInput = z.infer<typeof GenerateProfileImageInputSchema>;

export const GenerateProfileImageOutputSchema = z.object({
    imageDataUri: z.string().describe("The generated image as a data URI. Expected format: 'data:image/png;base64,<encoded_data>'."),
});
export type GenerateProfileImageOutput = z.infer<typeof GenerateProfileImageOutputSchema>;
