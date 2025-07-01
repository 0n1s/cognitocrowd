import { Task, LeaderboardEntry, Reward, CompletedTask, Package, TaskType } from './types';

export const mockTasks: Task[] = [
  {
    id: 'q001',
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
    award_criteria: {
        explanation: "Preferences are aggregated to train tone perception."
    },
    points: 75,
    difficulty: 'Easy',
    status: 'Active',
  },
  {
    id: 'q002',
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
    award_criteria: {
        explanation: "Captures user judgment on response quality."
    },
    points: 200,
    difficulty: 'Medium',
    status: 'Active',
  },
  {
    id: 'q003',
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
    award_criteria: {
        explanation: "Used to learn clarity and usability perception."
    },
    points: 100,
    difficulty: 'Easy',
    status: 'Active',
  },
  {
      id: "q004",
      type: "classification",
      title: "What tone does this sentence convey?",
      description: "Well, maybe read the manual next time.",
      options: [
        "Helpful",
        "Sarcastic",
        "Polite",
        "Neutral"
      ],
      settings: {
        allow_comment: true
      },
      award_criteria: {
        explanation: "Gathers tone recognition from users."
      },
      points: 150,
      difficulty: 'Medium',
      status: 'Active',
  },
  {
      id: "q005",
      type: "sentiment",
      title: "What sentiment is expressed here?",
      description: "Nothing works on this site and I’ve wasted an hour!",
      options: [
        "Positive",
        "Neutral",
        "Negative"
      ],
      settings: {
        allow_comment: false
      },
      award_criteria: {
        explanation: "Used to train emotion recognition models."
      },
      points: 250,
      difficulty: 'Hard',
      status: 'Active',
  },
  {
      id: "q006",
      type: "topic_classification",
      title: "What is the topic of this statement?",
      description: "Unemployment dropped by 2% in Q2 2025.",
      options: [
        "Health",
        "Finance",
        "Education"
      ],
      settings: {
        allow_comment: false
      },
      award_criteria: {
        explanation: "Used to train topic classifiers."
      },
      points: 75,
      difficulty: 'Easy',
      status: 'Active',
  },
  {
      id: "q007",
      type: "open_text_feedback",
      title: "How would you improve this assistant response?",
      description: "I already told you what to do.",
      settings: {
        min_chars: 10,
        max_chars: 300
      },
      award_criteria: {
        explanation: "Freeform feedback helps improve assistant behavior."
      },
      points: 200,
      difficulty: 'Medium',
      status: 'Active',
  },
  {
      id: "q008",
      type: "compare_pairwise",
      title: "Which response is better?",
      description: "User: My order arrived broken.",
      options: [
        { "label": "Response A", "text": "Sorry to hear that! I’ll help you right away." },
        { "label": "Response B", "text": "Not my problem. Contact the courier." }
      ],
      settings: {
        allow_comment: true,
        allow_confidence: true
      },
      award_criteria: {
        explanation: "Used for pairwise preference ranking in RLHF."
      },
      points: 100,
      difficulty: 'Easy',
      status: 'Active',
  },
  {
      id: "q009",
      type: "label_multiple",
      title: "Which of the following labels apply to this sentence?",
      description: "I can’t believe they hired someone like her.",
      options: [
        "Biased",
        "Offensive",
        "Neutral",
        "Needs context"
      ],
      settings: {
        allow_multi_select: true,
        allow_comment: true,
      },
      award_criteria: {
        explanation: "Supports multi-label annotation of complex inputs."
      },
      points: 250,
      difficulty: 'Hard',
      status: 'Active',
  }
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

export const mockPackages: Omit<Package, 'id'>[] = [
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
