
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, writeBatch, updateDoc, deleteDoc, setDoc, query, where, getDocs, limit, getDoc, Timestamp } from "firebase/firestore";
import type { Task, TaskType, Package, User } from "@/lib/types";
import { bulkGenerateTasks, type BulkGenerateTasksInput } from "@/ai/flows/ai-bulk-task-generator";
import { rankTaskResponse } from "@/ai/flows/ai-rank-response";

export type CreateTaskInput = {
    title: string;
    description: string;
    points: number;
    type: TaskType;
    options: string[];
};

export async function createAdminTask(data: CreateTaskInput) {
    if (!db) {
        return { success: false, message: 'Database not configured. Please check your environment variables.' };
    }
    try {
        const taskToAdd: Omit<Task, 'id'|'difficulty'> = {
            title: data.title,
            description: data.description,
            points: data.points,
            type: data.type,
            options: data.options,
            status: 'Active',
            difficulty: 'Medium', // Assign a default difficulty
        };

        await addDoc(collection(db, "tasks"), taskToAdd);

        revalidatePath("/admin/tasks");
        return { success: true, message: 'Task created successfully.' };
    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Failed to create task: ${errorMessage}` };
    }
}

export async function bulkCreateAdminTasks(data: BulkGenerateTasksInput) {
    if (!db) {
        return { success: false, message: 'Database not configured. Please check your environment variables.' };
    }
    try {
        const generatedData = await bulkGenerateTasks(data);

        if (!generatedData || !generatedData.tasks || generatedData.tasks.length === 0) {
            return { success: false, message: 'AI failed to generate tasks.' };
        }

        const batch = writeBatch(db);
        const tasksCol = collection(db, "tasks");

        generatedData.tasks.forEach(task => {
            const docRef = doc(tasksCol); // Create new doc with auto-ID
            
            const taskToAdd: any = {
                title: task.prompt,
                description: task.description,
                points: 100, // Default points
                type: task.taskType,
                status: 'Active',
                difficulty: 'Medium', // Default difficulty
            };

            if (task.options) taskToAdd.options = task.options;
            if (task.scale) taskToAdd.scale = task.scale;
            if (task.settings) taskToAdd.settings = task.settings;
            if (task.award_criteria) taskToAdd.award_criteria = task.award_criteria;

            batch.set(docRef, taskToAdd);
        });

        await batch.commit();

        revalidatePath("/admin/tasks");
        return { success: true, message: `${generatedData.tasks.length} tasks created successfully.` };
    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Failed to create tasks: ${errorMessage}` };
    }
}


export async function submitTaskResponse(taskId: string, points: number, formData: FormData, userId: string, taskType: TaskType) {
    if (!db) {
        return { success: false, message: 'Database not configured.' };
    }
    if (!userId) {
        return { success: false, message: 'User not authenticated.' };
    }

    const userDocRef = doc(db, 'users', userId);
    const taskResponseColRef = collection(db, 'task_responses');
    let newResponseRef; // Define here to be accessible in the whole function scope

    try {
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
            return { success: false, message: 'User not found.' };
        }

        const userData = userDoc.data() as User;
        const completedTasks = userData.completedTasks || [];

        if (completedTasks.includes(taskId)) {
            return { success: false, message: 'You have already completed this task.' };
        }

        if (userData.packageId) {
            const packageDocRef = doc(db, 'packages', userData.packageId);
            const packageDoc = await getDoc(packageDocRef);

            if (packageDoc.exists()) {
                const packageData = packageDoc.data() as Package;
                if (completedTasks.length >= packageData.taskLimit) {
                    return { success: false, message: 'You have reached your task limit for this period. Please upgrade your package to continue.' };
                }
            }
        } else {
             const FREE_TIER_LIMIT = 50; 
             if (completedTasks.length >= FREE_TIER_LIMIT) {
                 return { success: false, message: 'You have reached your task limit for this period.' };
             }
        }

        const batch = writeBatch(db);

        const responseData: Record<string, any> = {};

        if (taskType === 'ranking') {
            formData.forEach((value, key) => {
                if (key !== 'ranking') responseData[key] = value;
            });
            responseData.ranking = formData.getAll('ranking');
        } else if (taskType === 'label_multiple') {
            const labels: string[] = [];
            formData.forEach((value, key) => {
                if (key.startsWith('label-')) {
                    if (value === 'on') labels.push(key.replace('label-', ''));
                } else {
                    responseData[key] = value;
                }
            });
            responseData.labels = labels;
        } else {
            formData.forEach((value, key) => {
                responseData[key] = value;
            });
        }
        
        newResponseRef = doc(taskResponseColRef);
        batch.set(newResponseRef, {
            userId,
            taskId,
            pointsEarned: points,
            submittedAt: Timestamp.now(),
            responseData,
        });

        const newPoints = (userData.points || 0) + points;
        const newCompletedTasks = [...completedTasks, taskId];
        batch.update(userDocRef, {
            points: newPoints,
            completedTasks: newCompletedTasks
        });
        
        await batch.commit();

        // After committing, trigger the AI ranking flow.
        try {
            const rankOutput = await rankTaskResponse({
                taskId,
                response: { userId, responseData }
            });

            if (rankOutput) {
                await updateDoc(newResponseRef, {
                    rank: rankOutput.rank,
                    rankExplanation: rankOutput.explanation
                });
            }
        } catch (error) {
            console.error("Failed to rank task response:", error);
            // Don't block user return if ranking fails. It can be a background process.
        }

        revalidatePath('/dashboard');
        revalidatePath(`/tasks/${taskId}`);
        revalidatePath('/rewards');
        return { success: true, points };
    } catch (error) {
        console.error("Error submitting task response:", error);
        return { success: false, message: 'Failed to submit response.' };
    }
}

export type CreatePackageInput = Omit<Package, 'id'>;

export async function createAdminPackage(data: CreatePackageInput) {
    if (!db) {
        return { success: false, message: 'Database not configured. Please check your environment variables.' };
    }
    try {
        await addDoc(collection(db, "packages"), data);

        revalidatePath("/admin/packages");
        revalidatePath("/packages");
        return { success: true, message: 'Package created successfully.' };
    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Failed to create package: ${errorMessage}` };
    }
}

export type UpdatePackageInput = Omit<Package, 'id'>;

export async function updateAdminPackage(id: string, data: UpdatePackageInput) {
    if (!db) {
        return { success: false, message: 'Database not configured. Please check your environment variables.' };
    }
    try {
        const packageDoc = doc(db, 'packages', id);
        await updateDoc(packageDoc, data);

        revalidatePath("/admin/packages");
        revalidatePath("/packages");
        return { success: true, message: 'Package updated successfully.' };
    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Failed to update package: ${errorMessage}` };
    }
}

export async function deleteAdminPackage(id: string) {
    if (!db) {
        return { success: false, message: 'Database not configured. Please check your environment variables.' };
    }
    try {
        const packageDoc = doc(db, 'packages', id);
        await deleteDoc(packageDoc);

        revalidatePath("/admin/packages");
        revalidatePath("/packages");
        return { success: true, message: 'Package deleted successfully.' };
    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Failed to delete package: ${errorMessage}` };
    }
}

export async function setupNewUser(userId: string, name: string, email: string) {
    if (!db) {
        console.error("Database not configured.");
        return { success: false, message: 'Database not configured.' };
    }
    try {
        const packagesCol = collection(db, 'packages');
        const q = query(packagesCol, where('price', '==', 'Free'), limit(1));
        const packageSnapshot = await getDocs(q);

        let packageId: string | null = null;
        if (!packageSnapshot.empty) {
            packageId = packageSnapshot.docs[0].id;
        }

        const userDocRef = doc(db, 'users', userId);
        await setDoc(userDocRef, {
            name,
            email,
            points: 0,
            packageId,
            completedTasks: [],
            createdAt: new Date(),
        });
        
        return { success: true };

    } catch (error) {
        console.error("Error setting up new user:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Failed to set up new user: ${errorMessage}` };
    }
}
