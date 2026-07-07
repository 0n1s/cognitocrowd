export type ModelModality = 'text' | 'image' | 'video' | 'audio';

export type ModelOption = {
    id: string;
    name: string;
    modalities: ModelModality[];
};

// A list of models that the admin can choose from in the settings panel.
// Provider-prefixed IDs use the format: providerId/modelId.
// export const AVAILABLE_MODELS: ModelOption[] = [
//     { id: 'openapi/deepseek-chat', name: 'OpenAPI Compatible - DeepSeek Chat', modalities: ['text'] },
//     { id: 'openapi/deepseek-reasoner', name: 'OpenAPI Compatible - DeepSeek Reasoner', modalities: ['text'] },
//     { id: 'openapi/gpt-4o-mini', name: 'OpenAPI Compatible - GPT-4o Mini', modalities: ['text'] },
//     { id: 'openapi/gpt-image-1', name: 'OpenAPI Compatible - GPT Image 1', modalities: ['image'] },
//     { id: 'openapi/wan2.2-i2v-plus', name: 'OpenAPI Compatible - Wan 2.2 I2V Plus', modalities: ['video'] },
//     { id: 'openapi/llama3.1:8b', name: 'OpenAPI Compatible - Llama 3.1 8B', modalities: ['text'] },
//     { id: 'openapi/wangp-music', name: 'OpenAPI Compatible - WangP Music', modalities: ['audio'] },
// ];

// export const FALLBACK_TEXT_MODEL = 'openapi/deepseek-chat';
// export const FALLBACK_IMAGE_MODEL = 'openapi/gpt-image-1';
// export const FALLBACK_VIDEO_MODEL = 'openapi/wan2.2-i2v-plus';
// export const FALLBACK_AUDIO_MODEL = 'openapi/wangp-music';



export const AVAILABLE_MODELS: ModelOption[] = [

];

export const FALLBACK_TEXT_MODEL = '';
export const FALLBACK_IMAGE_MODEL = '';
export const FALLBACK_VIDEO_MODEL = '';
export const FALLBACK_AUDIO_MODEL = '';

