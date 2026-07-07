import { config } from 'dotenv';
config();

import '@/ai/flows/ai-task-generator.ts';
import '@/ai/flows/ai-assistant-chat.ts';
import '@/ai/flows/ai-bulk-task-generator.ts';
import '@/ai/flows/ai-rank-response.ts';
import '@/ai/flows/ai-qualification-test.ts';
import '@/ai/flows/ai-generate-landing-image.ts';
import '@/ai/flows/ai-improve-landing-page-text.ts';
import '@/ai/flows/ai-improve-image-prompt.ts';
import '@/ai/flows/ai-check-image-prompt-safety.ts';
import '@/ai/flows/ai-generate-profile-image.ts';
import '@/ai/flows/ai-generate-image.ts';
import '@/ai/flows/ai-generate-video.ts';
import '@/ai/flows/ai-generate-music.ts';
import '@/ai/flows/ai-improve-music-lyrics.ts';
import '@/ai/flows/ai-improve-music-caption.ts';
