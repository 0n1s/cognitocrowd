import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { bulkGenerateTasks } from '@/ai/flows/ai-bulk-task-generator';
import { generateQualificationTest } from '@/ai/flows/ai-qualification-test';
import { getAiClient } from '@/ai/genkit';
import type { ModelModality } from '@/ai/models';
import type { AiProviderConfig } from '@/lib/types';
import { validateModelAvailability } from '@/ai/model-resolver';
import { generateOpenAiCompatibleVideo } from '@/ai/openai-video';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { awardReferralBonusForDeposit, reverseReferralBonusForDeposit } from '@/lib/referrals-admin';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

async function tryOpenAiCompatibleImageGeneration(provider: AiProviderConfig, modelId: string, prompt: string) {
  const baseUrl = (provider.baseUrl || '').trim().replace(/\/+$/, '');
  if (!baseUrl) return null;

  const response = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: modelId,
      prompt,
      size: '1024x1024',
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OpenAI-compatible image endpoint failed (${response.status}): ${text || response.statusText}`);
  }

  const payload = (await response.json().catch(() => ({}))) as {
    data?: Array<{ url?: string; b64_json?: string }>;
  };

  const first = payload.data?.[0];
  if (first?.url) {
    return first.url;
  }
  if (first?.b64_json) {
    return `data:image/png;base64,${first.b64_json}`;
  }

  throw new Error('OpenAI-compatible image endpoint returned no image data.');
}

type AdminActionPayload = {
  action: string;
  payload?: Record<string, any>;
};

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized request.');
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  const apiKey = process.env.FIREBASE_WEB_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error('Unauthorized request.');
  }

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
    cache: 'no-store',
  });

  const body = (await response.json().catch(() => ({}))) as {
    users?: Array<{ localId?: string }>;
  };
  const uid = Array.isArray(body.users) ? String(body.users[0]?.localId || '') : '';
  if (!response.ok || !uid) {
    throw new Error('Unauthorized request.');
  }

  const userDoc = await adminDb.collection('users').doc(uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'super_user_alpha_7') {
    throw new Error('Forbidden.');
  }
}

async function handleAction(action: string, payload: Record<string, any>) {
  switch (action) {
    case 'testAdminModel': {
      const { modality, model } = payload as { modality?: ModelModality; model?: string };
      if (!modality || !['text', 'image', 'video'].includes(modality) || !model?.trim()) {
        throw new Error('Invalid payload for testAdminModel.');
      }

      const settingsDoc = await adminDb.collection('settings').doc('main').get();
      const selectedModel = model.trim();
      const [selectedProviderId] = selectedModel.split('/');
      const settingsData = (settingsDoc.data() || {}) as {
        aiProviders?: AiProviderConfig[];
        openAiCompatibleBaseUrl?: string;
        openAiCompatibleApiKey?: string;
        openAiCompatibleProviderName?: string;
      };

      const configuredProviders = (settingsData.aiProviders || []).filter((provider) => Boolean(provider.baseUrl?.trim()));
      const fallbackBaseUrl =
        settingsData.openAiCompatibleBaseUrl ||
        process.env.OPENAI_COMPATIBLE_BASE_URL ||
        '';
      const fallbackApiKey =
        settingsData.openAiCompatibleApiKey ||
        process.env.OPENAI_COMPATIBLE_API_KEY ||
        'openapi-compatible';

      const effectiveProviders: AiProviderConfig[] = configuredProviders.length > 0
        ? configuredProviders
        : fallbackBaseUrl.trim()
        ? [
            {
              id: selectedProviderId || 'openapi',
              name: settingsData.openAiCompatibleProviderName || 'OpenAPI Compatible',
              baseUrl: fallbackBaseUrl,
              apiKey: fallbackApiKey,
              supportsText: true,
              supportsImage: true,
              supportsVideo: true,
              supportsAudio: true,
              discoveredModels: [],
            },
          ]
        : [];

      const runtimeAi = getAiClient({ providers: effectiveProviders });
      const allowedModel = validateModelAvailability(selectedModel, modality, effectiveProviders, false);

      if (!allowedModel) {
        return {
          success: false,
          message: `Model ${selectedModel} is not available for ${modality} generation with current provider configuration.`,
        };
      }

      if (modality === 'text') {
        try {
          const result = await runtimeAi.generate({
            model: allowedModel,
            prompt: 'Respond with one short sentence confirming text model test success.',
          });

          const text =
            (result as any)?.text ||
            (result as any)?.output?.text ||
            (result as any)?.output?.[0]?.content?.[0]?.text ||
            'Text model returned a response.';

          return {
            success: true,
            message: `Text model test passed for ${allowedModel}.`,
            result: { modality, model: allowedModel, text },
          };
        } catch (error) {
          return {
            success: false,
            message: `Text model test failed for ${allowedModel}: ${getErrorMessage(error)}`,
          };
        }
      }

      if (modality === 'image') {
        const prompt = 'A clean abstract gradient profile avatar icon, high quality.';
        let lastError: unknown;
        try {
          const imageResult = await runtimeAi.generate({
            model: allowedModel,
            prompt,
            config: {
              responseModalities: ['TEXT', 'IMAGE'],
            },
          });
          const imageUrl =
            (imageResult as any)?.media?.url ||
            (imageResult as any)?.output?.media?.url ||
            (imageResult as any)?.output?.[0]?.media?.url ||
            (imageResult as any)?.output?.[0]?.content?.find?.((part: any) => part?.media?.url)?.media?.url;

          if (!imageUrl) {
            throw new Error(`Image model ${allowedModel} returned no image output.`);
          }

          return {
            success: true,
            message: `Image model test passed for ${allowedModel}.`,
            result: { modality, model: allowedModel, imageUrl },
          };
        } catch (error) {
          lastError = error;
        }

        try {
          // Some OpenAI-compatible providers reject Google-specific response modality config.
          const imageResult = await runtimeAi.generate({
            model: allowedModel,
            prompt,
          });
          const imageUrl =
            (imageResult as any)?.media?.url ||
            (imageResult as any)?.output?.media?.url ||
            (imageResult as any)?.output?.[0]?.media?.url ||
            (imageResult as any)?.output?.[0]?.content?.find?.((part: any) => part?.media?.url)?.media?.url;

          if (!imageUrl) {
            throw new Error(`Image model ${allowedModel} returned no image output.`);
          }

          return {
            success: true,
            message: `Image model test passed for ${allowedModel}.`,
            result: { modality, model: allowedModel, imageUrl },
          };
        } catch (error) {
          lastError = error;
        }

        const [providerId, modelId] = allowedModel.split('/');
        const provider = effectiveProviders.find((p) => p.id === providerId);
        if (provider && modelId) {
          try {
            const imageUrl = await tryOpenAiCompatibleImageGeneration(provider, modelId, prompt);
            return {
              success: true,
              message: `Image model test passed for ${allowedModel} via OpenAI-compatible images endpoint.`,
              result: { modality, model: allowedModel, imageUrl },
            };
          } catch (error) {
            lastError = error;
          }
        }

        return {
          success: false,
          message: `Image model test failed for ${allowedModel}: ${getErrorMessage(lastError)}`,
        };
      }

      const [providerId] = allowedModel.split('/');
      if (!providerId) {
        return {
          success: false,
          message: `Video model test for ${allowedModel} requires an OpenAI-compatible provider model.`,
        };
      }

      try {
        const result = await generateOpenAiCompatibleVideo({
          model: allowedModel,
          prompt: 'A short cinematic clip of clouds moving over mountains at sunset.',
          providers: effectiveProviders,
        });

        return {
          success: true,
          message: `Video model test passed for ${allowedModel}.`,
          result: {
            modality,
            model: allowedModel,
            videoUrl: result.videoUrl,
            thumbnailUrl: result.thumbnailUrl || 'https://placehold.co/400x300.png',
            simulated: false,
          },
        };
      } catch (error) {
        return {
          success: false,
          message: `Video model test failed for ${allowedModel}: ${getErrorMessage(error)}`,
        };
      }
    }

    case 'updateAdminUser': {
      const { userId, data } = payload;
      if (!userId || !data || typeof data !== 'object') {
        throw new Error('Invalid payload for updateAdminUser.');
      }
      const allowedKeys = ['packageId', 'role', 'earningsBalance', 'depositBalance', 'expertise', 'referralEligible'];
      const updates = Object.fromEntries(Object.entries(data).filter(([key]) => allowedKeys.includes(key)));

      if ('expertise' in updates) {
        const rawExpertise = (updates as { expertise?: unknown }).expertise;
        (updates as { expertise?: string[] }).expertise = Array.isArray(rawExpertise)
          ? rawExpertise.map((value) => String(value).trim()).filter(Boolean)
          : [];
      }

      await adminDb.collection('users').doc(userId).update(updates);
      return { success: true, message: 'User updated successfully.' };
    }

    case 'adjustReferralBalance': {
      const userId = String(payload.userId || '');
      const amount = Number(payload.amount);
      const reason = String(payload.reason || '').trim();
      if (!userId || !Number.isFinite(amount) || amount === 0 || !reason) throw new Error('User, non-zero amount, and reason are required.');
      await adminDb.runTransaction(async (transaction) => {
        const userRef = adminDb.collection('users').doc(userId);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) throw new Error('User not found.');
        const user = userSnap.data() || {};
        if (amount < 0 && (Number(user.referralBalance || 0) < Math.abs(amount) || Number(user.earningsBalance || 0) < Math.abs(amount))) {
          throw new Error('The adjustment exceeds the available referral or earnings balance.');
        }
        const logRef = adminDb.collection('referral_transactions').doc();
        transaction.update(userRef, {
          earningsBalance: Number(user.earningsBalance || 0) + amount,
          referralBalance: Math.max(0, Number(user.referralBalance || 0) + amount),
          referralEarningsTotal: Math.max(0, Number(user.referralEarningsTotal || 0) + amount),
        });
        transaction.set(logRef, {
          referrerUserId: userId,
          referredUserId: null,
          depositId: null,
          depositAmount: 0,
          fixedBonusAmount: 0,
          percentageBonusAmount: 0,
          totalBonus: amount,
          status: amount > 0 ? 'credited' : 'reversed',
          reason,
          manualAdjustment: true,
          createdAt: Timestamp.now(),
          creditedAt: amount > 0 ? Timestamp.now() : null,
        });
      });
      return { success: true, message: 'Referral balance adjusted.' };
    }

    case 'deleteAdminUser': {
      const { userId } = payload;
      if (!userId) throw new Error('userId is required.');

      const userRef = adminDb.collection('users').doc(userId);
      const userSnap = await userRef.get();
      if (!userSnap.exists) throw new Error('User not found.');

      const targetRole = String(userSnap.data()?.role || 'user');
      if (targetRole === 'super_user_alpha_7') {
        throw new Error('Admin accounts cannot be deleted. Use clear transactions instead.');
      }

      try {
        await adminAuth.deleteUser(userId);
      } catch (error) {
        const authError = error as { code?: string };
        if (authError.code !== 'auth/user-not-found') {
          throw error;
        }
      }

      await adminDb.collection('users').doc(userId).delete();
      return { success: true, message: 'User deleted successfully.' };
    }

    case 'clearAdminUserTransactions': {
      const { userId } = payload;
      if (!userId) throw new Error('userId is required.');

      const userRef = adminDb.collection('users').doc(userId);
      const userSnap = await userRef.get();
      if (!userSnap.exists) throw new Error('User not found.');

      const collectionsToClear = [
        'task_responses',
        'withdrawal_requests',
        'deposits',
        'generated_images',
        'generated_videos',
        'generated_musics',
        'chats',
      ];

      const BATCH_SIZE = 500;
      for (const collectionName of collectionsToClear) {
        const snapshot = await adminDb.collection(collectionName).where('userId', '==', userId).get();
        const docs = snapshot.docs;
        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
          const batch = adminDb.batch();
          docs.slice(i, i + BATCH_SIZE).forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      }

      await userRef.update({
        completedTasks: [],
        earningsBalance: 0,
        depositBalance: 0,
        dailyCompletedCount: 0,
        dailyImageGenerationCount: 0,
        dailyVideoGenerationCount: 0,
        dailyMusicGenerationCount: 0,
        packageImageGenerationCount: 0,
        packageVideoGenerationCount: 0,
        packageMusicGenerationCount: 0,
        lastCompletionReset: Timestamp.now(),
        lastImageGenerationReset: Timestamp.now(),
        lastVideoGenerationReset: Timestamp.now(),
        lastMusicGenerationReset: Timestamp.now(),
      });

      return { success: true, message: 'User transactions and activity history have been cleared.' };
    }

    case 'updateUserApprovalStatus': {
      const { userId, status } = payload;
      if (!userId || !['approved', 'rejected'].includes(status)) {
        throw new Error('Invalid payload for updateUserApprovalStatus.');
      }
      await adminDb.collection('users').doc(userId).update({ onboardingStatus: status });
      return { success: true, message: `User status updated to ${status}.` };
    }

    case 'bulkUpdateUserApprovalStatus': {
      const { ids, status } = payload;
      if (!['approved', 'rejected'].includes(status)) {
        throw new Error('Invalid status.');
      }

      let userIdsToUpdate: string[] = [];
      if (ids === 'all') {
        const snapshot = await adminDb.collection('users').where('onboardingStatus', '==', 'pending').get();
        userIdsToUpdate = snapshot.docs.map((doc) => doc.id);
      } else if (Array.isArray(ids)) {
        userIdsToUpdate = ids.filter(Boolean);
      } else {
        throw new Error('Invalid ids payload.');
      }

      if (userIdsToUpdate.length === 0) {
        return { success: true, message: 'No users to update.' };
      }

      const BATCH_SIZE = 500;
      for (let i = 0; i < userIdsToUpdate.length; i += BATCH_SIZE) {
        const batch = adminDb.batch();
        const chunk = userIdsToUpdate.slice(i, i + BATCH_SIZE);
        chunk.forEach((userId) => batch.update(adminDb.collection('users').doc(userId), { onboardingStatus: status }));
        await batch.commit();
      }

      const userCount = userIdsToUpdate.length;
      return { success: true, message: `${userCount} ${userCount === 1 ? 'user has' : 'users have'} been ${status}.` };
    }

    case 'updateWithdrawalRequestStatus': {
      const { requestId, newStatus } = payload;
      if (!requestId || !['pending', 'completed', 'failed'].includes(newStatus)) {
        throw new Error('Invalid payload for updateWithdrawalRequestStatus.');
      }

      await adminDb.runTransaction(async (transaction) => {
        const requestRef = adminDb.collection('withdrawal_requests').doc(requestId);
        const requestDoc = await transaction.get(requestRef);

        if (!requestDoc.exists) throw new Error('Withdrawal request not found.');

        const requestData = requestDoc.data() as { userId: string; amount: number; status: string; source?: string; partnerId?: string };
        const oldStatus = requestData.status;
        if (oldStatus === newStatus) return;

        if (newStatus === 'failed' && oldStatus !== 'failed') {
          if (requestData.source === 'partner_wallet' && requestData.partnerId) {
            const partnerRef = adminDb.collection('countryPartners').doc(String(requestData.partnerId));
            const partnerDoc = await transaction.get(partnerRef);
            if (partnerDoc.exists) {
              const currentBalance = Number(partnerDoc.data()?.partnerWalletBalance || 0);
              transaction.update(partnerRef, { partnerWalletBalance: currentBalance + Number(requestData.amount || 0) });
            }
          } else {
            const userRef = adminDb.collection('users').doc(requestData.userId);
            const userDoc = await transaction.get(userRef);
            if (userDoc.exists) {
              const currentBalance = (userDoc.data()?.earningsBalance || 0) as number;
              transaction.update(userRef, { earningsBalance: currentBalance + requestData.amount });
            }
          }
        }

        transaction.update(requestRef, { status: newStatus, processedAt: Timestamp.now() });
      });

      return { success: true, message: `Request status updated to ${newStatus}.` };
    }

    case 'cancelWithdrawalRequest': {
      const { requestId } = payload;
      if (!requestId) {
        throw new Error('Invalid payload for cancelWithdrawalRequest.');
      }

      await adminDb.runTransaction(async (transaction) => {
        const requestRef = adminDb.collection('withdrawal_requests').doc(String(requestId));
        const requestDoc = await transaction.get(requestRef);

        if (!requestDoc.exists) throw new Error('Withdrawal request not found.');

        const requestData = requestDoc.data() as { userId: string; amount: number; status: string; source?: string; partnerId?: string };
        if (requestData.status !== 'pending') {
          throw new Error('Only pending withdrawal requests can be canceled.');
        }

        if (requestData.source === 'partner_wallet' && requestData.partnerId) {
          const partnerRef = adminDb.collection('countryPartners').doc(String(requestData.partnerId));
          const partnerDoc = await transaction.get(partnerRef);
          if (!partnerDoc.exists) {
            throw new Error('Partner not found for this withdrawal request.');
          }

          const currentPartnerBalance = Number(partnerDoc.data()?.partnerWalletBalance || 0);
          transaction.update(partnerRef, { partnerWalletBalance: currentPartnerBalance + Number(requestData.amount || 0) });
        } else {
          const userRef = adminDb.collection('users').doc(requestData.userId);
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists) {
            throw new Error('User not found for this withdrawal request.');
          }

          const currentBalance = Number(userDoc.data()?.earningsBalance || 0);
          transaction.update(userRef, { earningsBalance: currentBalance + Number(requestData.amount || 0) });
        }
        transaction.update(requestRef, { status: 'canceled', processedAt: Timestamp.now() });
      });

      return { success: true, message: 'Withdrawal request canceled and amount returned to user.' };
    }

    case 'updateDepositStatus': {
      const { depositId, newStatus } = payload;
      if (!depositId || !['pending', 'completed', 'failed'].includes(String(newStatus))) {
        throw new Error('Invalid payload for updateDepositStatus.');
      }

      await adminDb.runTransaction(async (transaction) => {
        const depositRef = adminDb.collection('deposits').doc(String(depositId));
        const depositDoc = await transaction.get(depositRef);
        if (!depositDoc.exists) {
          throw new Error('Deposit not found.');
        }

        const depositData = depositDoc.data() as {
          userId?: string;
          amount?: number;
          status?: string;
        };

        const userId = String(depositData.userId || '');
        const amount = Number(depositData.amount || 0);
        const previousStatus = String(depositData.status || 'pending');
        if (!userId || amount <= 0) {
          throw new Error('Deposit is missing required data.');
        }

        if (previousStatus === newStatus) {
          return;
        }

        const userRef = adminDb.collection('users').doc(userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error('User not found for this deposit.');
        }

        const currentBalance = Number(userDoc.data()?.depositBalance || 0);

        if (previousStatus !== 'completed' && newStatus === 'completed') {
          transaction.update(userRef, { depositBalance: currentBalance + amount });
        }

        if (previousStatus === 'completed' && newStatus !== 'completed') {
          if (currentBalance < amount) {
            throw new Error('Cannot reverse this completed deposit because the user has already spent part of that balance.');
          }
          transaction.update(userRef, { depositBalance: currentBalance - amount });
        }

        transaction.update(depositRef, {
          status: newStatus,
          processedAt: Timestamp.now(),
        });
      });

      if (newStatus === 'completed') {
        await awardReferralBonusForDeposit(String(depositId));
      } else {
        await reverseReferralBonusForDeposit(String(depositId));
      }

      return { success: true, message: `Deposit status updated to ${newStatus}.` };
    }

    case 'createAdminPackage': {
      const { data } = payload;
      if (!data || typeof data !== 'object') throw new Error('Invalid package payload.');
      await adminDb.collection('packages').add(data);
      return { success: true, message: 'Package created successfully.' };
    }

    case 'updateAdminPackage': {
      const { id, data } = payload;
      if (!id || !data || typeof data !== 'object') throw new Error('Invalid package payload.');
      await adminDb.collection('packages').doc(id).update(data);
      return { success: true, message: 'Package updated successfully.' };
    }

    case 'deleteAdminPackage': {
      const { id } = payload;
      if (!id) throw new Error('Package id is required.');
      await adminDb.collection('packages').doc(id).delete();
      return { success: true, message: 'Package deleted successfully.' };
    }

    case 'createAdminTask': {
      const { data } = payload;
      if (!data || typeof data !== 'object') throw new Error('Invalid task payload.');
      await adminDb.collection('tasks').add({
        ...data,
        status: 'Active',
        difficulty: 'Medium',
        expertise: data.expertise || 'General',
        createdAt: Timestamp.now(),
      });
      return { success: true, message: 'Contribution created successfully.' };
    }

    case 'bulkCreateAdminTasks': {
      const { count, expertise, taskTypes } = payload;
      const model = String(payload.model || '').trim();
      const minPointsInput = Number(payload.minPoints);
      const maxPointsInput = Number(payload.maxPoints);
      const hasCustomRange = Number.isFinite(minPointsInput) && Number.isFinite(maxPointsInput);

      let minPoints = 0;
      let maxPoints = 0;
      if (hasCustomRange) {
        minPoints = Math.floor(minPointsInput);
        maxPoints = Math.floor(maxPointsInput);
        if (minPoints <= 0 || maxPoints <= 0 || minPoints > maxPoints) {
          throw new Error('Invalid points range. Min points must be less than or equal to max points.');
        }
      }

      const generatedData = await bulkGenerateTasks({ count, expertise, taskTypes, model: model || undefined });
      if (!generatedData?.tasks?.length) {
        throw new Error('AI failed to generate contributions. Please try again.');
      }

      const batch = adminDb.batch();
      generatedData.tasks.forEach((task) => {
        const ref = adminDb.collection('tasks').doc();
        const generatedPoints = Number(task.points);
        const normalizedPoints = Number.isFinite(generatedPoints)
          ? Math.round(generatedPoints)
          : 100;
        const finalPoints = hasCustomRange
          ? Math.min(maxPoints, Math.max(minPoints, normalizedPoints))
          : normalizedPoints;

        const taskToAdd: Record<string, any> = {
          title: task.prompt,
          description: task.description,
          points: finalPoints,
          type: task.taskType,
          expertise: task.expertise || 'General',
          status: 'Active',
          difficulty: 'Medium',
          createdAt: Timestamp.now(),
        };
        if (task.options) taskToAdd.options = task.options;
        if (task.scale) taskToAdd.scale = task.scale;
        if (task.settings) taskToAdd.settings = task.settings;
        if (task.award_criteria) taskToAdd.award_criteria = task.award_criteria;
        batch.set(ref, taskToAdd);
      });
      await batch.commit();

      return { success: true, message: `${generatedData.tasks.length} contributions created successfully across selected expertises.` };
    }

    case 'deleteAdminTask': {
      const { taskId } = payload;
      if (!taskId) throw new Error('taskId is required.');
      await adminDb.collection('tasks').doc(taskId).delete();
      return { success: true, message: 'Contribution deleted successfully.' };
    }

    case 'updateAdminTaskStatus': {
      const { taskId, status } = payload;
      if (!taskId || !['Active', 'Paused'].includes(status)) throw new Error('Invalid task status update payload.');
      await adminDb.collection('tasks').doc(taskId).update({ status });
      return { success: true, message: 'Contribution status updated.' };
    }

    case 'deleteAllAdminTasks': {
      const snapshot = await adminDb.collection('tasks').get();
      if (snapshot.empty) {
        return { success: true, message: 'There are no contributions to delete.' };
      }
      const BATCH_SIZE = 500;
      const docs = snapshot.docs;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = adminDb.batch();
        docs.slice(i, i + BATCH_SIZE).forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
      return { success: true, message: `Successfully deleted ${docs.length} contributions.` };
    }

    case 'createCountryPartner': {
      const { data } = payload;
      if (!data?.userId || !data?.country) throw new Error('Invalid payload for createCountryPartner.');

      const userRef = adminDb.collection('users').doc(data.userId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) throw new Error('Selected user does not exist.');

      const existingUser = await adminDb.collection('countryPartners').where('userId', '==', data.userId).limit(1).get();
      if (!existingUser.empty) throw new Error('This user is already a partner for another country.');

      await adminDb.runTransaction(async (transaction) => {
        const partnerRef = adminDb.collection('countryPartners').doc();
        transaction.update(userRef, { role: 'country_partner' });
        transaction.set(partnerRef, {
          userId: data.userId,
          name: userDoc.data()?.name,
          email: userDoc.data()?.email,
          country: data.country,
          depositFeePercent: data.depositFeePercent,
          withdrawalFeePercent: data.withdrawalFeePercent,
          partnerWalletBalance: 0,
          paymentMethods: [],
          depositLimit: 0,
          withdrawalLimit: 0,
          minimumWalletBalance: 0,
          permissions: { deposits: true, withdrawals: true, messaging: true },
          isActive: true,
          isAvailable: true,
          createdAt: Timestamp.now(),
        });
      });

      return { success: true, message: 'Country partner created successfully.' };
    }

    case 'getPartnerAdminData': {
      const [applications, partners, transactions, funding, settings, packages] = await Promise.all([
        adminDb.collection('partner_applications').get(), adminDb.collection('countryPartners').get(), adminDb.collection('partner_transactions').get(), adminDb.collection('partner_wallet_funding_requests').get(), adminDb.collection('settings').doc('main').get(), adminDb.collection('packages').get(),
      ]);
      const serializeDoc = (doc: FirebaseFirestore.QueryDocumentSnapshot) => { const data = doc.data(); const normalize = (value: any) => value?.toDate?.().toISOString?.() || value || null; return { id: doc.id, ...data, createdAt: normalize(data.createdAt), updatedAt: normalize(data.updatedAt), reviewedAt: normalize(data.reviewedAt), completedAt: normalize(data.completedAt), notes: (data.notes || []).map((note: any) => ({ ...note, createdAt: normalize(note.createdAt) })) }; };
      const s = settings.data() || {};
      return { success: true, applications: applications.docs.map(serializeDoc), partners: partners.docs.map(serializeDoc), transactions: transactions.docs.map(serializeDoc), fundingRequests: funding.docs.map(serializeDoc), packages: packages.docs.map(serializeDoc), settings: { partnerProgramEnabled: s.partnerProgramEnabled !== false, partnerProgramTitle: s.partnerProgramTitle || 'Partner Program', partnerProgramDescription: s.partnerProgramDescription || '', partnerProgramRules: s.partnerProgramRules || '', partnerMinimumAccountAgeDays: Number(s.partnerMinimumAccountAgeDays || 0), partnerMinimumWalletBalance: Number(s.partnerMinimumWalletBalance || 0), partnerMinimumCompletedTransactions: Number(s.partnerMinimumCompletedTransactions || 0), partnerMinimumPackageId: String(s.partnerMinimumPackageId || ''), partnerRequireVerifiedEmail: s.partnerRequireVerifiedEmail === true, partnerRequireKyc: s.partnerRequireKyc === true, partnerSupportedCountries: s.partnerSupportedCountries || [], partnerDepositDays: s.partnerDepositDays || [], partnerDepositMinimumAmount: Number(s.partnerDepositMinimumAmount || 0), partnerDepositMaximumAmount: Number(s.partnerDepositMaximumAmount || 0), partnerWithdrawalDays: s.partnerWithdrawalDays || [], partnerWithdrawalMinimumAmount: Number(s.partnerWithdrawalMinimumAmount || 0), partnerWithdrawalMaximumAmount: Number(s.partnerWithdrawalMaximumAmount || 0) } };
    }

    case 'reviewPartnerApplication': {
      const applicationId = String(payload.applicationId || ''); const decision = String(payload.decision || ''); const data = payload.data || {};
      if (!applicationId || !['approved','rejected'].includes(decision)) throw new Error('Invalid application review.');
      await adminDb.runTransaction(async (transaction) => {
        const applicationRef = adminDb.collection('partner_applications').doc(applicationId); const application = await transaction.get(applicationRef);
        if (!application.exists || application.data()?.status !== 'pending') throw new Error('Pending application not found.');
        const app = application.data() || {}; const userRef = adminDb.collection('users').doc(String(app.userId)); const user = await transaction.get(userRef); if (!user.exists) throw new Error('Applicant not found.');
        if (decision === 'rejected') { transaction.update(applicationRef, { status: 'rejected', rejectionReason: String(data.rejectionReason || 'Application did not meet requirements.'), reviewedAt: Timestamp.now() }); return; }
        const partnerRef = adminDb.collection('countryPartners').doc();
        transaction.update(userRef, { role: 'country_partner' });
        transaction.set(partnerRef, { userId: app.userId, name: app.name, email: app.email, country: String(data.country || app.country), paymentMethods: Array.isArray(data.paymentMethods) ? data.paymentMethods : app.paymentMethods || [], workingHours: app.workingHours || '', depositFeePercent: Number(data.depositFeePercent || 0), withdrawalFeePercent: Number(data.withdrawalFeePercent || 0), partnerWalletBalance: Number(data.initialWalletBalance || 0), depositLimit: Number(data.depositLimit || 0), withdrawalLimit: Number(data.withdrawalLimit || 0), minimumWalletBalance: Number(data.minimumWalletBalance || 0), permissions: { deposits: data.allowDeposits !== false, withdrawals: data.allowWithdrawals !== false, messaging: data.allowMessaging !== false }, isActive: true, isAvailable: true, applicationId, createdAt: Timestamp.now() });
        transaction.update(applicationRef, { status: 'approved', partnerId: partnerRef.id, reviewedAt: Timestamp.now() });
      });
      return { success: true, message: `Application ${decision}.` };
    }

    case 'updatePartnerProgramSettings': {
      const data = payload.data || {}; const allowed = ['partnerProgramEnabled','partnerProgramTitle','partnerProgramDescription','partnerProgramRules','partnerMinimumAccountAgeDays','partnerMinimumWalletBalance','partnerMinimumCompletedTransactions','partnerMinimumPackageId','partnerRequireVerifiedEmail','partnerRequireKyc','partnerSupportedCountries','partnerDepositDays','partnerDepositMinimumAmount','partnerDepositMaximumAmount','partnerWithdrawalDays','partnerWithdrawalMinimumAmount','partnerWithdrawalMaximumAmount']; const updates: Record<string, any> = {}; allowed.forEach((key) => { if (key in data) updates[key] = data[key]; });
      await adminDb.collection('settings').doc('main').set(updates, { merge: true }); return { success: true, message: 'Partner program settings updated.' };
    }

    case 'reviewPartnerFunding': {
      const requestId = String(payload.requestId || ''); const decision = String(payload.decision || ''); if (!requestId || !['approved','rejected'].includes(decision)) throw new Error('Invalid funding review.');
      await adminDb.runTransaction(async (transaction) => { const requestRef = adminDb.collection('partner_wallet_funding_requests').doc(requestId); const request = await transaction.get(requestRef); if (!request.exists || request.data()?.status !== 'pending') throw new Error('Pending funding request not found.'); const item = request.data() || {}; if (decision === 'approved') { const partnerRef = adminDb.collection('countryPartners').doc(String(item.partnerId)); const partner = await transaction.get(partnerRef); if (!partner.exists) throw new Error('Partner not found.'); transaction.update(partnerRef, { partnerWalletBalance: Number(partner.data()?.partnerWalletBalance || 0) + Number(item.amount || 0) }); } transaction.update(requestRef, { status: decision, reviewedAt: Timestamp.now() }); });
      return { success: true, message: `Funding request ${decision}.` };
    }

    case 'adjustPartnerWallet': {
      const partnerId = String(payload.partnerId || ''); const amount = Number(payload.amount); const reason = String(payload.reason || '').trim(); if (!partnerId || !Number.isFinite(amount) || amount === 0 || !reason) throw new Error('Partner, amount, and reason are required.');
      await adminDb.runTransaction(async (transaction) => { const partnerRef = adminDb.collection('countryPartners').doc(partnerId); const partner = await transaction.get(partnerRef); if (!partner.exists) throw new Error('Partner not found.'); const balance = Number(partner.data()?.partnerWalletBalance || 0); if (balance + amount < 0) throw new Error('Adjustment would make the wallet negative.'); const logRef = adminDb.collection('partner_wallet_logs').doc(); transaction.update(partnerRef, { partnerWalletBalance: balance + amount }); transaction.set(logRef, { partnerId, amount, reason, adminUserId: 'admin', createdAt: Timestamp.now() }); }); return { success: true, message: 'Partner wallet adjusted.' };
    }

    case 'resolvePartnerTransaction': {
      const transactionId = String(payload.transactionId || ''); const resolution = String(payload.resolution || ''); const note = String(payload.note || '').trim(); if (!transactionId || !['complete','cancel'].includes(resolution)) throw new Error('Invalid resolution.');
      let completedDepositId: string | null = null;
      await adminDb.runTransaction(async (transaction) => {
        const ref = adminDb.collection('partner_transactions').doc(transactionId); const doc = await transaction.get(ref); if (!doc.exists) throw new Error('Transaction not found.'); const item = doc.data() || {};
        const userRef = adminDb.collection('users').doc(String(item.userId)); const partnerRef = adminDb.collection('countryPartners').doc(String(item.partnerId)); const [user, partner] = await Promise.all([transaction.get(userRef), transaction.get(partnerRef)]); if (!user.exists || !partner.exists) throw new Error('User or partner not found.');
        if (resolution === 'cancel') { if (item.type === 'withdrawal' && item.status !== 'completed') transaction.update(userRef, { earningsBalance: Number(user.data()?.earningsBalance || 0) + Number(item.amount || 0) }); transaction.update(ref, { status: 'cancelled', adminResolution: note, updatedAt: Timestamp.now() }); return; }
        if (item.type === 'deposit' && item.status !== 'completed') { const balance = Number(partner.data()?.partnerWalletBalance || 0); if (balance < Number(item.amount)) throw new Error('Partner wallet has insufficient funds.'); const depositRef = adminDb.collection('deposits').doc(`partner_${transactionId}`); transaction.update(partnerRef, { partnerWalletBalance: balance - Number(item.amount) }); transaction.update(userRef, { depositBalance: Number(user.data()?.depositBalance || 0) + Number(item.amount) }); transaction.set(depositRef, { userId: item.userId, amount: Number(item.amount), method: `Partner: ${item.partnerName}`, partnerId: item.partnerId, partnerTransactionId: transactionId, status: 'completed', createdAt: Timestamp.now(), processedAt: Timestamp.now() }); completedDepositId = depositRef.id; }
        if (item.type === 'withdrawal' && item.status !== 'completed') transaction.update(partnerRef, { partnerWalletBalance: Number(partner.data()?.partnerWalletBalance || 0) + Number(item.amount) });
        transaction.update(ref, { status: 'completed', adminResolution: note, updatedAt: Timestamp.now(), completedAt: Timestamp.now() });
      });
      if (completedDepositId) await awardReferralBonusForDeposit(completedDepositId);
      return { success: true, message: 'Partner transaction resolved.' };
    }

    case 'updateCountryPartner': {
      const { partnerId, data } = payload;
      if (!partnerId || !data || typeof data !== 'object') throw new Error('Invalid payload for updateCountryPartner.');
      await adminDb.collection('countryPartners').doc(partnerId).update(data);
      return { success: true, message: 'Partner updated successfully.' };
    }

    case 'deleteCountryPartner': {
      const { partnerId } = payload;
      if (!partnerId) throw new Error('partnerId is required.');

      const partnerRef = adminDb.collection('countryPartners').doc(partnerId);
      await adminDb.runTransaction(async (transaction) => {
        const partnerDoc = await transaction.get(partnerRef);
        if (!partnerDoc.exists) throw new Error('Partner not found.');
        const partnerData = partnerDoc.data() as { userId: string };
        transaction.update(adminDb.collection('users').doc(partnerData.userId), { role: 'user' });
        transaction.delete(partnerRef);
      });

      return { success: true, message: 'Partner deleted successfully.' };
    }

    case 'toggleQualificationTestStatus': {
      const { expertise, isEnabled } = payload;
      if (!expertise || typeof isEnabled !== 'boolean') throw new Error('Invalid payload for toggleQualificationTestStatus.');

      const testRef = adminDb.collection('qualification_tests').doc(expertise);
      const testDoc = await testRef.get();
      if (testDoc.exists) {
        await testRef.update({ isEnabled });
      } else {
        await testRef.set({ expertise, isEnabled, questions: [], createdAt: Timestamp.now() });
      }
      return { success: true, message: `"${expertise}" status updated.` };
    }

    case 'generateAndSaveQualificationTest': {
      const { expertise } = payload;
      if (!expertise) throw new Error('Expertise is required.');

      const newQuestionsData = await generateQualificationTest({ expertise: [expertise] });
      if (!newQuestionsData?.questions?.length) {
        throw new Error('AI failed to generate questions.');
      }

      const testRef = adminDb.collection('qualification_tests').doc(expertise);
      const testDoc = await testRef.get();

      if (testDoc.exists) {
        const existing = testDoc.data() as { questions?: unknown[] };
        await testRef.update({ questions: [...(existing.questions || []), ...newQuestionsData.questions] });
        return { success: true, message: `Added ${newQuestionsData.questions.length} more questions to the ${expertise} test.` };
      }

      await testRef.set({
        expertise,
        questions: newQuestionsData.questions,
        createdAt: Timestamp.now(),
        isEnabled: true,
      });
      return { success: true, message: `Test for ${expertise} generated successfully.` };
    }

    case 'deleteQualificationQuestion': {
      const expertise = String(payload.expertise || '').trim();
      const questionIndex = Number(payload.questionIndex);
      if (!expertise || !Number.isInteger(questionIndex) || questionIndex < 0) {
        throw new Error('Invalid payload for deleteQualificationQuestion.');
      }

      const testRef = adminDb.collection('qualification_tests').doc(expertise);
      const testDoc = await testRef.get();
      if (!testDoc.exists) {
        throw new Error('Qualification test not found.');
      }

      const data = testDoc.data() as { questions?: unknown[] };
      const questions = Array.isArray(data.questions) ? [...data.questions] : [];
      if (questionIndex >= questions.length) {
        throw new Error('Question index is out of range.');
      }

      questions.splice(questionIndex, 1);
      await testRef.update({ questions });

      return { success: true, message: 'Question deleted successfully.' };
    }

    case 'recordExpense': {
      const amount = Number(payload.amount);
      const category = String(payload.category || '').trim();
      const note = String(payload.note || '').trim();
      if (!Number.isFinite(amount) || amount <= 0 || !category) {
        throw new Error('Invalid payload for recordExpense.');
      }

      await adminDb.collection('expenses').add({
        amount,
        category,
        note,
        createdAt: Timestamp.now(),
        createdBy: 'admin',
      });

      return { success: true, message: 'Expense recorded successfully.' };
    }

    default:
      throw new Error(`Unsupported admin action: ${action}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    await verifyAdmin(request);

    const body = (await request.json()) as AdminActionPayload;
    if (!body?.action) {
      return NextResponse.json({ success: false, message: 'Action is required.' }, { status: 400 });
    }

    const result = await handleAction(body.action, body.payload || {});
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    const status = message === 'Unauthorized request.' ? 401 : message === 'Forbidden.' ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
