
"use server";

import { revalidatePath } from "next/cache";
import { db, storage } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { ref, getDownloadURL, uploadBytes } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { generateProfileImage } from "@/ai/flows/ai-generate-profile-image";
import { getUserData, getPackage } from "./database";

export async function updateUserNameInDB(userId: string, name: string) {
    if (!db) {
        return { success: false, message: 'Database not configured.' };
    }
    
    try {
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, { name });

        revalidatePath(`/settings`); 
        return { success: true, message: 'Your profile has been updated.' };
    } catch (error) {
        console.error("Error updating user name in DB:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message };
    }
}

export async function updateUserPhotoURL(userId: string, photoURL: string) {
    if (!db) {
        return { success: false, message: 'Database not configured.' };
    }
    
    try {
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, { photoURL });

        revalidatePath(`/settings`); 
        revalidatePath(`/admin/users/${userId}`);
        return { success: true, message: 'Your profile picture has been updated.' };
    } catch (error) {
        console.error("Error updating user photo URL in DB:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message };
    }
}


export async function generateAiProfilePicture(userId: string, prompt: string): Promise<{ success: boolean; message: string; imageDataUri?: string; }> {
    try {
        const genResult = await generateProfileImage({ prompt });
        if (!genResult.imageDataUri) {
            throw new Error("AI failed to generate an image.");
        }
        return { success: true, message: 'Image generated successfully.', imageDataUri: genResult.imageDataUri };
    } catch (error) {
        console.error("Error generating AI profile picture:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message };
    }
}


export async function setProfilePictureFromDataUri(userId: string, imageDataUri: string): Promise<{ success: boolean; message: string; url?: string; }> {
    if (!db || !storage) {
        return { success: false, message: 'Firebase not configured.' };
    }

    try {
        const storageRef = ref(storage, `profile-pictures/${userId}-${uuidv4()}.png`);
        
        const base64Data = imageDataUri.substring(imageDataUri.indexOf(',') + 1);
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        const snapshot = await uploadBytes(storageRef, imageBuffer, {
            contentType: 'image/png'
        });
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        const dbResult = await updateUserPhotoURL(userId, downloadURL);
        if (!dbResult.success) {
            throw new Error(dbResult.message);
        }

        revalidatePath('/settings');
        return { success: true, message: 'Profile picture updated successfully!', url: downloadURL };
    } catch (error) {
        console.error("Error setting profile picture from data URI:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message };
    }
}
