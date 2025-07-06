
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
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            return { success: false, message: 'User not found.' };
        }
        
        const userData = userDoc.data() as User;
        let userPackage: Package | null = null;
        if (userData.packageId) {
            userPackage = await getPackage(userData.packageId);
        }

        const imageLimit = userPackage?.imageGenerationLimit ?? 0;

        const lastReset = userData.lastImageGenerationReset ? (userData.lastImageGenerationReset as Timestamp).toDate() : new Date(0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let dailyCount = lastReset < today ? 0 : userData.dailyImageGenerationCount || 0;

        if (dailyCount >= imageLimit) {
            return { success: false, message: 'You have reached your daily image generation limit. Please upgrade your package for more.' };
        }
        
        const genResult = await generateImage({ prompt });
        if (!genResult.imageDataUri) {
            throw new Error("AI failed to generate an image.");
        }

        const imageDataUri = genResult.imageDataUri;
        const storageRef = ref(storage, `generated-images/${userId}/${uuidv4()}.png`);
        
        const base64Data = imageDataUri.substring(imageDataUri.indexOf(',') + 1);
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        const snapshot = await uploadBytes(storageRef, imageBuffer, {
            contentType: 'image/png'
        });
        const downloadURL = await getDownloadURL(snapshot.ref);

        const newImageRef = doc(collection(db, 'generated_images'));
        const newImageData: Omit<GeneratedImage, 'id'> = {
            userId,
            prompt,
            imageUrl: downloadURL,
            thumbnailUrl: downloadURL,
            createdAt: Timestamp.now(),
        };

        await runTransaction(db, async (transaction) => {
            transaction.set(newImageRef, newImageData);
            transaction.update(userRef, {
                dailyImageGenerationCount: dailyCount + 1,
                lastImageGenerationReset: Timestamp.now()
            });
        });

        const finalImageObject: GeneratedImage = {
            ...newImageData,
            id: newImageRef.id,
            createdAt: newImageData.createdAt.toDate().toISOString(),
        };

        revalidatePath('/image-generation');

        return { success: true, message: "Image generated successfully.", image: finalImageObject };

    } catch (error) {
        console.error("Error generating and saving image:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message };
    }
}
