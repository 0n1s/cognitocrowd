

"use server";

import { revalidatePath } from "next/cache";
import { db, storage } from "@/lib/firebase";
import { collection, doc, getDoc, Timestamp, runTransaction, setDoc, updateDoc } from "firebase/firestore";
import { ref, getDownloadURL, uploadBytes } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";

import type { User, Package, GeneratedImage } from './types';
import { getPackage } from './database';
import { generateImage } from "@/ai/flows/ai-generate-image";

export async function generateAndSaveImage(userId: string, prompt: string): Promise<{ success: boolean; message: string; image?: GeneratedImage; }> {
    if (!db || !storage) {
        return { success: false, message: 'Firebase not configured.' };
    }

    try {
        let newImageData: Omit<GeneratedImage, 'id'> | null = null;
        let finalImageObject: GeneratedImage | null = null;

        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, 'users', userId);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists()) {
                throw new Error('User not found.');
            }
            
            const userData = userDoc.data() as User;
            let userPackage: Package | null = null;
            if (userData.packageId) {
                // We must fetch the package inside the transaction if its properties are used for validation
                const packageRef = doc(db, 'packages', userData.packageId);
                const packageDoc = await transaction.get(packageRef);
                if (packageDoc.exists()) {
                    userPackage = packageDoc.data() as Package;
                }
            }

            const imageLimit = userPackage?.imageGenerationLimit ?? 0;
            if (imageLimit <= 0) {
                 throw new Error('Your current package does not allow image generation.');
            }

            const limitType = userPackage?.imageGenerationLimitType || 'daily';
            let updates = {};

            if (limitType === 'lifetime') {
                const lifetimeCount = userData.packageImageGenerationCount || 0;
                if (lifetimeCount >= imageLimit) {
                    throw new Error('You have reached your image generation limit for this package.');
                }
                updates = { packageImageGenerationCount: lifetimeCount + 1 };
            } else { // Daily
                const lastReset = userData.lastImageGenerationReset ? (userData.lastImageGenerationReset as Timestamp).toDate() : new Date(0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dailyCount = lastReset < today ? 0 : userData.dailyImageGenerationCount || 0;

                if (dailyCount >= imageLimit) {
                    throw new Error('You have reached your daily image generation limit for today.');
                }
                updates = {
                    dailyImageGenerationCount: dailyCount + 1,
                    lastImageGenerationReset: Timestamp.now()
                };
            }

            const genResult = await generateImage({ prompt, imageModel: 'normal' });
            if (!genResult.imageDataUri) {
                throw new Error("AI failed to generate an image.");
            }

            const imageDataUri = genResult.imageDataUri;
            const storageRef = ref(storage, `generated-images/${userId}/${uuidv4()}.png`);
            
            const base64Data = imageDataUri.substring(imageDataUri.indexOf(',') + 1);
            const imageBuffer = Buffer.from(base64Data, 'base64');
            
            const snapshot = await uploadBytes(storageRef, imageBuffer, { contentType: 'image/png' });
            const downloadURL = await getDownloadURL(snapshot.ref);

            const newImageRef = doc(collection(db, 'generated_images'));
            newImageData = {
                userId,
                prompt,
                imageUrl: downloadURL,
                thumbnailUrl: downloadURL,
                createdAt: Timestamp.now(),
            };

            transaction.set(newImageRef, newImageData);
            transaction.update(userRef, updates);
            
            finalImageObject = {
                ...(newImageData as Omit<GeneratedImage, 'id'>),
                id: newImageRef.id,
                createdAt: (newImageData as any).createdAt.toDate().toISOString(),
            };
        });

        if (!finalImageObject) {
            throw new Error("Transaction failed to complete successfully.");
        }

        revalidatePath('/image-generation');

        return { success: true, message: "Image generated successfully.", image: finalImageObject };

    } catch (error) {
        console.error("Error generating and saving image:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message };
    }
}
