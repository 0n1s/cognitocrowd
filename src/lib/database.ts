
import { db } from './firebase';
import { collection, getDocs, doc, getDoc, addDoc, query, where, DocumentData, writeBatch, setDoc, orderBy, limit, Timestamp, arrayUnion, updateDoc } from 'firebase/firestore';
import type { Task, Package, User, TaskResponse, AdminUser, AppSettings, WithdrawalRequest, LeaderboardEntry, ChatSession, Deposit, Expense, QualificationTest, LandingPageContent, CountryPartner, GeneratedImage, GeneratedVideo, GeneratedMusic, DepositMethod, WithdrawalMethod, PackagePurchase } from './types';
import { mockTasks, mockPackages } from './data';
import { v4 as uuidv4 } from 'uuid';
import { getPackageMoney, normalizeCurrencyCode } from './currency';

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

function normalizeDepositMethod(method: DepositMethod | (Partial<DepositMethod> & { id: string; name: string })): DepositMethod {
    const provider = method.provider || (method.name.toLowerCase().includes('plisio') ? 'plisio' : 'custom');
    const allowedInputTypes = new Set(['text', 'email', 'number', 'textarea', 'password', 'url', 'tel', 'image']);
    return {
        id: method.id,
        name: method.name,
        provider,
        enabled: method.enabled !== false,
        processingMode: method.processingMode || (provider === 'plisio' ? 'automatic' : 'admin_verified'),
        minimumAmount: Number.isFinite(Number(method.minimumAmount)) ? Number(method.minimumAmount) : undefined,
        maximumAmount: Number.isFinite(Number(method.maximumAmount)) ? Number(method.maximumAmount) : undefined,
        description: method.description || '',
        credentials: method.credentials || {},
        customFields: Array.isArray(method.customFields)
            ? method.customFields.map((field) => ({
                ...field,
                inputType: allowedInputTypes.has(field.inputType || 'text') ? (field.inputType || 'text') : 'text',
            }))
            : [],
    };
}

function normalizeWithdrawalMethod(method: WithdrawalMethod | (Partial<WithdrawalMethod> & { id: string; name: string })): WithdrawalMethod {
    const allowedInputTypes = new Set(['text', 'email', 'number', 'textarea', 'password', 'url', 'tel', 'image']);
    return {
        id: method.id,
        name: method.name,
        provider: 'custom',
        enabled: method.enabled !== false,
        processingMode: 'admin_verified',
        minimumAmount: Number.isFinite(Number(method.minimumAmount)) ? Number(method.minimumAmount) : undefined,
        maximumAmount: Number.isFinite(Number(method.maximumAmount)) ? Number(method.maximumAmount) : undefined,
        description: method.description || '',
        customFields: Array.isArray(method.customFields)
            ? method.customFields.map((field) => ({
                ...field,
                inputType: allowedInputTypes.has(field.inputType || 'text') ? (field.inputType || 'text') : 'text',
            }))
            : [],
    };
}

function normalizePackagePricing(pkg: Package): Package {
    const money = getPackageMoney(pkg);
    return {
        ...pkg,
        priceAmount: Number.isFinite(money.amount) ? Number(money.amount) : 0,
        priceCurrency: normalizeCurrencyCode(money.currency),
        priceBillingPeriod: money.period || undefined,
        price: pkg.price || (money.isFree ? 'Free' : `${money.currency} ${money.amount}`),
    };
}


export async function getTasks(userId?: string): Promise<Task[]> {
    if (!db) return Promise.resolve([]);

    let completedTaskIds: string[] = [];
    let userExpertise: string[] = [];

    if (userId) {
        const [userDoc, responseSnapshot] = await Promise.all([
            getUserData(userId),
            getDocs(query(collection(db, 'task_responses'), where('userId', '==', userId))),
        ]);
        if (userDoc) {
            completedTaskIds = userDoc.completedTasks || [];
            userExpertise = userDoc.expertise || [];
        }
        responseSnapshot.docs.forEach((responseDoc) => {
            const taskId = String(responseDoc.data().taskId || '');
            if (taskId && !completedTaskIds.includes(taskId)) completedTaskIds.push(taskId);
        });
    }

    const expertiseToQuery = ["General", ...userExpertise];
    
    const tasksCol = collection(db, 'tasks');
    const q = query(tasksCol, where('status', '==', 'Active'), where('expertise', 'in', expertiseToQuery));

    const snapshot = await getDocs(q);
    
    let allTasks = snapshot.docs.map(doc => fromDoc<Task>(doc));

    // Seeding logic if no tasks exist at all
    if (allTasks.length === 0 && mockTasks.length > 0) {
        console.log('No contributions found. Seeding database with mock data...');
        const batch = writeBatch(db);
        mockTasks.forEach((task) => {
            const { id, ...taskData } = task; // Firestore will generate its own ID
            const taskWithExpertise = {
                ...taskData,
                expertise: taskData.expertise || 'General',
                status: 'Active',
                createdAt: Timestamp.now()
            };
            const docRef = doc(collection(db, 'tasks'));
            batch.set(docRef, taskWithExpertise);
        });
        await batch.commit();
        console.log('Database seeded.');
        const seededSnapshot = await getDocs(q);
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

export async function getUserTaskResponses(userId: string): Promise<TaskResponse[]> {
    if (!db || !userId) return [];
    const responsesCol = collection(db, 'task_responses');
    const q = query(responsesCol, where('userId', '==', userId));
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


export async function getAdminTasks(): Promise<Task[]> {
    if (!db) return Promise.resolve([]);
    try {
        const tasksCol = collection(db, 'tasks');
        const q = query(tasksCol, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => fromDoc<Task>(doc));
    } catch (error) {
        // This can happen if the `createdAt` index doesn't exist yet.
        // Fallback to fetching without ordering.
        if (error instanceof Error && error.message.includes('firestore/failed-precondition')) {
            console.warn('Firestore index for ordering contributions not found. Fetching without ordering. Please create the index in your Firebase console.');
            const tasksCol = collection(db, 'tasks');
            const snapshot = await getDocs(tasksCol);
            return snapshot.docs.map(doc => fromDoc<Task>(doc));
        }
        console.error("Error fetching admin tasks:", error);
        return [];
    }
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
        return seededSnapshot.docs.map(d => normalizePackagePricing(fromDoc<Package>(d)));
    }

    return snapshot.docs.map(doc => normalizePackagePricing(fromDoc<Package>(doc)));
}

export async function getPackage(id: string): Promise<Package | null> {
    if (!db) return null;
    const docRef = doc(db, 'packages', id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? normalizePackagePricing(fromDoc<Package>(docSnap)) : null;
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

    const users = usersSnapshot.docs.map(doc => {
        const user = fromDoc<any>(doc) as any;

        // Backwards compatibility for users with 'points'
        if (user.points !== undefined && user.earningsBalance === undefined) {
            user.earningsBalance = user.points;
            delete user.points;
        }

        user.earningsBalance = user.earningsBalance ?? 0;
        user.depositBalance = user.depositBalance ?? 0;

        const packageName = user.packageId ? packagesMap.get(user.packageId) || '(No Package)' : '(No Package)';
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

type FinanceGranularity = 'day' | 'week' | 'month';

type FinancialFlowPoint = {
    key: string;
    label: string;
    deposits: number;
    withdrawals: number;
    expenses: number;
    net: number;
};

type FinancialFlowAnalytics = {
    totalDeposits: number;
    totalWithdrawals: number;
    totalExpenses: number;
    netFlow: number;
    series: FinancialFlowPoint[];
    startDateIso: string;
    endDateIso: string;
    granularity: FinanceGranularity;
};

function toDateValue(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Timestamp) return value.toDate();
    if (typeof value?.toDate === 'function') {
        const converted = value.toDate();
        return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
    }
    if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
}

function getStartOfUtcDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getStartOfUtcWeek(date: Date): Date {
    const day = date.getUTCDay();
    const mondayOffset = (day + 6) % 7;
    const startOfDay = getStartOfUtcDay(date);
    startOfDay.setUTCDate(startOfDay.getUTCDate() - mondayOffset);
    return startOfDay;
}

function getStartOfUtcMonth(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function getBucketStart(date: Date, granularity: FinanceGranularity): Date {
    if (granularity === 'week') return getStartOfUtcWeek(date);
    if (granularity === 'month') return getStartOfUtcMonth(date);
    return getStartOfUtcDay(date);
}

function addBucketStep(date: Date, granularity: FinanceGranularity): Date {
    const next = new Date(date);
    if (granularity === 'week') {
        next.setUTCDate(next.getUTCDate() + 7);
        return next;
    }
    if (granularity === 'month') {
        next.setUTCMonth(next.getUTCMonth() + 1);
        return next;
    }
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
}

function formatBucketLabel(date: Date, granularity: FinanceGranularity): string {
    if (granularity === 'month') {
        return new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date);
    }
    if (granularity === 'week') {
        return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
    }
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
}

function getGranularityForRange(days: number): FinanceGranularity {
    if (days <= 31) return 'day';
    if (days <= 120) return 'week';
    return 'month';
}

export async function getFinancialFlowAnalytics(rangeDays: number): Promise<FinancialFlowAnalytics> {
    const now = new Date();
    const endDate = getStartOfUtcDay(now);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - Math.max(1, rangeDays));
    const granularity = getGranularityForRange(rangeDays);

    const empty: FinancialFlowAnalytics = {
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalExpenses: 0,
        netFlow: 0,
        series: [],
        startDateIso: startDate.toISOString(),
        endDateIso: endDate.toISOString(),
        granularity,
    };

    if (!db) return empty;

    const points = new Map<string, FinancialFlowPoint>();
    for (let cursor = getBucketStart(startDate, granularity); cursor < endDate; cursor = addBucketStep(cursor, granularity)) {
        const key = cursor.toISOString();
        points.set(key, {
            key,
            label: formatBucketLabel(cursor, granularity),
            deposits: 0,
            withdrawals: 0,
            expenses: 0,
            net: 0,
        });
    }

    const startTimestamp = Timestamp.fromDate(startDate);
    let depositDocs: DocumentData[] = [];
    let withdrawalDocs: DocumentData[] = [];
    let expenseDocs: DocumentData[] = [];

    try {
        const [depositsSnapshot, withdrawalsSnapshot, expensesSnapshot] = await Promise.all([
            getDocs(query(collection(db, 'deposits'), where('createdAt', '>=', startTimestamp))),
            getDocs(query(collection(db, 'withdrawal_requests'), where('requestedAt', '>=', startTimestamp))),
            getDocs(query(collection(db, 'expenses'), where('createdAt', '>=', startTimestamp))),
        ]);
        depositDocs = depositsSnapshot.docs;
        withdrawalDocs = withdrawalsSnapshot.docs;
        expenseDocs = expensesSnapshot.docs;
    } catch (error) {
        console.warn('Falling back to full finance fetch for analytics:', error);
        const [depositsSnapshot, withdrawalsSnapshot, expensesSnapshot] = await Promise.all([
            getDocs(collection(db, 'deposits')),
            getDocs(collection(db, 'withdrawal_requests')),
            getDocs(collection(db, 'expenses')),
        ]);
        depositDocs = depositsSnapshot.docs;
        withdrawalDocs = withdrawalsSnapshot.docs;
        expenseDocs = expensesSnapshot.docs;
    }

    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let totalExpenses = 0;

    for (const depositDoc of depositDocs) {
        const deposit = depositDoc.data() as Deposit;
        if (deposit.status !== 'completed') continue;

        const eventDate = toDateValue(deposit.createdAt || deposit.processedAt);
        if (!eventDate || eventDate < startDate || eventDate >= endDate) continue;

        const bucketStart = getBucketStart(eventDate, granularity).toISOString();
        const point = points.get(bucketStart);
        if (!point) continue;

        const amount = Number(deposit.amountUsd ?? deposit.amount ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) continue;

        point.deposits += amount;
        totalDeposits += amount;
    }

    for (const withdrawalDoc of withdrawalDocs) {
        const withdrawal = withdrawalDoc.data() as WithdrawalRequest;
        if (withdrawal.status !== 'completed') continue;

        const eventDate = toDateValue(withdrawal.requestedAt || withdrawal.processedAt);
        if (!eventDate || eventDate < startDate || eventDate >= endDate) continue;

        const bucketStart = getBucketStart(eventDate, granularity).toISOString();
        const point = points.get(bucketStart);
        if (!point) continue;

        const amount = Number(withdrawal.amountUsd ?? withdrawal.amount ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) continue;

        point.withdrawals += amount;
        totalWithdrawals += amount;
    }

    for (const expenseDoc of expenseDocs) {
        const expense = expenseDoc.data() as Expense;

        const eventDate = toDateValue(expense.createdAt);
        if (!eventDate || eventDate < startDate || eventDate >= endDate) continue;

        const bucketStart = getBucketStart(eventDate, granularity).toISOString();
        const point = points.get(bucketStart);
        if (!point) continue;

        const amount = Number(expense.amountUsd ?? expense.amount ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) continue;

        point.expenses += amount;
        totalExpenses += amount;
    }

    const series = Array.from(points.values()).map((point) => ({
        ...point,
        deposits: Number(point.deposits.toFixed(2)),
        withdrawals: Number(point.withdrawals.toFixed(2)),
        expenses: Number(point.expenses.toFixed(2)),
        net: Number((point.deposits - point.withdrawals - point.expenses).toFixed(2)),
    }));

    return {
        totalDeposits: Number(totalDeposits.toFixed(2)),
        totalWithdrawals: Number(totalWithdrawals.toFixed(2)),
        totalExpenses: Number(totalExpenses.toFixed(2)),
        netFlow: Number((totalDeposits - totalWithdrawals - totalExpenses).toFixed(2)),
        series,
        startDateIso: startDate.toISOString(),
        endDateIso: endDate.toISOString(),
        granularity,
    };
}

export async function getAppSettings(): Promise<AppSettings> {
    const defaultSettings: AppSettings = {
        paymentMethods: [{ id: uuidv4(), name: 'Manual Withdrawal' }],
        depositMethods: [{ id: uuidv4(), name: 'Plisio', provider: 'plisio', enabled: true, processingMode: 'automatic', description: 'Crypto deposits via Plisio', credentials: {}, customFields: [] }],
        withdrawalMethods: [{ id: uuidv4(), name: 'Manual Withdrawal', provider: 'custom', enabled: true, processingMode: 'admin_verified', description: 'Withdrawal requests are reviewed by admin.', customFields: [] }],
        plisioApiKey: '',
        plisioPublicBaseUrl: '',
        withdrawalScheduleInfo: 'Withdrawals are processed on the 1st and 15th of each month.',
        processingTimeZone: 'UTC',
        withdrawalDays: [],
        withdrawalMinimumAmount: 0,
        withdrawalMaximumAmount: 0,
        defaultCurrency: 'USD',
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'KES', 'NGN', 'GHS', 'ZAR', 'UGX', 'TZS'],
        defaultTextGenAiModel: '',
        defaultImageGenAiModel: '',
        defaultVideoGenAiModel: '',
        defaultAudioGenAiModel: '',
        defaultUncensoredAiModel: '',
        defaultVisionAiModel: '',
        defaultHackingAiModel: '',
        defaultCodingAiModel: '',
        defaultGenAiModel: '',
        aiProviders: [],
        openAiCompatibleProviderName: '',
        openAiCompatibleBaseUrl: '',
        openAiCompatibleApiKey: '',
        openAiCompatibleDiscoveredModels: [],
        aiRankedPayoutMode: 'on',
        earnPerScoreEnabled: true,
        landingPageContent: {
            processImage1: "https://placehold.co/800x600.png",
            processImage2: "https://placehold.co/800x600.png",
            processImage3: "https://placehold.co/800x600.png",
            hiringBackgroundImage: "https://placehold.co/1920x1080.png",
            heroTitle: "Build Superhuman AI",
            heroSubtitle: "Join an elite network of human experts training the next generation of artificial intelligence. Your knowledge fuels the future.",
            heroCtaButton: "Sign Up Now",
            platformTitle: "What You'll Do",
            platformSubtitle: "We connect human intelligence with machine learning to solve complex reasoning problems at scale.",
            featureItems: [
                { title: "Creative & Writing Tasks", description: "Edit, proofread, and generate creative text to enhance language models' fluency and style." },
                { title: "Technical & Code Reviews", description: "Review and write code, debug algorithms, and test for vulnerabilities to improve AI's logical reasoning." },
                { title: "Safety & Ethics Evaluation", description: "Identify and flag biased, harmful, or unethical responses to build safer and more responsible AI." },
                { title: "AI Model Interaction", description: "Engage in conversations with AI, testing its capabilities and providing feedback on its performance and helpfulness." }
            ],
            whyUsTitle: "Why Us?",
            whyUsSubtitle: "We're building more than just AI. We're building a new paradigm for human-machine collaboration, founded on respect for expertise and a commitment to quality.",
            whyUsItems: [
                { title: "Make a Tangible Impact", description: "Your contributions directly refine the world's most advanced AI models. See the results of your work and be part of the technology that's shaping our future." },
                { title: "Be Valued and Rewarded", description: "We believe expertise should be compensated fairly. Our platform offers competitive rewards for your time and knowledge, with transparent and reliable payments." },
                { title: "Work on Your Terms", description: "Enjoy the freedom to work from anywhere, at any time. Choose tasks that interest you and fit your schedule, creating a perfect work-life balance." },
                { title: "Join an Elite Community", description: "Pass our qualification to join a vetted network of top-tier experts. Collaborate with the best and contribute to a high-quality, trusted data ecosystem." }
            ],
            toolsTitle: "Explore Our AI Models",
            toolsSubtitle: "Go beyond tasks. Directly interact with and shape our suite of generative AI tools.",
            toolsItems: [
                { title: "Chat Models", description: "Converse with our advanced language models to test their conversational abilities, knowledge, and reasoning skills." },
                { title: "Image Generation", description: "Generate stunning, high-quality images from text prompts and help refine the AI's creative and descriptive capabilities." },
                { title: "Video Generation", description: "Create and modify video clips using simple text commands, pushing the boundaries of AI-powered multimedia generation. (Coming Soon)" }
            ],
            workspaceTitle: "Explore the AI Workspace",
            workspaceSubtitle: "One creative workspace for conversations, visuals, video, and music—with access tailored to the plan you choose.",
            workspaceItems: [
                { title: "AI Chat", description: "Ask questions, develop ideas, write content, and get focused help through normal, coding, uncensored, or specialist chat modes available on your plan." },
                { title: "Image Generation", description: "Turn written prompts into original images, refine prompts with AI, and keep your generated artwork organized in a personal gallery." },
                { title: "Video Generation", description: "Create short AI-generated videos from a scene description and preserve the results in your workspace for later access." },
                { title: "Music Generation", description: "Compose complete tracks from lyrics and production guidance, then play, download, and revisit them from your music gallery." },
                { title: "Music AI Assist", description: "Develop song concepts, generate random ideas, write structured lyrics, and create genre, mood, and instrumentation captions automatically." }
            ],
            processTitle: "Simple Process, Powerful Impact",
            processSubtitle: "From sign-up to earning, our streamlined process makes it easy to make a difference.",
            processSteps: [
                { title: "1. Qualify Your Expertise", description: "Create an account and tell us about your skills. You'll take a short, one-time qualification test in your chosen domains to unlock relevant, high-paying tasks. This ensures we maintain the highest quality standards." },
                { title: "2. Complete Paid Tasks", description: "Once approved, you'll gain access to a personalized dashboard with a stream of contributions. Choose tasks that match your skills, from simple data labeling to complex problem-solving, and earn rewards for every quality submission." },
                { title: "3. Withdraw Your Earnings", description: "Your work has real value. Track your earnings in your wallet and easily cash out your balance through multiple secure payment methods. We believe in rewarding expertise, fairly and transparently." }
            ],
            pricingTitle: "Find a Plan to Power Your Ambition",
            pricingSubtitle: "Subscribers get priority access to test our newest models first.",
            testimonialsTitle: "Trusted by Experts Worldwide",
            testimonialsSubtitle: "Our contributors are the backbone of the next AI revolution. Here's what they have to say.",
            testimonials: [
                { name: "Aisha Khan", role: "Software Engineer", quote: "Trainly provides the most interesting and challenging code-related tasks. It's rewarding to know my work directly improves the models I use daily." },
                { name: "Dr. Ben Carter", role: "Medical Researcher", quote: "The platform's focus on quality and accuracy is impressive. It's a fantastic way to contribute specialized knowledge and stay at the cutting edge of AI." },
                { name: "Maria Garcia", role: "Creative Writer & Editor", quote: "I get to use my writing skills to shape how AI communicates. The tasks are engaging, and the platform is incredibly intuitive and fair." }
            ],
            hiringTitle: "Now hiring: researchers, innovators, and trainers",
            hiringSubtitle: "Whether you have expertise in organic chemistry or creative writing, there’s a place for you.",
            ctaTitle: "Ready to Shape the Future?",
            ctaSubtitle: "Join a global community of experts and enthusiasts building the next generation of intelligence.",
            ctaButton: "Sign Up & Start Earning"
        },
        autoApprovalEnabled: false,
        autoApprovalThreshold: 90,
        autoRejectionEnabled: false,
        autoRejectionThreshold: 50,
        qualificationTestAntiCopyEnabled: true,
        qualificationTestCopyAttemptLimit: 5,
        qualificationTestQuestionLimit: 10,
        leaderboardEnabled: true,
    };

    let data: Partial<AppSettings> | null = null;

    if (typeof window === 'undefined') {
        try {
            const { adminDb } = await import('@/lib/firebase-admin');
            const serverSnap = await adminDb.collection('settings').doc('main').get();
            if (serverSnap.exists) {
                data = serverSnap.data() as Partial<AppSettings>;
            }
        } catch {
            // Fall back to public settings read path when admin SDK is unavailable.
        }
    }

    if (!data) {
        if (!db) return defaultSettings;
        const publicSettingsRef = doc(db, 'settings', 'public');
        const publicSnap = await getDoc(publicSettingsRef).catch(() => null);

        if (publicSnap?.exists()) {
            data = fromDoc<AppSettings>(publicSnap);
        } else {
            // Backward compatibility while migrating from settings/main to settings/public.
            const legacyMainRef = doc(db, 'settings', 'main');
            const legacyMainSnap = await getDoc(legacyMainRef).catch(() => null);
            if (legacyMainSnap?.exists()) {
                data = fromDoc<AppSettings>(legacyMainSnap);
            }
        }
    }

    if (data) {
        // Deep merge for nested landingPageContent
        const mergedSettings = { 
            ...defaultSettings, 
            ...data,
            landingPageContent: {
                ...defaultSettings.landingPageContent,
                ...data.landingPageContent,
            }
        } as AppSettings;
        if (!mergedSettings.aiProviders) {
            mergedSettings.aiProviders = [];
        }
        const isProviderPrefixedModel = (model?: string) => {
            const normalized = (model || '').trim();
            if (!normalized) return false;
            const slashIndex = normalized.indexOf('/');
            return slashIndex > 0 && slashIndex < normalized.length - 1;
        };
        const normalizeTextModel = (model?: string) => {
            if (!model) return model;
            const normalized = model.trim();
            if (!isProviderPrefixedModel(normalized)) return defaultSettings.defaultTextGenAiModel;
            return normalized;
        };
        const normalizeImageModel = (model?: string) => {
            if (!model) return model;
            const normalized = model.trim();
            if (!isProviderPrefixedModel(normalized)) return defaultSettings.defaultImageGenAiModel;
            return normalized;
        };
        const normalizeVideoModel = (model?: string) => {
            if (!model) return model;
            const normalized = model.trim();
            if (!isProviderPrefixedModel(normalized)) return defaultSettings.defaultVideoGenAiModel;
            return normalized;
        };

        mergedSettings.defaultGenAiModel = normalizeTextModel(mergedSettings.defaultGenAiModel) || defaultSettings.defaultGenAiModel;
        mergedSettings.defaultTextGenAiModel = normalizeTextModel(mergedSettings.defaultTextGenAiModel) || mergedSettings.defaultGenAiModel || defaultSettings.defaultTextGenAiModel;
        mergedSettings.defaultImageGenAiModel = normalizeImageModel(mergedSettings.defaultImageGenAiModel) || defaultSettings.defaultImageGenAiModel;
        mergedSettings.defaultVideoGenAiModel = normalizeVideoModel(mergedSettings.defaultVideoGenAiModel) || defaultSettings.defaultVideoGenAiModel;
        mergedSettings.plisioApiKey = String(mergedSettings.plisioApiKey || '').trim();
        mergedSettings.plisioPublicBaseUrl = String(mergedSettings.plisioPublicBaseUrl || '').trim();
        mergedSettings.processingTimeZone = String(mergedSettings.processingTimeZone || defaultSettings.processingTimeZone || 'UTC').trim() || 'UTC';
        mergedSettings.defaultCurrency = normalizeCurrencyCode(mergedSettings.defaultCurrency || defaultSettings.defaultCurrency || 'USD');
        mergedSettings.supportedCurrencies = Array.isArray(mergedSettings.supportedCurrencies) && mergedSettings.supportedCurrencies.length > 0
            ? mergedSettings.supportedCurrencies.map((code) => normalizeCurrencyCode(code)).filter((value, index, values) => values.indexOf(value) === index)
            : defaultSettings.supportedCurrencies;
        mergedSettings.depositMethods = (mergedSettings.depositMethods || []).map((method) => normalizeDepositMethod(method as DepositMethod)).filter((method) => method.name.trim() !== '');
        const fallbackWithdrawalMethods = (mergedSettings.paymentMethods || []).map((method) => ({
            id: method.id,
            name: method.name,
            provider: 'custom' as const,
            enabled: true,
            processingMode: 'admin_verified' as const,
            description: '',
            customFields: [],
        }));
        const configuredWithdrawalMethods = (mergedSettings.withdrawalMethods && mergedSettings.withdrawalMethods.length > 0)
            ? mergedSettings.withdrawalMethods
            : fallbackWithdrawalMethods;
        mergedSettings.withdrawalMethods = (configuredWithdrawalMethods || [])
            .map((method) => normalizeWithdrawalMethod(method as WithdrawalMethod))
            .filter((method) => method.name.trim() !== '');
        mergedSettings.paymentMethods = (mergedSettings.withdrawalMethods || []).map((method) => ({ id: method.id, name: method.name }));
        mergedSettings.qualificationTestAntiCopyEnabled = mergedSettings.qualificationTestAntiCopyEnabled !== false;
        mergedSettings.leaderboardEnabled = mergedSettings.leaderboardEnabled !== false;
        const configuredCopyLimit = Number(mergedSettings.qualificationTestCopyAttemptLimit);
        mergedSettings.qualificationTestCopyAttemptLimit = Number.isFinite(configuredCopyLimit)
            ? Math.max(1, Math.floor(configuredCopyLimit))
            : defaultSettings.qualificationTestCopyAttemptLimit;
        const configuredQuestionLimit = Number(mergedSettings.qualificationTestQuestionLimit);
        mergedSettings.qualificationTestQuestionLimit = Number.isFinite(configuredQuestionLimit)
            ? Math.max(1, Math.floor(configuredQuestionLimit))
            : defaultSettings.qualificationTestQuestionLimit;
        return mergedSettings;
    }

    return defaultSettings;
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
    try {
        const q = query(requestsCol, where('userId', '==', userId), orderBy('requestedAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => fromDoc<WithdrawalRequest>(d));
    } catch (error) {
        console.warn('Primary withdrawal query failed. Falling back to unordered query.', error);
        try {
            const fallbackQuery = query(requestsCol, where('userId', '==', userId));
            const snapshot = await getDocs(fallbackQuery);
            const rows = snapshot.docs.map(d => fromDoc<WithdrawalRequest>(d));
            return rows.sort((a, b) => {
                const timeA = typeof a.requestedAt?.toDate === 'function' ? a.requestedAt.toDate().getTime() : new Date(a.requestedAt || 0).getTime();
                const timeB = typeof b.requestedAt?.toDate === 'function' ? b.requestedAt.toDate().getTime() : new Date(b.requestedAt || 0).getTime();
                return timeB - timeA;
            });
        } catch (fallbackError) {
            console.error('Error fetching user withdrawal requests (fallback failed):', fallbackError);
            return [];
        }
    }
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

export async function getPackagePurchaseHistory(userId: string): Promise<PackagePurchase[]> {
    if (!db) return [];
    const purchasesCol = collection(db, 'package_purchases');
    const q = query(purchasesCol, where('userId', '==', userId), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => fromDoc<PackagePurchase>(d));
}

export async function getAllDeposits(): Promise<Deposit[]> {
    if (!db) return [];
    try {
        const [depositsSnapshot, usersSnapshot] = await Promise.all([
            getDocs(query(collection(db, 'deposits'), orderBy('createdAt', 'desc'))),
            getDocs(collection(db, 'users')),
        ]);

        const usersById = new Map<string, { name?: string; email?: string }>();
        usersSnapshot.docs.forEach((userDoc) => {
            usersById.set(userDoc.id, {
                name: String(userDoc.data()?.name || ''),
                email: String(userDoc.data()?.email || ''),
            });
        });

        return depositsSnapshot.docs.map((doc) => {
            const deposit = fromDoc<Deposit>(doc);
            const userMeta = usersById.get(deposit.userId);
            return {
                ...deposit,
                userName: deposit.userName || userMeta?.name || 'Unknown User',
                userEmail: deposit.userEmail || userMeta?.email || '',
            };
        });
    } catch (error) {
        console.error('Error fetching all deposits:', error);
        return [];
    }
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

export async function getPendingApprovals(): Promise<User[]> {
    if (!db) return [];
    try {
        const usersCol = collection(db, 'users');
        const q = query(
            usersCol, 
            where('onboardingStatus', '==', 'pending'),
            orderBy('qualificationTestSubmittedAt', 'asc') // Show oldest first
        );
        const snapshot = await getDocs(q);

        // We filter again in code because `qualificationTestSubmittedAt` might not be present on all pending users
        return snapshot.docs
            .filter(doc => doc.data().qualificationTestSubmittedAt) 
            .map(doc => fromDoc<User>(doc));

    } catch (error) {
        if (error instanceof Error && error.message.includes('firestore/failed-precondition')) {
            console.warn('Firestore index for approvals not found. Fetching without ordering.');
            const usersCol = collection(db, 'users');
            const q = query(usersCol, where('onboardingStatus', '==', 'pending'));
            const snapshot = await getDocs(q);
             return snapshot.docs
                .filter(doc => doc.data().qualificationTestSubmittedAt)
                .map(doc => fromDoc<User>(doc));
        }
        console.error("Error fetching pending approvals:", error);
        return [];
    }
}

export async function getCountryPartners(): Promise<CountryPartner[]> {
    if (!db) return [];
    try {
        const partnersCol = collection(db, 'countryPartners');
        const snapshot = await getDocs(partnersCol);
        return snapshot.docs.map(doc => fromDoc<CountryPartner>(doc));
    } catch (error) {
        console.error("Error fetching country partners:", error);
        return [];
    }
}

export async function getCountryPartnerDetail(partnerId: string): Promise<CountryPartner | null> {
    if (!db) return null;
    try {
        const partnerDocRef = doc(db, 'countryPartners', partnerId);
        const docSnap = await getDoc(partnerDocRef);
        if (docSnap.exists()) {
            return fromDoc<CountryPartner>(docSnap);
        }
        return null;
    } catch (error) {
        console.error(`Error fetching partner detail for ${partnerId}:`, error);
        return null;
    }
}

export async function getUserGeneratedImages(userId: string): Promise<GeneratedImage[]> {
    if (!db) return [];
    try {
        const imagesCol = collection(db, 'generated_images');
        const q = query(imagesCol, where('userId', '==', userId), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => fromDoc<GeneratedImage>(doc));
    } catch (error) {
        console.error("Error fetching user generated images:", error);
        return [];
    }
}

export async function getUserGeneratedVideos(userId: string): Promise<GeneratedVideo[]> {
    if (!db) return [];
    try {
        const videosCol = collection(db, 'generated_videos');
        const q = query(videosCol, where('userId', '==', userId), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => fromDoc<GeneratedVideo>(doc));
    } catch (error) {
        console.error("Error fetching user generated videos:", error);
        return [];
    }
}

export async function getUserGeneratedMusic(userId: string): Promise<GeneratedMusic[]> {
    if (!db) return [];
    try {
        const musicCol = collection(db, 'generated_music');
        const q = query(musicCol, where('userId', '==', userId), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => fromDoc<GeneratedMusic>(doc));
    } catch (error) {
        console.error("Error fetching user generated music:", error);
        return [];
    }
}
