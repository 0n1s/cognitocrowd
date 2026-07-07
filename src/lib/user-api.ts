import { auth } from '@/lib/firebase';
import type { GeneratedImage, GeneratedMusic, LeaderboardEntry, MusicStyleProfile } from '@/lib/types';

type ApiResult<T = Record<string, unknown>> = T & {
  success: boolean;
  message?: string;
};

async function runUserAction<T = Record<string, unknown>>(action: string, payload: Record<string, unknown>): Promise<ApiResult<T>> {
  if (!auth?.currentUser) {
    return { success: false, message: 'You must be logged in.' } as ApiResult<T>;
  }

  const idToken = await auth.currentUser.getIdToken();
  const response = await fetch('/api/user/actions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ action, payload }),
  });

  const result = await response.json().catch(() => ({ success: false, message: 'Invalid server response.' }));
  if (!response.ok && result.success !== false) {
    return { success: false, message: 'Request failed.' } as ApiResult<T>;
  }

  return result as ApiResult<T>;
}

export async function requestWithdrawal(_userId: string, amount: number, methodId: string, fieldValues: Record<string, string>, currency?: string) {
  return runUserAction('requestWithdrawal', {
    amount,
    methodId,
    fieldValues,
    currency,
  });
}

export async function initiateDeposit(_userId: string, amount: number, methodId: string, fieldValues?: Record<string, string>, currency?: string) {
  return runUserAction('initiateDeposit', { amount, methodId, fieldValues, currency });
}

export async function getUserWithdrawalHistory(_userId: string) {
  return runUserAction<{ withdrawals?: any[] }>('getUserWithdrawalHistory', {});
}

export async function getWalletData(_userId: string) {
  return runUserAction<{
    balances?: { earnings: number; deposits: number; referrals: number };
    settings?: Record<string, unknown>;
    withdrawalLimits?: { min: number; max: number; allowed: boolean };
    deposits?: any[];
    withdrawals?: any[];
    packagePurchases?: any[];
  }>('getWalletData', {});
}

export async function getReferralDashboard() {
  return runUserAction<{
    referralCode?: string;
    referralBalance?: number;
    totalEarnings?: number;
    referredUsers?: Array<Record<string, any>>;
    transactions?: Array<Record<string, any>>;
    hasReferrer?: boolean;
    canCompleteReferral?: boolean;
  }>('getReferralDashboard', {});
}

export async function linkRegistrationReferral(referralCode: string) {
  return runUserAction<{ referredBy?: string }>('linkRegistrationReferral', { referralCode });
}

export async function getPartnerProgramData() { return runUserAction<any>('getPartnerProgramData', {}); }
export async function submitPartnerApplication(data: Record<string, unknown>) { return runUserAction('submitPartnerApplication', data); }
export async function createPartnerTransaction(data: { type: 'deposit' | 'withdrawal'; partnerId: string; amount: number; paymentMethod: string; paymentInstructions?: string; currency?: string }) { return runUserAction('createPartnerTransaction', data); }
export async function getPartnerPortalData() { return runUserAction<any>('getPartnerPortalData', {}); }
export async function updatePartnerAvailability(available: boolean) { return runUserAction('updatePartnerAvailability', { available }); }
export async function updatePartnerPortalConfig(data: {
  available: boolean;
  depositAvailable: boolean;
  withdrawalAvailable: boolean;
  depositLimit: number;
  withdrawalLimit: number;
  paymentMethods: string[];
}) {
  return runUserAction('updatePartnerPortalConfig', data);
}
export async function requestPartnerWalletFunding(amount: number) { return runUserAction('requestPartnerWalletFunding', { amount }); }
export async function requestPartnerWithdrawal(amount: number, methodId: string, fieldValues: Record<string, string>, currency?: string) {
  return runUserAction('requestPartnerWithdrawal', { amount, methodId, fieldValues, currency });
}
export async function partnerTransactionAction(transactionId: string, actionName: string) { return runUserAction('partnerTransactionAction', { transactionId, actionName }); }
export async function addPartnerTransactionNote(transactionId: string, message: string) { return runUserAction('addPartnerTransactionNote', { transactionId, message }); }

export async function purchasePackage(_userId: string, packageId: string) {
  return runUserAction('purchasePackage', { packageId });
}

export async function updateUserOnboardingProfile(_userId: string, data: { country: string; languages: string[] }) {
  return runUserAction('updateUserOnboardingProfile', data);
}

export async function updateUserExpertise(_userId: string, data: { expertise: string[] }) {
  return runUserAction('updateUserExpertise', data);
}

export async function startUserQualificationTest(_userId: string, expertise: string[]) {
  return runUserAction<{ questions?: unknown[] }>('startUserQualificationTest', { expertise });
}

export async function getQualificationTestSecuritySettings(_userId: string) {
  return runUserAction<{
    antiCopyEnabled?: boolean;
    copyAttemptLimit?: number;
    questionLimit?: number;
  }>('getQualificationTestSecuritySettings', {});
}

export async function logQualificationCopyAttempt(
  _userId: string,
  data: {
    attemptCount: number;
    copyAttemptLimit: number;
    expertise: string[];
    browserFingerprint: string;
  }
) {
  return runUserAction('logQualificationCopyAttempt', data);
}

export async function submitQualificationTest(
  _userId: string,
  questions: unknown[],
  userAnswers: Record<number, string>,
  expertise: string[],
  browserFingerprint: string,
  options?: {
    forcedFailureReason?: string;
    copyAttempts?: number;
  }
) {
  return runUserAction('submitQualificationTest', {
    questions,
    userAnswers,
    expertise,
    browserFingerprint,
    forcedFailureReason: options?.forcedFailureReason,
    copyAttempts: options?.copyAttempts,
  });
}

export async function setupNewUser(_userId: string, name: string, email: string, referralCode?: string) {
  return runUserAction<{ referredBy?: string | null }>('setupNewUser', { name, email, referralCode });
}

export async function getInitialChatHistory(_userId: string) {
  return runUserAction<{ session: unknown | null }>('getInitialChatHistory', {});
}

export async function clearUserChats(_userId: string) {
  return runUserAction('clearUserChats', {});
}

export async function logChatInteraction(
  _userId: string,
  chatId: string | null,
  userQuery: string,
  aiResponse: string
) {
  return runUserAction<{ newChatId: string }>('logChatInteraction', {
    chatId,
    userQuery,
    aiResponse,
  });
}

export async function generateAndSaveImage(_userId: string, prompt: string, imageModel: 'normal' | 'uncensored' = 'normal') {
  return runUserAction<{ image?: GeneratedImage }>('generateAndSaveImage', { prompt, imageModel });
}

export async function improveImagePrompt(_userId: string, prompt: string) {
  return runUserAction<{ improvedPrompt?: string }>('improveImagePrompt', { prompt });
}

export async function generateAndSaveMusic(
  _userId: string,
  payload: {
    prompt: string;
    altPrompt?: string;
    durationSeconds?: number;
  }
) {
  return runUserAction<{
    music?: {
      id: string;
      userId: string;
      prompt: string;
      altPrompt?: string;
      durationSeconds: number;
      audioUrl: string;
      storagePath?: string;
      createdAt: string;
    };
  }>('generateAndSaveMusic', payload);
}

export async function getUserGeneratedMusic(_userId: string) {
  return runUserAction<{ music?: GeneratedMusic[] }>('getUserGeneratedMusic', {});
}

export async function deleteGeneratedMusic(_userId: string, musicId: string) {
  return runUserAction('deleteGeneratedMusic', { musicId });
}

export async function improveMusicLyrics(_userId: string, prompt: string) {
  return runUserAction<{ improvedPrompt?: string }>('improveMusicLyrics', { prompt });
}

export async function improveMusicCaption(_userId: string, prompt: string) {
  return runUserAction<{ improvedPrompt?: string }>('improveMusicCaption', { prompt });
}

export async function improveMusicIdea(_userId: string, prompt: string) {
  return runUserAction<{ improvedPrompt?: string }>('improveMusicIdea', { prompt });
}

export async function generateRandomMusicIdea(_userId: string, styleCaption?: string) {
  return runUserAction<{ improvedPrompt?: string }>('generateRandomMusicIdea', { styleCaption });
}

export async function suggestMusicDuration(_userId: string, lyrics: string, caption?: string) {
  return runUserAction<{ durationSeconds?: number }>('suggestMusicDuration', { lyrics, caption });
}

export async function getMusicStyleProfiles(_userId: string) {
  return runUserAction<{ profiles?: MusicStyleProfile[] }>('getMusicStyleProfiles', {});
}

export async function saveMusicStyleProfile(_userId: string, name: string, caption: string) {
  return runUserAction<{ profile?: MusicStyleProfile }>('saveMusicStyleProfile', { name, caption });
}

export async function deleteMusicStyleProfile(_userId: string, profileId: string) {
  return runUserAction('deleteMusicStyleProfile', { profileId });
}

export async function deleteGeneratedImage(_userId: string, imageId: string) {
  return runUserAction('deleteGeneratedImage', { imageId });
}

export async function deleteGeneratedImages(_userId: string, imageIds: string[]) {
  return runUserAction<{ deletedIds?: string[]; failedIds?: string[] }>('deleteGeneratedImages', { imageIds });
}

export async function getLeaderboardData(_userId: string) {
  return runUserAction<{ leaderboard?: LeaderboardEntry[]; leaderboardEnabled?: boolean }>('getLeaderboardData', {});
}
