"use server";

import { revalidatePath } from "next/cache";
import { db, storage } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { auth } from "@/lib/firebase";
import { updateProfile } from "firebase/auth";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
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


export async function generateAndSetAiProfilePicture(userId: string, prompt: string) {
    if (!db || !storage || !auth?.currentUser) {
        return { success: false, message: 'Firebase not configured or user not authenticated.' };
    }

    try {
        const userData = await getUserData(userId);
        if (!userData) {
            return { success: false, message: 'User not found.' };
        }
        
        let userPackage = null;
        if (userData.packageId) {
            userPackage = await getPackage(userData.packageId);
        }

        if (!userPackage?.allowAiProfilePicture) {
            return { success: false, message: 'Your current plan does not allow AI profile picture generation.' };
        }

        const genResult = await generateProfileImage({ prompt });
        if (!genResult.imageDataUri) {
            throw new Error("AI failed to generate an image.");
        }

        const storageRef = ref(storage, `profile-pictures/${userId}-${uuidv4()}.png`);
        const base64Data = genResult.imageDataUri.split(',')[1];
        
        const snapshot = await uploadString(storageRef, base64Data, 'base64', {
            contentType: 'image/png'
        });
        const downloadURL = await getDownloadURL(snapshot.ref);

        await updateProfile(auth.currentUser, { photoURL: downloadURL });
        const dbResult = await updateUserPhotoURL(userId, downloadURL);

        if (!dbResult.success) {
            throw new Error(dbResult.message);
        }

        revalidatePath('/settings');
        return { success: true, message: 'AI avatar set successfully!', url: downloadURL };

    } catch (error) {
        console.error("Error generating and setting AI profile picture:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message };
    }
}
