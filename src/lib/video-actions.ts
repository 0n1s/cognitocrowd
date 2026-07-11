

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/firebase";
import { collection, doc, Timestamp, runTransaction, setDoc } from "firebase/firestore";
import type { User, Package, GeneratedVideo } from './types';
import { generateVideo } from "@/ai/flows/ai-generate-video";
import { getAiUserFacingError } from "@/lib/ai-error";

export async function generateAndSaveVideo(userId: string, prompt: string): Promise<{ success: boolean; message: string; video?: GeneratedVideo; }> {
    if (!db) {
        return { success: false, message: 'Firebase not configured.' };
    }

    try {
        let finalVideoObject: GeneratedVideo | null = null;

        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, 'users', userId);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists()) {
                throw new Error('User not found.');
            }
            
            const userData = userDoc.data() as User;
            let userPackage: Package | null = null;
            if (userData.packageId) {
                const packageRef = doc(db, 'packages', userData.packageId);
                const packageDoc = await transaction.get(packageRef);
                if (packageDoc.exists()) {
                    userPackage = packageDoc.data() as Package;
                }
            }

            const videoLimit = userPackage?.videoGenerationLimit ?? 0;
            if (videoLimit <= 0) {
                 throw new Error('Your current package does not allow video generation.');
            }

            const limitType = userPackage?.videoGenerationLimitType || 'daily';
            let updates = {};

            if (limitType === 'lifetime') {
                const lifetimeCount = userData.packageVideoGenerationCount || 0;
                if (lifetimeCount >= videoLimit) {
                    throw new Error('You have reached your video generation limit for this package.');
                }
                updates = { packageVideoGenerationCount: lifetimeCount + 1 };
            } else { // Daily
                const lastReset = userData.lastVideoGenerationReset ? (userData.lastVideoGenerationReset as Timestamp).toDate() : new Date(0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dailyCount = lastReset < today ? 0 : userData.dailyVideoGenerationCount || 0;

                if (dailyCount >= videoLimit) {
                    throw new Error('You have reached your daily video generation limit for today.');
                }
                updates = {
                    dailyVideoGenerationCount: dailyCount + 1,
                    lastVideoGenerationReset: Timestamp.now()
                };
            }

            const genResult = await generateVideo({ prompt });
            if (!genResult.videoUrl) {
                throw new Error("AI failed to generate a video.");
            }

            const newVideoRef = doc(collection(db, 'generated_videos'));
            const newVideoData: Omit<GeneratedVideo, 'id'> = {
                userId,
                prompt,
                videoUrl: genResult.videoUrl,
                thumbnailUrl: genResult.thumbnailUrl,
                createdAt: Timestamp.now(),
            };

            transaction.set(newVideoRef, newVideoData);
            transaction.update(userRef, updates);
            
            finalVideoObject = {
                ...newVideoData,
                id: newVideoRef.id,
                createdAt: (newVideoData.createdAt as Timestamp).toDate().toISOString(),
            };
        });

        if (!finalVideoObject) {
            throw new Error("Transaction failed to complete successfully.");
        }

        revalidatePath('/video-generation');

        return { success: true, message: "Video generated successfully.", video: finalVideoObject };

    } catch (error) {
        console.error("Error generating and saving video:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: getAiUserFacingError(message) };
    }
}
