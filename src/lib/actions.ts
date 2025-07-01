"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, writeBatch } from "firebase/firestore";
import type { Task, TaskType } from "@/lib/types";
import { bulkGenerateTasks, type BulkGenerateTasksInput } from "@/ai/flows/ai-bulk-task-generator";

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

export async function bulkCreateAdminTasks(data: BulkGenerateTasksInput) {
    try {
        const generatedData = await bulkGenerateTasks(data);

        if (!generatedData || !generatedData.tasks || generatedData.tasks.length === 0) {
            return { success: false, message: 'AI failed to generate tasks.' };
        }

        const batch = writeBatch(db);
        const tasksCol = collection(db, "tasks");

        generatedData.tasks.forEach(task => {
            const docRef = doc(tasksCol); // Create new doc with auto-ID
            const taskToAdd: Omit<Task, 'id'> = {
                title: task.prompt,
                description: task.description,
                points: 100, // Default points
                type: task.taskType,
                options: task.options || [],
                scale: task.scale,
                settings: task.settings,
                award_criteria: task.award_criteria,
                status: 'Active',
                difficulty: 'Medium', // Default difficulty
            };
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
