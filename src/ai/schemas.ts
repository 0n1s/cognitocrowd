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

export const GenerateImageInputSchema = z.object({
  prompt: z.string().describe('A text prompt to generate an image from.'),
  imageModel: z.enum(['normal', 'uncensored']).optional().default('normal'),
});
export type GenerateImageInput = z.infer<typeof GenerateImageInputSchema>;

export const GenerateImageOutputSchema = z.object({
    imageDataUri: z.string().describe("The generated image as a data URI. Expected format: 'data:image/png;base64,<encoded_data>'."),
});
export type GenerateImageOutput = z.infer<typeof GenerateImageOutputSchema>;


export const GenerateVideoInputSchema = z.object({
  prompt: z.string().describe('A text prompt to generate a video from.'),
});
export type GenerateVideoInput = z.infer<typeof GenerateVideoInputSchema>;

export const GenerateVideoOutputSchema = z.object({
    videoUrl: z.string().url().describe("The URL of the generated video file."),
    thumbnailUrl: z.string().url().describe("The URL of a thumbnail for the generated video."),
});
export type GenerateVideoOutput = z.infer<typeof GenerateVideoOutputSchema>;

export const GenerateMusicInputSchema = z.object({
  prompt: z.string().describe('The song lyrics or core music prompt.'),
  altPrompt: z.string().optional().describe('Optional music caption describing style, mood, and instrumentation.'),
  durationSeconds: z.number().int().min(10).max(240).optional().default(40),
  numInferenceSteps: z.number().int().min(10).max(200).optional().default(100),
  sampleSolver: z.string().optional().default('euler'),
});
export type GenerateMusicInput = z.infer<typeof GenerateMusicInputSchema>;

export const GenerateMusicOutputSchema = z.object({
  audioUrl: z.string().url().describe('The URL of the generated music file.'),
});
export type GenerateMusicOutput = z.infer<typeof GenerateMusicOutputSchema>;

export const ImproveImagePromptInputSchema = z.object({
  prompt: z.string().describe('The original image prompt to be improved.'),
});
export type ImproveImagePromptInput = z.infer<typeof ImproveImagePromptInputSchema>;

export const ImproveImagePromptOutputSchema = z.object({
  improvedPrompt: z.string().describe('The AI-improved version of the image prompt.'),
});
export type ImproveImagePromptOutput = z.infer<typeof ImproveImagePromptOutputSchema>;

export const ImproveMusicPromptInputSchema = z.object({
  prompt: z.string().describe('The original text to improve for music generation.'),
});
export type ImproveMusicPromptInput = z.infer<typeof ImproveMusicPromptInputSchema>;

export const ImproveMusicPromptOutputSchema = z.object({
  improvedPrompt: z.string().describe('The AI-improved music generation prompt.'),
});
export type ImproveMusicPromptOutput = z.infer<typeof ImproveMusicPromptOutputSchema>;
