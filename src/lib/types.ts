export type Task = {
  id: string;
  title: string;
  description: string;
  points: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  type: 'open_text_feedback' | 'multiple_choice_preference' | 'ranking' | 'classification';
  options?: string[]; // For multiple choice or ranking
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
