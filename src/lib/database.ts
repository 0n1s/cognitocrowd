









import { db } from './firebase';
import { collection, getDocs, doc, getDoc, addDoc, query, where, DocumentData, writeBatch, setDoc, orderBy, limit, Timestamp, runTransaction, arrayUnion, updateDoc } from 'firebase/firestore';
import type { Task, AdminTask, Package, User, TaskResponse, AdminUser, AppSettings, WithdrawalRequest, LeaderboardEntry, ChatSession, Deposit, QualificationTest } from './types';
import { mockTasks, mockPackages } from './data';
import { v4 as uuidv4 } from 'uuid';

function fromDoc<T extends { id: string }>(doc: DocumentData): T {
    const data = doc.data();
    
    // Convert all top-level Firestore Timestamps to serializable ISO strings
    for (const key in data) {
        if (data[key] instanceof Timestamp) {
            data[key] = data[key].toDate().toISOString();
        }
    }

    // Special handling for nested timestamps in chat messages
    if (data.messages && Array.isArray(data.messages)) {
        data.messages = data.messages.map((message: any) => {
            if (message.createdAt instanceof Timestamp) {
                return { ...message, createdAt: message.createdAt.toDate().toISOString() };
            }
            return message;
        });
    }

    return { ...data, id: doc.id } as T;
}


export async function getTasks(userId?: string): Promise<Task[]> {
    if (!db) return Promise.resolve([]);

    let completedTaskIds: string[] = [];
    let userExpertise: string[] = [];

    if (userId) {
        const userDoc = await getUserData(userId);
        if (userDoc) {
            completedTaskIds = userDoc.completedTasks || [];
            userExpertise = userDoc.expertise || [];
        }
    }

    const tasksCol = collection(db, 'tasks');
    const queriesToRun = [];

    // Query for tasks matching user's expertise
    if (userExpertise.length > 0) {
        queriesToRun.push(query(tasksCol, where('status', '==', 'Active'), where('expertise', 'in', userExpertise)));
    }

    // Query for general tasks (no expertise assigned)
    queriesToRun.push(query(tasksCol, where('status', '==', 'Active'), where('expertise', '==', null)));

    const querySnapshots = await Promise.all(queriesToRun.map(q => getDocs(q)));

    const allTasksMap = new Map<string, Task>();

    querySnapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
            if (!allTasksMap.has(doc.id)) {
                allTasksMap.set(doc.id, fromDoc<Task>(doc));
            }
        });
    });
    
    let allTasks = Array.from(allTasksMap.values());

    // Seeding logic if no tasks exist at all
    if (allTasks.length === 0 && mockTasks.length > 0) {
        console.log('No contributions found. Seeding database with mock data...');
        const batch = writeBatch(db);
        mockTasks.forEach((task) => {
            const { id, ...taskData } = task; // Firestore will generate its own ID
            const docRef = doc(collection(db, 'tasks'));
            batch.set(docRef, {...taskData, status: 'Active'});
        });
        await batch.commit();
        console.log('Database seeded.');
        // Re-fetch general tasks after seeding
        const seededSnapshot = await getDocs(query(tasksCol, where('status', '==', 'Active'), where('expertise', '==', null)));
        allTasks = seededSnapshot.docs.map(d => fromDoc<Task>(d));
    }


    if (completedTaskIds.length > 0) {
        return allTasks.filter(task => !completedTaskIds.includes(task.id));
    }

    return allTasks;
}

export async function getTask(id: string): Promise<Task | null> {
    if (!db) return Promise.resolve(null);
    const docRef = doc(db, 'tasks', id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? fromDoc<Task>(docSnap) : null;
}

export async function getTaskResponses(taskId: string): Promise<TaskResponse[]> {
    if (!db) return [];
    const responsesCol = collection(db, 'task_responses');
    const q = query(responsesCol, where('taskId', '==', taskId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => fromDoc<TaskResponse>(d));
}


export async function getUserData(userId: string): Promise<User | null> {
    if (!db) return null;
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
        const user = fromDoc<any>(userDoc) as any;
        
        // Backwards compatibility for users with 'points'
        if (user.points !== undefined && user.earningsBalance === undefined) {
            user.earningsBalance = user.points;
            delete user.points;
        }

        user.earningsBalance = user.earningsBalance ?? 0;
        user.depositBalance = user.depositBalance ?? 0;
        
        return user as User;
    }
    return null;
}

export async function getCompletedTaskDetails(taskIds: string[]): Promise<Task[]> {
    if (!db || taskIds.length === 0) return [];
    
    try {
        const tasks: Task[] = [];
        // Firestore 'in' query is limited to 30 elements. We might need to batch this.
        const MAX_IN_CLAUSE_SIZE = 30;
        for (let i = 0; i < taskIds.length; i += MAX_IN_CLAUSE_SIZE) {
            const batchIds = taskIds.slice(i, i + MAX_IN_CLAUSE_SIZE);
            const tasksCol = collection(db, 'tasks');
            const q = query(tasksCol, where('__name__', 'in', batchIds));
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => {
                tasks.push(fromDoc<Task>(doc));
            });
        }
        return tasks;
    } catch (error) {
        console.error("Error fetching completed task details:", error);
        return [];
    }
}


export async function getAdminTasks(): Promise<AdminTask[]> {
    if (!db) return Promise.resolve([]);
    const tasksCol = collection(db, 'tasks');
    const snapshot = await getDocs(tasksCol);
    
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            title: data.title,
            type: data.type,
            points: data.points,
            status: data.status || 'Active',
            expertise: data.expertise
        } as AdminTask;
    });
}

export async function getPackages(): Promise<Package[]> {
    if (!db) return Promise.resolve([]);
    const packagesCol = collection(db, 'packages');
    const snapshot = await getDocs(packagesCol);

    if (snapshot.empty && mockPackages.length > 0) {
        console.log('No packages found. Seeding database with mock data...');
        const batch = writeBatch(db);
        mockPackages.forEach((pkg) => {
            const docRef = doc(collection(db, 'packages'));
            batch.set(docRef, pkg);
        });
        await batch.commit();
        console.log('Packages database seeded.');
        const seededSnapshot = await getDocs(packagesCol);
        return seededSnapshot.docs.map(d => fromDoc<Package>(d));
    }

    return snapshot.docs.map(doc => fromDoc<Package>(doc));
}

export async function getPackage(id: string): Promise<Package | null> {
    if (!db) return null;
    const docRef = doc(db, 'packages', id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? fromDoc<Package>(docSnap) : null;
}

export async function getAdminUsers(): Promise<AdminUser[]> {
    if (!db) return [];

    const usersCol = collection(db, 'users');
    const packagesCol = collection(db, 'packages');

    const [usersSnapshot, packagesSnapshot] = await Promise.all([
        getDocs(usersCol),
        getDocs(packagesCol)
    ]);
    
    const packagesMap = new Map<string, string>();
    packagesSnapshot.docs.forEach(doc => {
        packagesMap.set(doc.id, doc.data().name);
    });
    packagesMap.set("null", "Free Tier"); // Handle null packageId

    const users = usersSnapshot.docs.map(doc => {
        const user = fromDoc<any>(doc) as any;

        // Backwards compatibility for users with 'points'
        if (user.points !== undefined && user.earningsBalance === undefined) {
            user.earningsBalance = user.points;
            delete user.points;
        }

        user.earningsBalance = user.earningsBalance ?? 0;
        user.depositBalance = user.depositBalance ?? 0;

        const packageName = user.packageId ? packagesMap.get(user.packageId) || 'N/A' : 'Free Tier';
        return { ...user, packageName };
    });

    return users as AdminUser[];
}

export async function getDashboardStats() {
    if (!db) return { totalUsers: 0, totalTasksCompleted: 0, activeTasks: 0, pendingWithdrawals: 0 };

    const usersCol = collection(db, 'users');
    const tasksCol = collection(db, 'tasks');
    const responsesCol = collection(db, 'task_responses');
    const withdrawalsCol = collection(db, 'withdrawal_requests');

    try {
        const [usersSnapshot, tasksSnapshot, responsesSnapshot, withdrawalsSnapshot] = await Promise.all([
            getDocs(usersCol),
            getDocs(query(tasksCol, where('status', '==', 'Active'))),
            getDocs(responsesCol),
            getDocs(query(withdrawalsCol, where('status', '==', 'pending')))
        ]);

        return {
            totalUsers: usersSnapshot.size,
            activeTasks: tasksSnapshot.size,
            totalTasksCompleted: responsesSnapshot.size,
            pendingWithdrawals: withdrawalsSnapshot.size
        };
    } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        return { totalUsers: 0, totalTasksCompleted: 0, activeTasks: 0, pendingWithdrawals: 0 };
    }
}

export async function getAppSettings(): Promise<AppSettings> {
    const defaultSettings: AppSettings = {
        paymentMethods: [{ id: uuidv4(), name: 'PayPal' }],
        depositMethods: [{ id: uuidv4(), name: 'Plisio (Crypto)' }],
        withdrawalScheduleInfo: 'Withdrawals are processed on the 1st and 15th of each month.',
        withdrawalDays: [],
        defaultGenAiModel: 'googleai/gemini-2.0-flash',
    };

    if (!db) return defaultSettings;

    const settingsDocRef = doc(db, 'settings', 'main');
    const docSnap = await getDoc(settingsDocRef);

    if (docSnap.exists()) {
        const data = fromDoc<AppSettings>(docSnap);
        // Ensure properties exist for backward compatibility
        const mergedSettings = { ...defaultSettings, ...data };
        return mergedSettings;
    } else {
        await setDoc(settingsDocRef, defaultSettings);
        return defaultSettings;
    }
}

export async function getWithdrawalRequests(): Promise<WithdrawalRequest[]> {
    if (!db) return [];
    const requestsCol = collection(db, 'withdrawal_requests');
    const q = query(requestsCol, orderBy('requestedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => fromDoc<WithdrawalRequest>(d));
}

export async function getUserWithdrawalRequests(userId: string): Promise<WithdrawalRequest[]> {
    if (!db) return [];
    const requestsCol = collection(db, 'withdrawal_requests');
    const q = query(requestsCol, where('userId', '==', userId), orderBy('requestedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => fromDoc<WithdrawalRequest>(d));
}

export async function getLeaderboardData(): Promise<LeaderboardEntry[]> {
    if (!db) return [];
    
    const usersCol = collection(db, 'users');
    const q = query(usersCol, orderBy('earningsBalance', 'desc'), limit(10));
    
    try {
        const snapshot = await getDocs(q);
        const leaderboard: LeaderboardEntry[] = snapshot.docs.map((doc, index) => {
            const data = doc.data() as User;
            return {
                rank: index + 1,
                user: {
                    name: data.name,
                },
                points: data.earningsBalance || 0,
            };
        });
        return leaderboard;
    } catch (error) {
        console.error("Failed to fetch leaderboard data:", error);
        return [];
    }
}

export async function getMostRecentChat(userId: string): Promise<ChatSession | null> {
    if (!db) return null;
    try {
        const chatsCol = collection(db, 'chats');
        const q = query(
            chatsCol,
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return null;
        }

        // Sort in code to avoid needing a composite index which might not exist.
        const docs = snapshot.docs;
        docs.sort((a, b) => {
            const dateA = a.data().updatedAt as Timestamp;
            const dateB = b.data().updatedAt as Timestamp;
            return dateB.toMillis() - dateA.toMillis(); // Sort descending
        });
        
        const mostRecentDoc = docs[0];
        const chatData = fromDoc<ChatSession>(mostRecentDoc);
        return chatData;

    } catch (error) {
        console.error("Failed to fetch most recent chat:", error);
        return null;
    }
}

export async function getDepositHistory(userId: string): Promise<Deposit[]> {
    if (!db) return [];
    const depositsCol = collection(db, 'deposits');
    const q = query(depositsCol, where('userId', '==', userId), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => fromDoc<Deposit>(d));
}

export async function getAdminUserDetail(userId: string) {
    if (!db) return null;

    const userData = await getUserData(userId);
    if (!userData) return null;

    const [completedTasks, withdrawalRequests, userPackage, depositHistory] = await Promise.all([
        getCompletedTaskDetails(userData.completedTasks || []),
        getUserWithdrawalRequests(userId),
        userData.packageId ? getPackage(userData.packageId) : null,
        getDepositHistory(userId),
    ]);

    return {
        user: userData,
        completedTasks,
        withdrawalRequests,
        package: userPackage,
        depositHistory,
    };
}


export async function getQualificationTestsSummary(): Promise<Record<string, { questionCount: number; isEnabled: boolean; }>> {
    if (!db) return {};
    try {
        const testsCol = collection(db, 'qualification_tests');
        const snapshot = await getDocs(testsCol);
        const summaries: Record<string, { questionCount: number; isEnabled: boolean; }> = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data() as QualificationTest;
            summaries[doc.id] = { 
                questionCount: data.questions?.length || 0,
                isEnabled: data.isEnabled === true,
            };
        });
        return summaries;
    } catch (error) {
        console.error("Error fetching qualification test summaries:", error);
        return {};
    }
}

export async function getQualificationTest(expertise: string): Promise<QualificationTest | null> {
    if (!db) return null;
    try {
        const testDocRef = doc(db, 'qualification_tests', expertise);
        const docSnap = await getDoc(testDocRef);
        if (docSnap.exists()) {
            return fromDoc<QualificationTest>(docSnap);
        }
        return null;
    } catch (error) {
        console.error(`Error fetching test for ${expertise}:`, error);
        return null;
    }
}

export async function getEnabledExpertiseAreas(): Promise<string[]> {
    if (!db) return [];
    try {
        const testsCol = collection(db, 'qualification_tests');
        const q = query(testsCol, where('isEnabled', '==', true));
        const snapshot = await getDocs(q);
        
        const enabledAreas = snapshot.docs
            .filter(doc => {
                const testData = doc.data() as QualificationTest;
                return testData.questions && testData.questions.length > 0;
            })
            .map(doc => (doc.data() as QualificationTest).expertise);

        return enabledAreas;
    } catch (error) {
        console.error("Error fetching enabled expertise areas:", error);
        return [];
    }
}
