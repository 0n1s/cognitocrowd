import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { rankTaskResponse } from '@/ai/flows/ai-rank-response';
import { logJsonEvent } from '@/lib/json-logger';

const submitTaskSchema = z.object({
  taskId: z.string().min(1),
  taskType: z.enum([
    'multiple_choice_preference',
    'ranking',
    'likert_scale',
    'classification',
    'sentiment',
    'topic_classification',
    'open_text_feedback',
    'compare_pairwise',
    'label_multiple',
  ]),
  responseData: z.record(z.unknown()),
});

type UserDoc = {
  completedTasks?: string[];
  packageId?: string | null;
  earningsBalance?: number;
  dailyCompletedCount?: number;
  lastCompletionReset?: unknown;
  expertise?: string[];
};

type AppSettingsDoc = {
  aiRankedPayoutMode?: 'off' | 'on' | 'per_package';
  earnPerScoreEnabled?: boolean;
};

type PackageDoc = {
  taskLimit?: unknown;
  aiRankedPayoutEnabled?: unknown;
};

function toDate(value: unknown): Date {
  if (!value) return new Date(0);
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);

  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }

  return new Date(0);
}

function hasMeaningfulResponse(responseData: Record<string, unknown>): boolean {
  if (!responseData || Object.keys(responseData).length === 0) {
    return false;
  }

  return Object.values(responseData).some((value) => {
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'boolean') return true;
    if (value && typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
    return false;
  });
}

async function getNextTaskIdForUser(userId: string, completedTaskIds: string[], expertise: string[]) {
  const expertiseToQuery = Array.from(new Set(['General', ...expertise])).slice(0, 30);

  try {
    const snapshot = await adminDb
      .collection('tasks')
      .where('status', '==', 'Active')
      .where('expertise', 'in', expertiseToQuery)
      .get();

    const nextTask = snapshot.docs.find((taskDoc) => !completedTaskIds.includes(taskDoc.id));
    return nextTask?.id || null;
  } catch {
    const fallbackSnapshot = await adminDb.collection('tasks').where('status', '==', 'Active').get();
    const nextTask = fallbackSnapshot.docs.find((taskDoc) => {
      if (completedTaskIds.includes(taskDoc.id)) return false;
      const taskExpertise = (taskDoc.data().expertise as string | undefined) || 'General';
      return expertiseToQuery.includes(taskExpertise);
    });
    return nextTask?.id || null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Unauthorized request.' }, { status: 401 });
    }

    const idToken = authHeader.slice('Bearer '.length).trim();
    const decoded = await adminAuth.verifyIdToken(idToken);
    const userId = decoded.uid;

    const parsedBody = submitTaskSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json({ success: false, message: 'Invalid request payload.' }, { status: 400 });
    }

    const { taskId, responseData } = parsedBody.data;
    console.log('[task-submit] received', {
      taskId,
      userId,
      taskType: parsedBody.data.taskType,
      responseKeys: Object.keys(responseData || {}),
    });
    await logJsonEvent('[task-submit] received', {
      taskId,
      userId,
      taskType: parsedBody.data.taskType,
      responseKeys: Object.keys(responseData || {}),
      responseData,
    });

    if (!hasMeaningfulResponse(responseData)) {
      console.warn('[task-submit] rejected-empty-response', { taskId, userId });
      await logJsonEvent('[task-submit] rejected-empty-response', { taskId, userId }, 'warn');
      return NextResponse.json({ success: false, message: 'Your answer appears empty. Please answer the question before submitting.' }, { status: 400 });
    }

    const priorResponses = await adminDb.collection('task_responses').where('userId', '==', userId).get();
    if (priorResponses.docs.some((doc) => doc.data().taskId === taskId)) {
      return NextResponse.json({ success: false, message: 'You have already completed this contribution.' }, { status: 409 });
    }

    let aiVerification = {
      isValid: true,
      verification: 'AI verification unavailable; accepted based on basic validation.',
      rank: 5,
      explanation: 'AI ranking unavailable during submission.',
    };

    try {
      console.log('[task-submit] rank-start', { taskId, userId });
      await logJsonEvent('[task-submit] rank-start', { taskId, userId });
      const ranked = await rankTaskResponse({
        taskId,
        response: {
          userId,
          responseData,
        },
      });
      aiVerification = ranked;
      console.log('[task-submit] rank-result', {
        taskId,
        userId,
        isValid: ranked.isValid,
        rank: ranked.rank,
        verification: ranked.verification,
        explanation: ranked.explanation,
      });
      await logJsonEvent('[task-submit] rank-result', {
        taskId,
        userId,
        isValid: ranked.isValid,
        rank: ranked.rank,
        verification: ranked.verification,
        explanation: ranked.explanation,
      });
    } catch (error) {
      console.warn('AI verification/ranking failed for task submission. Continuing with fallback.', error);
      await logJsonEvent('[task-submit] rank-failed-fallback', {
        taskId,
        userId,
        error,
      }, 'warn');
    }

    if (!aiVerification.isValid) {
      const downgradedRank = Math.min(aiVerification.rank, 3);
      console.warn('[task-submit] ai-verification-failed-downgraded', {
        taskId,
        userId,
        verification: aiVerification.verification,
        originalRank: aiVerification.rank,
        downgradedRank,
      });
      await logJsonEvent('[task-submit] ai-verification-failed-downgraded', {
        taskId,
        userId,
        verification: aiVerification.verification,
        originalRank: aiVerification.rank,
        downgradedRank,
      }, 'warn');
      aiVerification = {
        ...aiVerification,
        rank: downgradedRank,
      };
    }

    const payout = await adminDb.runTransaction(async (transaction) => {
      const userRef = adminDb.collection('users').doc(userId);
      const taskRef = adminDb.collection('tasks').doc(taskId);
      const taskResponseRef = adminDb.collection('task_responses').doc(`${userId}_${taskId}`);

      const [userSnap, taskSnap, settingsSnap, responseSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(taskRef),
        transaction.get(adminDb.collection('settings').doc('main')),
        transaction.get(taskResponseRef),
      ]);

      if (!userSnap.exists) {
        throw new Error('User not found.');
      }
      if (!taskSnap.exists) {
        throw new Error('Task not found.');
      }
      if (responseSnap.exists) {
        throw new Error('You have already completed this contribution.');
      }

      const userData = userSnap.data() as UserDoc;
      const taskData = taskSnap.data() as { points?: unknown; status?: unknown };

      if (taskData.status !== 'Active') {
        throw new Error('This task is not active.');
      }

      const taskPoints = typeof taskData.points === 'number' ? taskData.points : 0;
      if (taskPoints <= 0) {
        throw new Error('Task points are invalid.');
      }

      const completedTasks = userData.completedTasks || [];
      if (completedTasks.includes(taskId)) {
        throw new Error('You have already completed this contribution.');
      }

      const FREE_TIER_DAILY_LIMIT = 50;
      let packageLimit = FREE_TIER_DAILY_LIMIT;
      let packageAiRankedPayoutEnabled: boolean | undefined;
      const settingsData = settingsSnap.exists ? (settingsSnap.data() as AppSettingsDoc) : {};
      const globalPayoutMode = settingsData.aiRankedPayoutMode || 'on';
      const earnPerScoreEnabled = settingsData.earnPerScoreEnabled !== false;

      if (userData.packageId) {
        const packageRef = adminDb.collection('packages').doc(userData.packageId);
        const packageSnap = await transaction.get(packageRef);
        if (packageSnap.exists) {
          const packageData = packageSnap.data() as PackageDoc;
          if (typeof packageData.taskLimit === 'number') {
            packageLimit = packageData.taskLimit;
          }
          if (typeof packageData.aiRankedPayoutEnabled === 'boolean') {
            packageAiRankedPayoutEnabled = packageData.aiRankedPayoutEnabled;
          }
        }
      }

      const useRankedPayout =
        globalPayoutMode === 'on' ||
        (globalPayoutMode === 'per_package' && packageAiRankedPayoutEnabled === true);

      const scorePercent = Math.max(0, Math.min(100, Math.round((aiVerification.rank / 10) * 100)));
      const payoutPercent = !useRankedPayout
        ? 100
        : !earnPerScoreEnabled
        ? 100
        : scorePercent > 80
        ? 100
        : scorePercent;
      const pointsEarned = Math.max(0, Math.round((taskPoints * payoutPercent) / 100));

      console.log('[task-submit] payout-mode', {
        taskId,
        userId,
        globalPayoutMode,
        packageId: userData.packageId || null,
        packageAiRankedPayoutEnabled,
        useRankedPayout,
        earnPerScoreEnabled,
        scorePercent,
        payoutPercent,
      });
      await logJsonEvent('[task-submit] payout-mode', {
        taskId,
        userId,
        globalPayoutMode,
        packageId: userData.packageId || null,
        packageAiRankedPayoutEnabled,
        useRankedPayout,
        earnPerScoreEnabled,
        scorePercent,
        payoutPercent,
      });

      let dailyCount = userData.dailyCompletedCount || 0;
      const lastReset = toDate(userData.lastCompletionReset);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (lastReset < today) {
        dailyCount = 0;
      }

      if (dailyCount >= packageLimit) {
        throw new Error('You have reached your daily contribution limit. Please try again tomorrow.');
      }

      const earningsToAddLocal = pointsEarned / 100;
      const newEarnings = (userData.earningsBalance || 0) + earningsToAddLocal;
      const newCompletedTasks = [...completedTasks, taskId];

      transaction.update(userRef, {
        earningsBalance: newEarnings,
        completedTasks: newCompletedTasks,
        dailyCompletedCount: dailyCount + 1,
        lastCompletionReset: Timestamp.now(),
      });

      transaction.set(taskResponseRef, {
        userId,
        taskId,
        pointsEarned,
        maxPoints: taskPoints,
        scorePercent,
        payoutPercent,
        submittedAt: Timestamp.now(),
        responseData,
        rank: aiVerification.rank,
        rankExplanation: aiVerification.explanation,
        verificationPassed: aiVerification.isValid,
        verificationExplanation: aiVerification.verification,
      });

      console.log('[task-submit] transaction-persisted', {
        taskId,
        userId,
        responseId: taskResponseRef.id,
        pointsEarned,
        maxPoints: taskPoints,
        scorePercent,
        payoutPercent,
        aiRankedPayoutApplied: useRankedPayout,
        rank: aiVerification.rank,
        verificationPassed: aiVerification.isValid,
      });
      await logJsonEvent('[task-submit] transaction-persisted', {
        taskId,
        userId,
        responseId: taskResponseRef.id,
        pointsEarned,
        maxPoints: taskPoints,
        scorePercent,
        payoutPercent,
        rank: aiVerification.rank,
        verificationPassed: aiVerification.isValid,
      });

      return {
        earnings: earningsToAddLocal,
        pointsEarned,
        maxPoints: taskPoints,
        scorePercent,
      };
    });

    const userAfterSnap = await adminDb.collection('users').doc(userId).get();
    const userAfter = (userAfterSnap.data() || {}) as UserDoc;
    const nextTaskId = await getNextTaskIdForUser(
      userId,
      userAfter.completedTasks || [],
      userAfter.expertise || []
    );

    return NextResponse.json({
      success: true,
      earnings: payout.earnings,
      pointsEarned: payout.pointsEarned,
      maxPoints: payout.maxPoints,
      scorePercent: payout.scorePercent,
      nextTaskId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    console.error('[task-submit] failed', { message });
    await logJsonEvent('[task-submit] failed', { message, error }, 'error');
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
