"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import type { Task, TaskType } from "@/lib/types";

export type CreateTaskInput = {
    title: string;
    description: string;
    points: number;
    type: TaskType;
    options: string[];
};

export async function createAdminTask(data: CreateTaskInput) {
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
