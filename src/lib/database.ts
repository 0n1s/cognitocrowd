import { db } from './firebase';
import { collection, getDocs, doc, getDoc, addDoc, query, where, DocumentData, writeBatch } from 'firebase/firestore';
import type { Task, AdminTask, Package } from './types';
import { mockTasks, mockPackages } from './data';

function fromDoc<T extends { id: string }>(doc: DocumentData): T {
    const data = doc.data();
    return { ...data, id: doc.id } as T;
}

export async function getTasks(): Promise<Task[]> {
    if (!db) return Promise.resolve([]);
    const tasksCol = collection(db, 'tasks');
    const q = query(tasksCol, where('status', '==', 'Active'));
    const snapshot = await getDocs(q);

    if (snapshot.empty && mockTasks.length > 0) {
        console.log('No tasks found. Seeding database with mock data...');
        const batch = writeBatch(db);
        mockTasks.forEach((task) => {
            const { id, ...taskData } = task; // Firestore will generate its own ID
            const docRef = doc(collection(db, 'tasks'));
            batch.set(docRef, {...taskData, status: 'Active'});
        });
        await batch.commit();
        console.log('Database seeded.');
        const seededSnapshot = await getDocs(q);
        return seededSnapshot.docs.map(d => fromDoc<Task>(d));
    }

    return snapshot.docs.map(doc => fromDoc<Task>(doc));
}

export async function getTask(id: string): Promise<Task | null> {
    if (!db) return Promise.resolve(null);
    const docRef = doc(db, 'tasks', id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? fromDoc<Task>(docSnap) : null;
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
