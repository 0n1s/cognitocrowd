
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, writeBatch, updateDoc, deleteDoc, setDoc, query, where, getDocs, limit, getDoc, Timestamp, runTransaction, arrayUnion } from "firebase/firestore";
import type { Task, TaskType, Package, User, AppSettings, WithdrawalRequest, ChatMessage, ChatSession } from "@/lib/types";
import { bulkGenerateTasks, type BulkGenerateTasksInput } from "@/ai/flows/ai-bulk-task-generator";
import { rankTaskResponse } from "@/ai/flows/ai-rank-response";
import { v4 as uuidv4 } from "uuid";
import { getMostRecentChat, getAppSettings } from './database';


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
        return { success: true, message: 'Contribution created successfully.' };
    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Failed to create contribution: ${errorMessage}` };
    }
}

export async function bulkCreateAdminTasks(data: BulkGenerateTasksInput) {
    if (!db) {
        return { success: false, message: 'Database not configured. Please check your environment variables.' };
    }
    try {
        const generatedData = await bulkGenerateTasks(data);

        if (!generatedData || !generatedData.tasks || generatedData.tasks.length === 0) {
            return { success: false, message: 'AI failed to generate contributions.' };
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
        return { success: true, message: `${generatedData.tasks.length} contributions created successfully.` };
    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Failed to create contributions: ${errorMessage}` };
    }
}


export async function submitTaskResponse(taskId: string, points: number, formData: FormData, userId: string, taskType: TaskType) {
    if (!db) {
        return { success: false, message: 'Database not configured.' };
    }
    if (!userId) {
        return { success: false, message: 'User not authenticated.' };
    }

    let newResponseId: string | undefined;
    const earningsToAdd = points / 100; // 100 points = $1

    try {
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, 'users', userId);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists()) {
                throw new Error('User not found.');
            }

            const userData = userDoc.data() as User;
            const completedTasks = userData.completedTasks || [];

            // 1. Check if task was ever completed to prevent re-dos
            if (completedTasks.includes(taskId)) {
                throw new Error('You have already completed this contribution.');
            }
            
            // 2. Check daily limit
            const FREE_TIER_DAILY_LIMIT = 50;
            let packageLimit = FREE_TIER_DAILY_LIMIT;

            if (userData.packageId) {
                const packageDocRef = doc(db, 'packages', userData.packageId);
                const packageDoc = await transaction.get(packageDocRef);
                if (packageDoc.exists()) {
                    packageLimit = (packageDoc.data() as Package).taskLimit;
                }
            }

            let dailyCount = userData.dailyCompletedCount || 0;
            const lastResetString = userData.lastCompletionReset;
            const lastReset = lastResetString ? new Date(lastResetString) : new Date(0);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (lastReset < today) {
                dailyCount = 0; // Reset for the new day
            }
            
            if (dailyCount >= packageLimit) {
                throw new Error('You have reached your daily contribution limit. Please try again tomorrow.');
            }

            // 3. Prepare response data
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

            // 4. Update user stats and create response document in transaction
            const currentEarnings = userData.earningsBalance || 0;
            const newEarnings = currentEarnings + earningsToAdd;
            const newCompletedTasks = [...completedTasks, taskId];
            const newDailyCount = dailyCount + 1;

            transaction.update(userRef, {
                earningsBalance: newEarnings,
                completedTasks: newCompletedTasks,
                dailyCompletedCount: newDailyCount,
                lastCompletionReset: Timestamp.now()
            });

            const newResponseRef = doc(collection(db, "task_responses"));
            newResponseId = newResponseRef.id;

            transaction.set(newResponseRef, {
                userId,
                taskId,
                pointsEarned: points, // Keep storing points in the response doc
                submittedAt: Timestamp.now(),
                responseData,
            });
        });

        // 5. After transaction, trigger non-critical AI ranking
        if (newResponseId) {
             const newResponseDocRef = doc(db, 'task_responses', newResponseId);
             const newResponseSnapshot = await getDoc(newResponseDocRef);
             if (newResponseSnapshot.exists()) {
                const responseData = newResponseSnapshot.data().responseData;
                 try {
                     const rankOutput = await rankTaskResponse({
                         taskId,
                         response: { userId, responseData }
                     });
                     if (rankOutput) {
                         await updateDoc(newResponseDocRef, {
                             rank: rankOutput.rank,
                             rankExplanation: rankOutput.explanation
                         });
                     }
                 } catch (rankError) {
                     console.error("Failed to rank contribution response:", rankError);
                 }
             }
        }
        
        revalidatePath('/dashboard');
        revalidatePath(`/tasks/${taskId}`);
        revalidatePath('/rewards');
        revalidatePath('/wallet');
        return { success: true, earnings: earningsToAdd };

    } catch (error) {
        console.error("Error submitting task response:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message };
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
            photoURL: null,
            earningsBalance: 0,
            depositBalance: 0,
            packageId,
            completedTasks: [],
            role: 'user',
            createdAt: Timestamp.now(),
            dailyCompletedCount: 0,
            lastCompletionReset: Timestamp.now(),
        });
        
        return { success: true };

    } catch (error) {
        console.error("Error setting up new user:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Failed to set up new user: ${errorMessage}` };
    }
}

export async function updateAdminUser(userId: string, data: Partial<Pick<User, 'packageId' | 'role' | 'earningsBalance' | 'depositBalance'>>) {
    if (!db) {
        return { success: false, message: 'Database not configured.' };
    }
    try {
        const userDoc = doc(db, 'users', userId);
        await updateDoc(userDoc, data);
        revalidatePath("/admin/users");
        revalidatePath(`/admin/users/${userId}`);
        return { success: true, message: 'User updated successfully.' };
    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Failed to update user: ${errorMessage}` };
    }
}

export async function deleteAdminUser(userId: string) {
    if (!db) {
        return { success: false, message: 'Database not configured.' };
    }
    try {
        const userDoc = doc(db, 'users', userId);
        await deleteDoc(userDoc);
        revalidatePath("/admin/users");
        return { success: true, message: 'User deleted successfully. Note: This does not remove the user from Firebase Authentication.' };
    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Failed to delete user: ${errorMessage}` };
    }
}

export async function updateAppSettings(data: AppSettings) {
  if (!db) return { success: false, message: "Database not configured." };
  try {
    await setDoc(doc(db, "settings", "main"), data, { merge: true });
    revalidatePath("/admin/settings");
    revalidatePath("/redeem");
    return { success: true, message: "Settings updated successfully." };
  } catch (error) {
    console.error("Error updating settings:", error);
    return { success: false, message: "Failed to update settings." };
  }
}

export async function requestWithdrawal(
    userId: string,
    amount: number,
    paymentMethod: string,
    paymentDetails: string
) {
    if (!db) return { success: false, message: "Database not configured." };

    try {
        const settings = await getAppSettings();
        const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = weekdays[new Date().getDay()];

        if (settings.withdrawalDays && settings.withdrawalDays.length > 0 && !settings.withdrawalDays.includes(today)) {
            return { success: false, message: `Withdrawals are only processed on ${settings.withdrawalDays.join(', ')}.` };
        }

        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "users", userId);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists()) {
                throw new Error("User not found.");
            }

            const userData = userDoc.data() as User;
            const currentBalance = userData.earningsBalance || 0;

            if (currentBalance < amount) {
                throw new Error("Insufficient earnings balance.");
            }
            if (amount <= 0) {
                throw new Error("Withdrawal amount must be positive.");
            }

            const newBalance = currentBalance - amount;
            transaction.update(userRef, { earningsBalance: newBalance });

            const withdrawalRef = doc(collection(db, "withdrawal_requests"));
            transaction.set(withdrawalRef, {
                userId,
                userName: userData.name,
                userEmail: userData.email,
                amount,
                paymentMethod,
                paymentDetails,
                status: "pending",
                requestedAt: Timestamp.now(),
            });
        });

        revalidatePath("/redeem");
        revalidatePath("/wallet");
        revalidatePath("/admin/withdrawals");
        return { success: true, message: "Withdrawal request submitted." };
    } catch (error) {
        console.error("Error requesting withdrawal:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message };
    }
}

export async function updateWithdrawalRequestStatus(
  requestId: string,
  newStatus: WithdrawalRequest['status']
) {
  if (!db) return { success: false, message: "Database not configured." };

  try {
      await runTransaction(db, async (transaction) => {
          const requestRef = doc(db, "withdrawal_requests", requestId);
          const requestDoc = await transaction.get(requestRef);

          if (!requestDoc.exists()) {
              throw new Error("Withdrawal request not found.");
          }

          const requestData = requestDoc.data() as WithdrawalRequest;
          const oldStatus = requestData.status;

          if (oldStatus === newStatus) return; // No change needed

          // Refund points if a request is failed
          if (newStatus === 'failed' && oldStatus !== 'failed') {
              const userRef = doc(db, "users", requestData.userId);
              const userDoc = await transaction.get(userRef);
              if (userDoc.exists()) {
                  const newBalance = (userDoc.data().earningsBalance || 0) + requestData.amount;
                  transaction.update(userRef, { earningsBalance: newBalance });
              }
          }
          
          transaction.update(requestRef, { 
              status: newStatus,
              processedAt: Timestamp.now()
          });
      });

      revalidatePath("/admin/withdrawals");
      revalidatePath("/redeem"); // For user's withdrawal history
      revalidatePath("/wallet");
      return { success: true, message: `Request status updated to ${newStatus}.` };
  } catch (error) {
      console.error("Error updating withdrawal status:", error);
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      return { success: false, message };
  }
}

export async function logChatInteraction(
    userId: string,
    chatId: string | null,
    userQuery: string,
    aiResponse: string
): Promise<{ success: boolean; newChatId: string; message?: string }> {
    if (!db) return { success: false, newChatId: chatId || '', message: "Database not configured." };
    if (!userId) return { success: false, newChatId: chatId || '', message: "User not authenticated." };

    try {
        const userMessage: ChatMessage = {
            id: uuidv4(),
            text: userQuery,
            sender: 'user',
            createdAt: Timestamp.now(),
        };

        const aiMessage: ChatMessage = {
            id: uuidv4(),
            text: aiResponse,
            sender: 'ai',
            createdAt: Timestamp.now(),
        };
        
        let currentChatId = chatId;

        if (currentChatId) {
            // Update existing chat session
            const chatRef = doc(db, 'chats', currentChatId);
            await updateDoc(chatRef, {
                messages: arrayUnion(userMessage, aiMessage),
                updatedAt: Timestamp.now(),
            });
        } else {
            // Create new chat session
            const newChatRef = doc(collection(db, 'chats'));
            await setDoc(newChatRef, {
                userId,
                title: userQuery.substring(0, 50),
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                messages: [userMessage, aiMessage],
            });
            currentChatId = newChatRef.id;
        }

        revalidatePath('/chat'); // In case we add a chat history view later
        return { success: true, newChatId: currentChatId };

    } catch (error) {
        console.error("Error logging chat interaction:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, newChatId: chatId || '', message };
    }
}


export async function getInitialChatHistory(userId: string): Promise<ChatSession | null> {
    if (!db) return null;
    if (!userId) return null;
    
    try {
        const chatSession = await getMostRecentChat(userId);
        return chatSession;
    } catch (error) {
        console.error("Error fetching initial chat history:", error);
        return null;
    }
}

export async function initiateDeposit(
  userId: string,
  amount: number,
  method: string
) {
  if (!db) return { success: false, message: "Database not configured." };
  if (!userId) return { success: false, message: "User not authenticated." };

  try {
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, "users", userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists()) {
        throw new Error("User not found.");
      }
      
      const userData = userDoc.data() as User;
      const currentBalance = userData.depositBalance || 0;
      const newBalance = currentBalance + amount;

      // Update user's deposit balance
      transaction.update(userRef, { depositBalance: newBalance });

      // Create a record of the deposit
      const depositRef = doc(collection(db, "deposits"));
      transaction.set(depositRef, {
        userId,
        amount,
        method,
        status: "completed", // Assuming immediate completion for this simulated flow
        createdAt: Timestamp.now(),
      });
    });

    revalidatePath("/wallet");
    revalidatePath(`/admin/users/${userId}`);

    return { success: true, message: "Deposit successful." };
  } catch (error) {
    console.error("Error initiating deposit:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, message };
  }
}

export async function updateUserNameInDB(userId: string, name: string) {
    if (!db) {
        return { success: false, message: 'Database not configured.' };
    }
    
    try {
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, { name });

        revalidatePath('/settings');
        revalidatePath(`/admin/users/${userId}`); // Also revalidate admin view
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

export async function markOnboardingAsCompleted(userId: string) {
    if (!db) return { success: false, message: "Database not configured." };

    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, { onboardingCourseCompleted: true });
        revalidatePath('/dashboard');
        return { success: true, message: "Onboarding completed." };
    } catch (error) {
        console.error("Error marking onboarding as completed:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message };
    }
}
