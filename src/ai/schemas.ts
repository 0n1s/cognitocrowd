import {z} from 'genkit';

export const GenerateTaskOutputSchema = z.object({
  prompt: z.string().describe('The generated task prompt.'),
  description: z.string().describe('The generated task description.'),
  options: z.array(z.string()).optional().describe('The generated task options, if applicable (e.g., for multiple choice tasks).'),
});
