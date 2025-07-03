import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// A list of models that the admin can choose from in the settings panel.
export const AVAILABLE_MODELS = [
    { id: 'googleai/gemini-2.0-flash', name: 'Google - Gemini 2.0 Flash' },
];

export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  model: 'googleai/gemini-2.0-flash', // Default model for the whole system if not specified
});
