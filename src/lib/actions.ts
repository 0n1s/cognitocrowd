"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, writeBatch, updateDoc } from "firebase/firestore";
import type { Task, TaskType, Package } from "@/lib/types";
import { bulkGenerateTasks, type BulkGenerateTasksInput } from "@/ai/flows/ai-bulk-task-generator";

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


export async function submitTaskResponse(taskId: string, points: number, formData: FormData) {
     try {
        // In a real app, we'd save the response to a 'responses' collection
        // and update the user's points.
        console.log("Submitted for task:", taskId);
        console.log("Points earned:", points);
        console.log("Form data:", Object.fromEntries(formData.entries()));

        // For now, just revalidate and return success
        revalidatePath('/dashboard');
        revalidatePath(`/tasks/${taskId}`);
        return { success: true };
    } catch (error) {
        console.error(error);
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
