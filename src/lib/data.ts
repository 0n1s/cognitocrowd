import { Task, LeaderboardEntry, Reward, CompletedTask, Package } from './types';

export const mockTasks: Task[] = [
  {
    id: '1',
    type: 'multiple_choice_preference',
    title: 'Which response feels more professional?',
    description: "User: I need my invoice right now.",
    options: [
        { "text": "I'm on it. You'll receive it shortly." },
        { "text": "Relax, it's coming." },
        { "text": "Just wait a minute." }
    ],
    settings: {
        allow_comment: true,
        allow_confidence: true
    },
    points: 75,
    difficulty: 'Easy',
  },
  {
    id: '2',
    type: 'ranking',
    title: 'Rank the following responses from most to least helpful.',
    description: "User: I can't log into my account.",
    options: [
      "Please try resetting your password.",
      "That's not my problem.",
      "Make sure you're using the right username."
    ],
    settings: {
      allow_comment: true
    },
    points: 200,
    difficulty: 'Medium',
  },
  {
    id: '3',
    type: 'likert_scale',
    title: 'Rate the clarity of this instruction.',
    description: "Click your avatar, then choose 'Edit Profile'.",
    scale: {
      min: 1,
      max: 5,
      labels: {
        "1": "Very unclear",
        "5": "Very clear"
      }
    },
    settings: {
      allow_comment: true,
      allow_confidence: true
    },
    points: 100,
    difficulty: 'Easy'
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
