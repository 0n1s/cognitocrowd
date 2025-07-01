import { Task, LeaderboardEntry, Reward, CompletedTask, Package, AdminTask } from './types';

export const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Describe this Image',
    description: 'Provide a detailed description of the provided image to help train our vision models.',
    points: 150,
    difficulty: 'Easy',
    type: 'open_text_feedback',
  },
  {
    id: '2',
    title: 'Which Headline is Better?',
    description: 'Choose the most engaging headline from the options below for an article about space exploration.',
    points: 75,
    difficulty: 'Easy',
    type: 'multiple_choice_preference',
    options: ['Voyage to the Stars', 'Cosmic Journeys Unveiled', 'The Final Frontier Awaits'],
  },
  {
    id: '3',
    title: 'Rank these Features',
    description: 'Rank the following features for a new productivity app from most to least important.',
    points: 200,
    difficulty: 'Medium',
    type: 'ranking',
    options: ['Dark Mode', 'AI Assistant', 'Offline Access', 'Third-party Integrations'],
  },
  {
    id: '4',
    title: 'Classify Customer Feedback',
    description: 'Read the customer review and classify its sentiment as positive, negative, or neutral.',
    points: 100,
    difficulty: 'Medium',
    type: 'classification',
    options: ['Positive', 'Negative', 'Neutral']
  },
  {
    id: '5',
    title: 'Translate this Phrase',
    description: 'Provide a natural-sounding translation of the given English phrase into French.',
    points: 250,
    difficulty: 'Hard',
    type: 'open_text_feedback',
  },
  {
    id: '6',
    title: 'Choose the Best Logo',
    description: 'Select the logo design you find most appealing for a new coffee brand.',
    points: 50,
    difficulty: 'Easy',
    type: 'multiple_choice_preference',
    options: ['Logo A', 'Logo B', 'Logo C'],
  },
];

export const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, user: { name: 'Alex' }, points: 12500 },
  { rank: 2, user: { name: 'Barbara' }, points: 11800 },
  { rank: 3, user: { name: 'Charlie' }, points: 11250 },
  { rank: 4, user: { name: 'David' }, points: 10500 },
  { rank: 5, user: { name: 'Eleanor' }, points: 9800 },
  { rank: 6, user: { name: 'Frank' }, points: 9200 },
  { rank: 7, user: { name: 'Grace' }, points: 8500 },
  { rank: 8, user: { name: 'Henry' }, points: 8100 },
  { rank: 9, user: { name: 'Isabella' }, points: 7600 },
  { rank: 10, user: { name: 'Jack' }, points: 7200 },
];

export const mockRewards: Reward[] = [
  {
    id: '1',
    name: '$5 Coffee Gift Card',
    description: 'Get a digital gift card for your favorite coffee shop.',
    cost: 5000,
    image: 'https://placehold.co/600x400.png',
  },
  {
    id: '2',
    name: '$10 Streaming Service Credit',
    description: 'Enjoy a movie night on us with a credit for popular streaming services.',
    cost: 9500,
    image: 'https://placehold.co/600x400.png',
  },
  {
    id: '3',
    name: '$25 Online Retailer Gift Card',
    description: 'Shop for anything you want with a gift card for a major online retailer.',
    cost: 23000,
    image: 'https://placehold.co/600x400.png',
  },
  {
    id: '4',
    name: 'Exclusive CognitoCrowd T-Shirt',
    description: 'Show your support with a high-quality, branded t-shirt.',
    cost: 15000,
    image: 'https://placehold.co/600x400.png',
  },
];

export const mockCompletedTasks: CompletedTask[] = [
  { id: '1', title: 'Choose the Best Logo', completedAt: '2024-05-20', points: 50 },
  { id: '2', title: 'Classify Customer Feedback', completedAt: '2024-05-19', points: 100 },
  { id: '3', title: 'Rank these Features', completedAt: '2024-05-18', points: 200 },
  { id: '4', title: 'Which Headline is Better?', completedAt: '2024-05-17', points: 75 },
  { id: '5', title: 'Describe this Image', completedAt: '2024-05-16', points: 150 },
];

export const mockPackages: Package[] = [
    {
        name: 'Starter',
        price: 'Free',
        features: ['Up to 50 tasks per month', 'Standard rewards', 'Basic leaderboard access'],
    },
    {
        name: 'Pro',
        price: '$10/mo',
        features: ['Up to 200 tasks per month', 'Premium rewards', 'Advanced leaderboard stats', 'Priority task access'],
        isPrimary: true,
    },
    {
        name: 'Expert',
        price: '$25/mo',
        features: ['Unlimited tasks', 'Exclusive rewards', 'Expert-level tasks', 'Direct impact reports'],
    }
]

export const mockAdminTasks: AdminTask[] = [
    { id: '1', title: 'Describe this Image', type: 'open_text_feedback', points: 150, status: 'Active' },
    { id: '2', title: 'Which Headline is Better?', type: 'multiple_choice_preference', points: 75, status: 'Active' },
    { id: '3', title: 'Rank these Features', type: 'ranking', points: 200, status: 'Active' },
    { id: '4', title: 'Classify Customer Feedback', type: 'classification', points: 100, status: 'Archived' },
];
