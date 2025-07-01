
import { db } from './firebase';
import { collection, getDocs, doc, getDoc, addDoc, query, where, DocumentData, writeBatch, setDoc, orderBy, limit } from 'firebase/firestore';
import type { Task, AdminTask, Package, User, TaskResponse, AdminUser, AppSettings, WithdrawalRequest, LeaderboardEntry } from './types';
import { mockTasks, mockPackages } from './data';
import { v4 as uuidv4 } from 'uuid';

function fromDoc<T extends { id: string }>(doc: DocumentData): T {
    const data = doc.data();
    return { ...data, id: doc.id } as T;
}

export async function getTasks(userId?: string): Promise<Task[]> {
    if (!db) return Promise.resolve([]);

    let completedTaskIds: string[] = [];
    if (userId) {
        const userDoc = await getUserData(userId);
        if (userDoc?.completedTasks) {
            completedTaskIds = userDoc.completedTasks;
        }
    }

    const tasksCol = collection(db, 'tasks');
    const q = query(tasksCol, where('status', '==', 'Active'));
    const snapshot = await getDocs(q);

    let allTasks: Task[] = [];
    if (snapshot.empty && mockTasks.length > 0) {
        console.log('No contributions found. Seeding database with mock data...');
        const batch = writeBatch(db);
        mockTasks.forEach((task) => {
            const { id, ...taskData } = task; // Firestore will generate its own ID
            const docRef = doc(collection(db, 'tasks'));
            batch.set(docRef, {...taskData, status: 'Active'});
        });
        await batch.commit();
        console.log('Database seeded.');
        const seededSnapshot = await getDocs(q);
        allTasks = seededSnapshot.docs.map(d => fromDoc<Task>(d));
    } else {
        allTasks = snapshot.docs.map(doc => fromDoc<Task>(doc));
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
        return fromDoc<User>(userDoc);
    }
    return null;
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
        const user = fromDoc<User>(doc);
        const packageName = user.packageId ? packagesMap.get(user.packageId) || 'N/A' : 'Free Tier';
        return { ...user, packageName };
    });

    return users;
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
        withdrawalScheduleInfo: 'Withdrawals are processed on the 1st and 15th of each month.',
        withdrawalDays: []
    };

    if (!db) return defaultSettings;

    const settingsDocRef = doc(db, 'settings', 'main');
    const docSnap = await getDoc(settingsDocRef);

    if (docSnap.exists()) {
        return { ...defaultSettings, ...docSnap.data() };
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
    const q = query(usersCol, orderBy('points', 'desc'), limit(10));
    
    try {
        const snapshot = await getDocs(q);
        const leaderboard: LeaderboardEntry[] = snapshot.docs.map((doc, index) => {
            const data = doc.data() as User;
            return {
                rank: index + 1,
                user: {
                    name: data.name,
                },
                points: data.points || 0,
            };
        });
        return leaderboard;
    } catch (error) {
        console.error("Failed to fetch leaderboard data:", error);
        return [];
    }
}
