import type { Package } from '@/lib/types';

export type WorkspaceFeature = {
  label: string;
  enabled: boolean;
};

function formatGenerationLimit(limit?: number, type?: 'daily' | 'lifetime') {
  if (!limit || limit <= 0) return '';
  return `${limit} / ${type === 'lifetime' ? 'package' : 'day'}`;
}

export function getAiWorkspaceFeatures(pkg: Package): WorkspaceFeature[] {
  const legacyTypes = pkg.allowedModelTypes || [];
  const chatModes = [
    (pkg.allowChatNormal ?? legacyTypes.includes('text')) && 'Normal',
    (pkg.allowChatUncensored ?? legacyTypes.includes('uncensored')) && 'Uncensored',
    (pkg.allowChatCoding ?? legacyTypes.includes('coding')) && 'Coding',
    (pkg.allowChatHacking ?? legacyTypes.includes('hacking')) && 'Hacking',
  ].filter((mode): mode is string => Boolean(mode));

  const imageEnabled = Boolean(
    (pkg.allowImageNormal ?? legacyTypes.includes('image')) ||
    (pkg.allowImageUncensored ?? pkg.allowUncensoredImageGeneration ?? legacyTypes.includes('uncensored'))
  );
  const imageLimit = formatGenerationLimit(pkg.imageGenerationLimit, pkg.imageGenerationLimitType);
  const videoEnabled = pkg.allowVideoGeneration === true && (pkg.videoGenerationLimit ?? 0) > 0;
  const videoLimit = formatGenerationLimit(pkg.videoGenerationLimit, pkg.videoGenerationLimitType);
  const musicEnabled = pkg.allowMusicGeneration === true && (pkg.musicGenerationLimit ?? 0) > 0;
  const musicLimit = formatGenerationLimit(pkg.musicGenerationLimit, pkg.musicGenerationLimitType);

  return [
    { label: chatModes.length ? `AI Chat — ${chatModes.join(', ')}` : 'AI Chat', enabled: chatModes.length > 0 },
    { label: imageEnabled && imageLimit ? `Image Generation — ${imageLimit}` : 'Image Generation', enabled: imageEnabled && Boolean(imageLimit) },
    { label: videoEnabled ? `Video Generation — ${videoLimit}` : 'Video Generation', enabled: videoEnabled },
    { label: musicEnabled ? `Music Generation — ${musicLimit}` : 'Music Generation', enabled: musicEnabled },
    { label: 'Music Lyrics & Caption AI Assist', enabled: musicEnabled && pkg.allowMusicGenerationAssist === true },
    { label: 'Reusable Music Style Profiles', enabled: musicEnabled && pkg.allowMusicStyleProfiles === true },
  ];
}
