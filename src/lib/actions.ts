
"use server";

import { revalidatePath } from "next/cache";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, doc, writeBatch, updateDoc, deleteDoc, setDoc, query, where, getDocs, limit, getDoc, Timestamp, runTransaction, arrayUnion } from "firebase/firestore";
import { ref, getDownloadURL, uploadBytes } from "firebase/storage";
import type { Task, TaskType, Package, User, AppSettings, WithdrawalRequest, ChatMessage, ChatSession, Deposit, QualificationQuestion, QualificationTest, OnboardingStep, CountryPartner } from "@/lib/types";
import { bulkGenerateTasks } from "@/ai/flows/ai-bulk-task-generator";
import { generateQualificationTest, evaluateQualificationTest } from "@/ai/flows/ai-qualification-test";
import { generateLandingImage as generateLandingImageFlow } from "@/ai/flows/ai-generate-landing-image";
import { improveLandingPageText as improveLandingPageTextFlow } from "@/ai/flows/ai-improve-landing-page-text";
import { v4 as uuidv4 } from "uuid";
import { getMostRecentChat, getAppSettings, getUserData, getQualificationTest, getTasks, getPendingApprovals, getPackage } from './database';
import { headers } from "next/headers";


export type CreateTaskInput = {
    title: string;
    description: string;
    points: number;
    type: TaskType;
    options: string[];
    expertise?: string;
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
            expertise: data.expertise === 'general' ? undefined : data.expertise,
            createdAt: Timestamp.now(),
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

export type BulkCreateTasksInput = {
    count: number;
    expertise: string[];
    taskTypes: TaskType[];
};

export async function bulkCreateAdminTasks(data: BulkCreateTasksInput) {
    if (!db) {
        return { success: false, message: 'Database not configured. Please check your environment variables.' };
    }
    
    const generatedData = await bulkGenerateTasks({
        count: data.count,
        expertise: data.expertise,
        taskTypes: data.taskTypes,
    });

    if (!generatedData || !generatedData.tasks || generatedData.tasks.length === 0) {
        return { success: false, message: 'AI failed to generate contributions. Please try again.' };
    }

    const batch = writeBatch(db);
    const tasksCol = collection(db, "tasks");

    generatedData.tasks.forEach(task => {
        const docRef = doc(tasksCol); // Create new doc with auto-ID
        
        const taskToAdd: any = {
            title: task.prompt,
            description: task.description,
            points: task.points || 100,
            type: task.taskType,
            status: 'Active',
            difficulty: 'Medium',
            createdAt: Timestamp.now(),
        };

        if (task.expertise && task.expertise !== 'General') {
            taskToAdd.expertise = task.expertise;
        }

        if (task.options) taskToAdd.options = task.options;
        if (task.scale) taskToAdd.scale = task.scale;
        if (task.settings) taskToAdd.settings = task.settings;
        if (task.award_criteria) taskToAdd.award_criteria = task.award_criteria;

        batch.set(docRef, taskToAdd);
    });

    await batch.commit();

    revalidatePath("/admin/tasks");
    return { success: true, message: `${generatedData.tasks.length} contributions created successfully across selected expertises.` };
}

export async function deleteAdminTask(taskId: string) {
    if (!db) {
        return { success: false, message: 'Database not configured.' };
    }
    try {
        await deleteDoc(doc(db, "tasks", taskId));
        revalidatePath("/admin/tasks");
        return { success: true, message: 'Contribution deleted successfully.' };
    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Failed to delete contribution: ${errorMessage}` };
    }
}

export async function updateAdminTaskStatus(taskId: string, status: 'Active' | 'Paused') {
    if (!db) {
        return { success: false, message: 'Database not configured.' };
    }
    try {
        await updateDoc(doc(db, "tasks", taskId), { status });
        revalidatePath("/admin/tasks");
        return { success: true, message: 'Contribution status updated.' };
    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Failed to update status: ${errorMessage}` };
    }
}


export async function submitTaskResponse(taskId: string, points: number, formData: FormData, userId: string, taskType: TaskType) {
    if (!db) {
        return { success: false, message: 'Database not configured.' };
    }
    if (!userId) {
        return { success: false, message: 'User not authenticated.' };
    }

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

            transaction.set(newResponseRef, {
                userId,
                taskId,
                pointsEarned: points, // Keep storing points in the response doc
                submittedAt: Timestamp.now(),
                responseData,
            });
        });

        // Find the next available task for the user
        const availableTasks = await getTasks(userId);
        const nextTask = availableTasks.length > 0 ? availableTasks[0] : null;

        revalidatePath('/dashboard');
        revalidatePath(`/tasks/${taskId}`);
        revalidatePath('/rewards');
        revalidatePath('/wallet');
        
        return { success: true, earnings: earningsToAdd, nextTaskId: nextTask?.id || null };

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
        return { success: false, message: 'Database not configured.' };
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

export async function setupNewUser(userId: string, name: string, email: string, referralCode?: string) {
    if (!db) {
        console.error("Database not configured.");
        return { success: false, message: 'Database not configured.' };
    }
    try {
        const appSettings = await getAppSettings();
        const packagesCol = collection(db, 'packages');
        const q = query(packagesCol, where('price', '==', 'Free'), limit(1));
        const packageSnapshot = await getDocs(q);

        let packageId: string | null = null;
        if (!packageSnapshot.empty) {
            packageId = packageSnapshot.docs[0].id;
        }

        const userDocRef = doc(db, 'users', userId);
        const now = Timestamp.now();
        const twoWeeksInSeconds = 14 * 24 * 60 * 60;
        const expiryTimestamp = new Timestamp(now.seconds + twoWeeksInSeconds, now.nanoseconds);
        
        const newUserDoc: any = {
            name,
            email,
            photoURL: null,
            earningsBalance: 0,
            depositBalance: 0,
            packageId,
            completedTasks: [],
            role: 'user',
            createdAt: now,
            dailyCompletedCount: 0,
            lastCompletionReset: now,
            dailyImageGenerationCount: 0,
            lastImageGenerationReset: now,
            accountExpiresAt: expiryTimestamp,
            onboardingStatus: appSettings.onboardingCourseEnabled ? 'pending' : 'approved',
            referralCode: uuidv4().substring(0, 8).toUpperCase(),
        };

        if (referralCode) {
            const usersCol = collection(db, 'users');
            const referrerQuery = query(usersCol, where('referralCode', '==', referralCode.trim().toUpperCase()), limit(1));
            const referrerSnapshot = await getDocs(referrerQuery);
            if (!referrerSnapshot.empty) {
                const referrerId = referrerSnapshot.docs[0].id;
                newUserDoc.referredBy = referrerId;
            }
        }
        
        await setDoc(userDocRef, newUserDoc);
        
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
    const dataToSave = { ...data };
    // Ensure arrays are filtered for empty entries before saving
    dataToSave.paymentMethods = (data.paymentMethods || []).filter(m => m.name.trim() !== '');
    dataToSave.depositMethods = (data.depositMethods || []).filter(m => m.name.trim() !== '');
    dataToSave.onboardingCourseSteps = (data.onboardingCourseSteps || []).filter(s => s.title.trim() !== '' && s.content.trim() !== '');
    
    await setDoc(doc(db, "settings", "main"), dataToSave, { merge: true });

    revalidatePath("/admin/settings");
    revalidatePath("/admin/landing");
    revalidatePath("/redeem");
    revalidatePath("/");
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

export async function purchasePackage(userId: string, packageId: string) {
    if (!db) {
        return { success: false, message: 'Database not configured.' };
    }

    try {
        const packageRef = doc(db, 'packages', packageId);
        const userRef = doc(db, 'users', userId);

        const packageDocForMessage = await getDoc(packageRef);
        if (!packageDocForMessage.exists()) {
             throw new Error("Package not found.");
        }
        const pkgName = packageDocForMessage.data().name;

        await runTransaction(db, async (transaction) => {
            const [packageDoc, userDoc] = await Promise.all([
                transaction.get(packageRef),
                transaction.get(userRef)
            ]);

            if (!packageDoc.exists()) throw new Error("Package not found.");
            if (!userDoc.exists()) throw new Error("User not found.");

            const pkg = packageDoc.data() as Package;
            const user = userDoc.data() as User;

            let price = 0;
            if (pkg.price.toLowerCase() !== 'free' && pkg.price.startsWith('$')) {
                price = parseFloat(pkg.price.substring(1));
            }

            const userDepositBalance = user.depositBalance || 0;
            if (userDepositBalance < price) {
                throw new Error("Insufficient deposit balance. Please add funds to your wallet.");
            }

            const currentExpiryTimestamp = user.accountExpiresAt as Timestamp | undefined;
            const currentExpiry = currentExpiryTimestamp ? currentExpiryTimestamp.toDate() : new Date(0);
            const now = new Date();
            const baseDate = currentExpiry > now ? currentExpiry : now;

            const [valueStr, unit] = pkg.expiryPeriod.split(' ');
            const value = parseInt(valueStr, 10);
            const newExpiryDate = new Date(baseDate);

            if (unit.startsWith('week')) {
                newExpiryDate.setDate(newExpiryDate.getDate() + value * 7);
            } else if (unit.startsWith('month')) {
                newExpiryDate.setMonth(newExpiryDate.getMonth() + value);
            } else if (unit.startsWith('day')) {
                newExpiryDate.setDate(newExpiryDate.getDate() + value);
            } else if (unit.startsWith('year')) {
                newExpiryDate.setFullYear(newExpiryDate.getFullYear() + value);
            }

            const newDepositBalance = userDepositBalance - price;
            const updates = {
                packageId: packageId,
                accountExpiresAt: Timestamp.fromDate(newExpiryDate),
                depositBalance: newDepositBalance,
            };

            transaction.update(userRef, updates);
        });

        revalidatePath('/packages');
        revalidatePath('/wallet');
        revalidatePath('/dashboard');
        return { success: true, message: `Successfully subscribed to the ${pkgName} package!` };

    } catch (error) {
        console.error("Error purchasing package:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message };
    }
}

export async function updateUserOnboardingProfile(userId: string, data: { country: string; languages: string[] }) {
    if (!db) {
        return { success: false, message: 'Database not configured.' };
    }
    try {
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, {
            country: data.country,
            languages: data.languages,
        });

        revalidatePath(`/onboarding/profile`);
        return { success: true, message: 'Profile information saved.' };
    } catch (error) {
        console.error("Error updating onboarding profile:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message };
    }
}

export async function updateUserExpertise(userId: string, data: { expertise: string[] }) {
    if (!db) {
        return { success: false, message: 'Database not configured.' };
    }
    try {
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, {
            expertise: data.expertise,
        });

        revalidatePath(`/onboarding/expertise`);
        return { success: true, message: 'Expertise information saved.' };
    } catch (error) {
        console.error("Error updating user expertise:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message };
    }
}

export async function startUserQualificationTest(userId: string, expertise: string[]): Promise<{ success: boolean; questions?: QualificationQuestion[]; message?: string; }> {
    if (!db) {
        return { success: false, message: 'Database not configured.' };
    }
    if (!expertise || expertise.length === 0) {
        return { success: false, message: 'Expertise is required to start a test.' };
    }
    
    try {
        const user = await getUserData(userId);
        if (!user) {
            return { success: false, message: 'User not found.' };
        }
        if (user.qualificationTestSubmittedAt) {
            return { success: false, message: 'You have already completed the qualification test.' };
        }
        if (user.qualificationQuestions && user.qualificationQuestions.length > 0) {
            return { success: true, questions: user.qualificationQuestions };
        }

        const selectedExpertise = expertise[0]; // Use the first selected expertise
        const test = await getQualificationTest(selectedExpertise);
        
        if (!test) {
            return { success: false, message: `A qualification test for "${selectedExpertise}" has not been created by an administrator yet. Please try again later or contact support.` };
        }

        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, {
            qualificationQuestions: test.questions,
            qualificationTestGeneratedAt: Timestamp.now(),
        });

        return { success: true, questions: test.questions };
    } catch (error) {
        console.error("Error starting qualification test:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message };
    }
}

export async function submitQualificationTest(userId: string, questions: QualificationQuestion[], userAnswers: Record<number, string>, expertise: string[], browserFingerprint: string) {
    if (!db) {
        return { success: false, message: 'Database not configured.' };
    }

    try {
        const userDocRef = doc(db, 'users', userId);
        const user = await getUserData(userId);
        if (user?.qualificationTestSubmittedAt) {
            return { success: false, message: 'You have already submitted a qualification test.' };
        }

        const submissions = questions.map((q, index) => ({
            question: q.question,
            userAnswer: userAnswers[index],
            correctAnswer: q.answer,
        }));
        
        const evaluation = await evaluateQualificationTest({ submissions, expertise });
        const settings = await getAppSettings();

        let onboardingStatus: 'pending' | 'approved' | 'rejected' = 'pending';

        if (settings.autoApprovalEnabled && evaluation.score >= (settings.autoApprovalThreshold ?? 101)) {
            onboardingStatus = 'approved';
        } else if (settings.autoRejectionEnabled && evaluation.score < (settings.autoRejectionThreshold ?? 0)) {
            onboardingStatus = 'rejected';
        }
        
        const ip = headers().get('x-forwarded-for') ?? 'unknown';

        await updateDoc(userDocRef, {
            onboardingStatus: onboardingStatus,
            qualificationSubmission: submissions,
            qualificationTestSubmittedAt: Timestamp.now(),
            qualificationScore: evaluation.score,
            qualificationFeedback: evaluation.feedback,
            qualificationResults: {
                correctCount: evaluation.correctCount,
                totalCount: evaluation.totalCount,
            },
            ipAddress: ip,
            browserFingerprint: browserFingerprint,
        });

        revalidatePath(`/onboarding/test`);
        return { success: true, message: 'Your test has been submitted for review.' };
    } catch (error) {
        console.error("Error submitting qualification test:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message };
    }
}

export async function generateAndSaveQualificationTest(expertise: string) {
     if (!db) {
        return { success: false, message: 'Database not configured.' };
    }
    try {
        const newQuestionsData = await generateQualificationTest({ expertise: [expertise] });
        if (!newQuestionsData || !newQuestionsData.questions) {
            throw new Error("AI failed to generate questions.");
        }
        
        const testDocRef = doc(db, 'qualification_tests', expertise);
        const docSnap = await getDoc(testDocRef);

        let message = '';

        if (docSnap.exists()) {
            const existingData = docSnap.data() as QualificationTest;
            const updatedQuestions = [...existingData.questions, ...newQuestionsData.questions];
            await updateDoc(testDocRef, { questions: updatedQuestions });
            message = `Added ${newQuestionsData.questions.length} more questions to the ${expertise} test.`;
        } else {
            const testData: Omit<QualificationTest, 'id'> = {
                expertise,
                questions: newQuestionsData.questions,
                createdAt: Timestamp.now(),
                isEnabled: true,
            };
            await setDoc(testDocRef, testData);
            message = `Test for ${expertise} generated successfully.`;
        }

        revalidatePath('/admin/qualifications');
        return { success: true, message };
    } catch (error) {
        console.error("Error generating and saving qualification test:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message };
    }
}

export async function toggleQualificationTestStatus(expertise: string, isEnabled: boolean) {
    if (!db) {
        return { success: false, message: 'Database not configured.' };
    }
    try {
        const testDocRef = doc(db, 'qualification_tests', expertise);
        const docSnap = await getDoc(testDocRef);

        if (docSnap.exists()) {
            await updateDoc(testDocRef, { isEnabled });
        } else {
            // If the test doesn't exist, create a document for it so its state can be tracked.
            await setDoc(testDocRef, {
                expertise,
                isEnabled,
                questions: [],
                createdAt: Timestamp.now(),
            });
        }
        revalidatePath('/admin/qualifications');
        return { success: true, message: `"${expertise}" status updated.` };
    } catch (error) {
        console.error("Error toggling test status:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message };
    }
}

export async function updateUserApprovalStatus(userId: string, status: 'approved' | 'rejected') {
    if (!db) {
        return { success: false, message: 'Database not configured.' };
    }
    try {
        const userDoc = doc(db, 'users', userId);
        await updateDoc(userDoc, { onboardingStatus: status });
        revalidatePath("/admin/approvals");
        return { success: true, message: `User status updated to ${status}.` };
    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Failed to update user status: ${errorMessage}` };
    }
}

export async function bulkUpdateUserApprovalStatus(
  ids: string[] | 'all',
  status: 'approved' | 'rejected'
) {
  if (!db) {
    return { success: false, message: 'Database not configured.' };
  }
  try {
    let userIdsToUpdate: string[];

    if (ids === 'all') {
      const pendingUsers = await getPendingApprovals();
      userIdsToUpdate = pendingUsers.map(user => user.id);
    } else {
      userIdsToUpdate = ids;
    }

    if (userIdsToUpdate.length === 0) {
      return { success: true, message: 'No users to update.' };
    }

    const BATCH_SIZE = 500;
    for (let i = 0; i < userIdsToUpdate.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const batchIds = userIdsToUpdate.slice(i, i + BATCH_SIZE);
        batchIds.forEach(userId => {
            const userDoc = doc(db, 'users', userId);
            batch.update(userDoc, { onboardingStatus: status });
        });
        await batch.commit();
    }

    revalidatePath("/admin/approvals");
    const userCount = userIdsToUpdate.length;
    return { success: true, message: `${userCount} ${userCount === 1 ? 'user has' : 'users have'} been ${status}.` };
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, message: `Failed to update users: ${errorMessage}` };
  }
}

export async function deleteAllAdminTasks() {
    if (!db) {
        return { success: false, message: 'Database not configured.' };
    }
    try {
        const tasksCol = collection(db, "tasks");
        const snapshot = await getDocs(tasksCol);
        
        if (snapshot.empty) {
            return { success: true, message: 'There are no contributions to delete.' };
        }

        const BATCH_SIZE = 500;
        const totalDocs = snapshot.size;
        const batches = [];
        
        for (let i = 0; i < totalDocs; i += BATCH_SIZE) {
            const batch = writeBatch(db);
            const end = Math.min(i + BATCH_SIZE, totalDocs);
            const batchDocs = snapshot.docs.slice(i, end);
            batchDocs.forEach(doc => {
                batch.delete(doc.ref);
            });
            batches.push(batch.commit());
        }

        await Promise.all(batches);
        
        revalidatePath("/admin/tasks");
        return { success: true, message: `Successfully deleted ${totalDocs} contributions.` };
    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Failed to delete all contributions: ${errorMessage}` };
    }
}

export async function updateLandingPageImage(field: string, imageDataUri: string) {
    if (!db || !storage) return { success: false, message: "Firebase not configured." };

    try {
        const storageRef = ref(storage, `landing-page/${field}-${uuidv4()}.jpg`);
        
        const base64Data = imageDataUri.substring(imageDataUri.indexOf(',') + 1);
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        const snapshot = await uploadBytes(storageRef, imageBuffer, {
            contentType: 'image/jpeg'
        });
        const downloadURL = await getDownloadURL(snapshot.ref);

        const settings = await getAppSettings();
        const newLandingPageContent = {
            ...settings.landingPageContent,
            [field]: downloadURL,
        };

        const result = await updateAppSettings({ 
            ...settings, 
            landingPageContent: newLandingPageContent
        });

        if (result.success) {
             return { success: true, message: "Image updated successfully.", url: downloadURL };
        } else {
             throw new Error(result.message);
        }

    } catch (error) {
        console.error("Error uploading/updating landing page image:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message };
    }
}

export async function generateLandingImage(prompt: string) {
    try {
        const result = await generateLandingImageFlow({ prompt });
        return { success: true, imageDataUri: result.imageDataUri };
    } catch (error) {
        console.error("Error generating landing page image:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message };
    }
}

export async function improveLandingPageText(originalText: string, context: string) {
    try {
        const result = await improveLandingPageTextFlow({ originalText, context });
        if (!result || !result.improvedText) {
             throw new Error("AI did not return improved text.");
        }
        return { success: true, improvedText: result.improvedText };
    } catch (error) {
        console.error("Error improving text with AI:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message };
    }
}

export async function createCountryPartner(data: {
    userId: string;
    country: string;
    depositFeePercent: number;
    withdrawalFeePercent: number;
}) {
    if (!db) return { success: false, message: 'Database not configured.' };

    try {
        const userRef = doc(db, 'users', data.userId);
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
            return { success: false, message: 'Selected user does not exist.' };
        }

        const partnersCol = collection(db, 'countryPartners');
        const qCountry = query(partnersCol, where('country', '==', data.country));
        const existingPartnerSnap = await getDocs(qCountry);
        if (!existingPartnerSnap.empty) {
            return { success: false, message: `A partner for ${data.country} already exists.` };
        }
        
        const qUser = query(partnersCol, where('userId', '==', data.userId));
        const existingUserAsPartnerSnap = await getDocs(qUser);
        if (!existingUserAsPartnerSnap.empty) {
            return { success: false, message: `This user is already a partner for another country.` };
        }

        const userData = userDoc.data();

        await runTransaction(db, async (transaction) => {
            transaction.update(userRef, { role: 'country_partner' });
            
            const newPartnerRef = doc(partnersCol);
            transaction.set(newPartnerRef, {
                userId: data.userId,
                name: userData.name,
                email: userData.email,
                country: data.country,
                depositFeePercent: data.depositFeePercent,
                withdrawalFeePercent: data.withdrawalFeePercent,
                isActive: true,
                createdAt: Timestamp.now()
            });
        });

        revalidatePath("/admin/partners");
        return { success: true, message: 'Country partner created successfully.' };

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Failed to create partner: ${errorMessage}` };
    }
}

export async function updateCountryPartner(partnerId: string, data: Partial<Pick<CountryPartner, 'depositFeePercent' | 'withdrawalFeePercent' | 'isActive' | 'country'>>) {
    if (!db) return { success: false, message: 'Database not configured.' };

    try {
        const partnerRef = doc(db, 'countryPartners', partnerId);
        await updateDoc(partnerRef, data);
        
        revalidatePath("/admin/partners");
        return { success: true, message: 'Partner updated successfully.' };
    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Failed to update partner: ${errorMessage}` };
    }
}

export async function deleteCountryPartner(partnerId: string) {
    if (!db) return { success: false, message: 'Database not configured.' };
    
    try {
        const partnerRef = doc(db, 'countryPartners', partnerId);
        
        await runTransaction(db, async (transaction) => {
            const partnerDoc = await transaction.get(partnerRef);
            if (!partnerDoc.exists()) {
                throw new Error("Partner not found.");
            }
            
            const partnerData = partnerDoc.data() as CountryPartner;
            const userRef = doc(db, 'users', partnerData.userId);

            transaction.update(userRef, { role: 'user' });
            transaction.delete(partnerRef);
        });

        revalidatePath("/admin/partners");
        revalidatePath("/admin/users");
        return { success: true, message: 'Partner deleted successfully.' };
    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Failed to delete partner: ${errorMessage}` };
    }
}
