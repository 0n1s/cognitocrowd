"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

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
