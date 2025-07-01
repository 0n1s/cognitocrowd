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
};

export type User = {
  id: string;
  name: string;
  email: string;
  points: number;
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
  id: string;
  title: string;
  completedAt: string;
  points: number;
};

export type Package = {
  name: string;
  price: string;
  features: string[];
  isPrimary?: boolean;
};

export type AdminTask = {
    id: string;
    title: string;
    type: string;
    points: number;
    status: 'Active' | 'Archived';
}
