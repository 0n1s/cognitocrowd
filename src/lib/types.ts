

export type TaskOption =
  | string
  | { text: string }
  | { label: string; text: string };

export interface LikertScale {
  min: number;
  max: number;
  labels: { [key: number]: string };
}

export interface TaskSettings {
  allow_comment?: boolean;
  allow_confidence?: boolean;
  min_chars?: number;
  max_chars?: number;
  allow_multi_select?: boolean;
}

export type TaskType =
  | 'multiple_choice_preference'
  | 'ranking'
  | 'likert_scale'
  | 'classification'
  | 'sentiment'
  | 'topic_classification'
  | 'open_text_feedback'
  | 'compare_pairwise'
  | 'label_multiple';

export interface Task {
  id: string;
  title: string; // Corresponds to 'question' in JSON
  description?: string; // Corresponds to 'context' in JSON
  points: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  type: TaskType;
  options?: TaskOption[];
  scale?: LikertScale;
  settings?: TaskSettings;
  award_criteria?: {
    explanation: string;
  };
  status?: 'Active' | 'Archived';
};

export type User = {
  id: string;
  name: string;
  email: string;
  earningsBalance: number;
  depositBalance: number;
  packageId: string | null;
  completedTasks?: string[];
  createdAt: any; // Firestore Timestamp
  role?: 'user' | 'admin';
  dailyCompletedCount?: number;
  lastCompletionReset?: any; // Firestore Timestamp
};

export type AdminUser = User & {
  packageName: string;
};

export type Reward = {
  id: string;
  name: string;
  description: string;
  cost: number;
  image: string;
};

export type LeaderboardEntry = {
  rank: number;
  user: Pick<User, 'name'>;
  points: number;
};

export type CompletedTask = {
  id:string;
  title: string;
  completedAt: string;
  points: number;
};

export type Package = {
  id: string;
  name: string;
  price: string;
  features: string[];
  isPrimary?: boolean;
  taskLimit: number;
  expiryPeriod: string;
};

export type AdminTask = {
    id: string;
    title: string;
    type: string;
    points: number;
    status: 'Active' | 'Archived';
};

export type TaskResponse = {
  id: string;
  userId: string;
  taskId: string;
  pointsEarned: number;
  submittedAt: any; // Firestore Timestamp
  responseData: Record<string, any>;
  rank?: number;
  rankExplanation?: string;
};

export type PaymentMethod = {
  id: string;
  name: string;
};

export type AppSettings = {
  id?: 'main';
  paymentMethods: PaymentMethod[];
  depositMethods: PaymentMethod[];
  withdrawalScheduleInfo: string;
  withdrawalDays?: string[];
};

export type WithdrawalRequest = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number; // in points
  paymentMethod: string;
  paymentDetails: string;
  status: 'pending' | 'completed' | 'failed';
  requestedAt: any; // Firestore Timestamp
  processedAt?: any; // Firestore Timestamp
};

export type ChatMessage = {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  createdAt: any; // Firestore Timestamp or ISO String
};

export type ChatSession = {
  id: string;
  userId: string;
  title: string;
  createdAt: any; // Firestore Timestamp or ISO String
  updatedAt: any; // Firestore Timestamp or ISO String
  messages: ChatMessage[];
};
