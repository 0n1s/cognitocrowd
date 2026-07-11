export type TaskOption =
  | string
  | { text: string }
  | { label: string; text: string };

export interface LikertScale {
  min: number;
  max: number;
  labels: { value: number; label: string; }[];
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
  status?: 'Active' | 'Paused';
  expertise?: string;
  createdAt?: any; // Firestore Timestamp
};

export type QualificationQuestion = {
  question: string;
  options: string[];
  answer: string;
};

export type QualificationTest = {
  id: string; // The expertise name
  expertise: string;
  questions: QualificationQuestion[];
  createdAt: any; // Firestore Timestamp
  isEnabled?: boolean;
};

export type User = {
  id: string;
  name: string;
  email: string;
  photoURL?: string;
  earningsBalance: number;
  depositBalance: number;
  packageId: string | null;
  completedTasks?: string[];
  createdAt: any; // Firestore Timestamp
  role?: 'user' | 'super_user_alpha_7' | 'country_partner';
  dailyCompletedCount?: number;
  lastCompletionReset?: any; // Firestore Timestamp
  dailyImageGenerationCount?: number;
  lastImageGenerationReset?: any; // Firestore Timestamp
  packageImageGenerationCount?: number;
  dailyVideoGenerationCount?: number;
  lastVideoGenerationReset?: any; // Firestore Timestamp
  packageVideoGenerationCount?: number;
  dailyMusicGenerationCount?: number;
  lastMusicGenerationReset?: any; // Firestore Timestamp
  packageMusicGenerationCount?: number;
  onboardingStatus?: 'pending' | 'approved' | 'rejected';
  accountExpiresAt?: any; // Firestore Timestamp
  country?: string;
  languages?: string[];
  expertise?: string[];
  qualificationTestGeneratedAt?: any; // Firestore Timestamp
  qualificationQuestions?: QualificationQuestion[];
  qualificationTestSubmittedAt?: any;
  qualificationSubmission?: Record<string, any>;
  qualificationScore?: number;
  qualificationFeedback?: string;
  qualificationResults?: { correctCount: number; totalCount: number; };
  qualificationCopyAttemptCount?: number;
  qualificationLastCopyAttemptAt?: any;
  ipAddress?: string;
  registrationIp?: string;
  ipHistory?: string[];
  browserFingerprint?: string;
  registrationFingerprint?: string;
  referralCode?: string;
  referredBy?: string;
  referralEligible?: boolean;
  referralBalance?: number;
  referralEarningsTotal?: number;
  referralFirstDepositRewardedAt?: any;
  referralFirstDepositId?: string;
};

export type AdminUser = User & {
  packageName: string;
};

export type UserNotificationType =
  | 'system'
  | 'account'
  | 'wallet'
  | 'generation'
  | 'task'
  | 'partner'
  | 'referral';

export type UserNotification = {
  id: string;
  userId: string;
  type: UserNotificationType;
  title: string;
  message: string;
  href?: string;
  readAt?: any;
  createdAt: any;
  metadata?: Record<string, unknown>;
};

export type CountryPartner = {
  id: string;
  userId: string;
  name: string;
  email: string;
  country: string;
  depositFeePercent: number;
  withdrawalFeePercent: number;
  isActive: boolean;
  isAvailable?: boolean;
  partnerWalletBalance?: number;
  paymentMethods?: string[];
  workingHours?: string;
  depositLimit?: number;
  withdrawalLimit?: number;
  minimumWalletBalance?: number;
  permissions?: { deposits: boolean; withdrawals: boolean; messaging: boolean };
  suspendedAt?: any;
};

export type PartnerApplication = {
  id: string;
  userId: string;
  name: string;
  email: string;
  country: string;
  paymentMethods: string[];
  reason: string;
  workingHours: string;
  extraInformation?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: any;
  reviewedAt?: any;
};

export type PartnerTransactionStatus = 'pending' | 'awaiting_payment' | 'paid_by_user' | 'confirmed_by_partner' | 'paid_by_partner' | 'completed' | 'rejected' | 'disputed' | 'cancelled';

export type PartnerTransaction = {
  id: string;
  type: 'deposit' | 'withdrawal';
  userId: string;
  userName: string;
  userEmail: string;
  partnerId: string;
  partnerUserId: string;
  partnerName: string;
  country: string;
  amount: number;
  paymentMethod: string;
  paymentInstructions?: string;
  status: PartnerTransactionStatus;
  notes?: Array<{ senderId: string; senderRole: 'user' | 'partner' | 'admin'; message: string; createdAt: any }>;
  createdAt: any;
  updatedAt: any;
  completedAt?: any;
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
  priceAmount?: number;
  priceCurrency?: string;
  priceBillingPeriod?: string;
  features: string[];
  isPrimary?: boolean;
  taskLimit: number;
  allowWithdrawals?: boolean;
  withdrawalMinimumAmount?: number;
  withdrawalMaximumAmount?: number;
  imageGenerationLimit?: number;
  imageGenerationLimitType?: 'daily' | 'lifetime';
  videoGenerationLimit?: number;
  videoGenerationLimitType?: 'daily' | 'lifetime';
  musicGenerationLimit?: number;
  musicGenerationLimitType?: 'daily' | 'lifetime';
  allowMusicGenerationAssist?: boolean;
  allowMusicStyleProfiles?: boolean;
  allowChatNormal?: boolean;
  allowChatUncensored?: boolean;
  allowChatCoding?: boolean;
  allowChatHacking?: boolean;
  allowImageNormal?: boolean;
  allowImageUncensored?: boolean;
  allowedModelTypes?: string[];
  allowUncensoredImageGeneration?: boolean;
  allowMusicGeneration?: boolean;
  aiRankedPayoutEnabled?: boolean;
  allowVideoGeneration?: boolean;
  expiryPeriod: string;
  referralBonusPercentage?: number;
  referralBonusFixed?: number;
  referralBonusMaximum?: number;
  referralBonusMinimumDeposit?: number;
  referralBonusFirstDepositOnly?: boolean;
  allowAiProfilePicture?: boolean;
};

export type TaskResponse = {
  id: string;
  userId: string;
  taskId: string;
  pointsEarned: number;
  maxPoints?: number;
  scorePercent?: number;
  submittedAt: any; // Firestore Timestamp
  responseData: Record<string, any>;
  rank?: number;
  rankExplanation?: string;
  verificationPassed?: boolean;
  verificationExplanation?: string;
};

export type PaymentMethod = {
  id: string;
  name: string;
};

export type WithdrawalMethodProvider = 'custom';

export type WithdrawalMethodProcessingMode = 'admin_verified';

export type WithdrawalMethodField = {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  inputType?: 'text' | 'email' | 'number' | 'textarea' | 'password' | 'url' | 'tel' | 'image';
};

export type WithdrawalMethod = {
  id: string;
  name: string;
  provider: WithdrawalMethodProvider;
  enabled: boolean;
  processingMode: WithdrawalMethodProcessingMode;
  minimumAmount?: number;
  maximumAmount?: number;
  description?: string;
  customFields?: WithdrawalMethodField[];
};

export type DepositMethodProvider = 'plisio' | 'custom';

export type DepositMethodProcessingMode = 'automatic' | 'admin_verified';

export type DepositMethodField = {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  inputType?: 'text' | 'email' | 'number' | 'textarea' | 'password' | 'url' | 'tel' | 'image';
};

export type DepositMethod = {
  id: string;
  name: string;
  provider: DepositMethodProvider;
  enabled: boolean;
  processingMode: DepositMethodProcessingMode;
  minimumAmount?: number;
  maximumAmount?: number;
  description?: string;
  credentials?: Record<string, string>;
  customFields?: DepositMethodField[];
};

export type OnboardingStep = {
    id: string;
    title: string;
    content: string;
};

export type FAQItem = {
    id: string;
    question: string;
    answer: string;
    enabled?: boolean;
};

export type PublicPageKey = 'about' | 'contact' | 'privacy' | 'terms' | 'refund' | 'guidelines';

export type PublicPageContent = {
    title: string;
    subtitle?: string;
    content: string;
    contentHtml?: string;
    enabled?: boolean;
};

export type LandingPageContent = {
    processImage1: string;
    processImage2: string;
    processImage3: string;
    hiringBackgroundImage: string;

    heroTitle: string;
    heroSubtitle: string;
    heroCtaButton: string;

    platformTitle: string;
    platformSubtitle: string;
    featureItems: { title: string; description: string; }[];

    whyUsTitle: string;
    whyUsSubtitle: string;
    whyUsItems: { title: string; description: string; }[];

    toolsTitle: string;
    toolsSubtitle: string;
    toolsItems: { title: string; description: string; }[];

    workspaceTitle: string;
    workspaceSubtitle: string;
    workspaceItems: { title: string; description: string; }[];

    processTitle: string;
    processSubtitle: string;
    processSteps: { title: string; description: string; }[];

    pricingTitle: string;
    pricingSubtitle: string;

    testimonialsTitle: string;
    testimonialsSubtitle: string;
    testimonials: { name: string; role: string; quote: string; }[];

    hiringTitle: string;
    hiringSubtitle: string;

    ctaTitle: string;
    ctaSubtitle: string;
    ctaButton: string;
};


export type AppSettings = {
  id?: 'main';
  paymentMethods: PaymentMethod[];
  depositMethods: DepositMethod[];
  withdrawalMethods?: WithdrawalMethod[];
  plisioApiKey?: string;
  plisioPublicBaseUrl?: string;
  withdrawalScheduleInfo: string;
  processingTimeZone?: string;
  withdrawalDays?: string[];
  withdrawalMinimumAmount?: number;
  withdrawalMaximumAmount?: number;
  defaultCurrency?: string;
  supportedCurrencies?: string[];
  defaultTextGenAiModel?: string;
  defaultImageGenAiModel?: string;
  defaultVideoGenAiModel?: string;
  defaultAudioGenAiModel?: string;
  defaultUncensoredAiModel?: string;
  defaultVisionAiModel?: string;
  defaultHackingAiModel?: string;
  defaultCodingAiModel?: string;
  defaultGenAiModel?: string;
  aiProviders?: AiProviderConfig[];
  openAiCompatibleProviderName?: string;
  openAiCompatibleBaseUrl?: string;
  openAiCompatibleApiKey?: string;
  openAiCompatibleDiscoveredModels?: string[];
  onboardingCourseEnabled?: boolean;
  onboardingCourseTitle?: string;
  onboardingCourseDescription?: string;
  onboardingCourseSteps?: OnboardingStep[];
  faqEnabled?: boolean;
  faqTitle?: string;
  faqSubtitle?: string;
  faqItems?: FAQItem[];
  publicTrustCompanyContext?: string;
  publicTrustPageAiModel?: string;
  supportWidgetEnabled?: boolean;
  supportWidgetProvider?: 'none' | 'tawk' | 'crisp' | 'custom';
  supportWidgetTawkPropertyId?: string;
  supportWidgetTawkWidgetId?: string;
  supportWidgetCrispWebsiteId?: string;
  supportWidgetScriptUrl?: string;
  supportWidgetCustomScript?: string;
  publicPages?: Partial<Record<PublicPageKey, PublicPageContent>>;
  landingPageContent?: LandingPageContent;
  autoApprovalEnabled?: boolean;
  autoApprovalThreshold?: number;
  autoRejectionEnabled?: boolean;
  autoRejectionThreshold?: number;
  qualificationTestAntiCopyEnabled?: boolean;
  qualificationTestCopyAttemptLimit?: number;
  qualificationTestQuestionLimit?: number;
  leaderboardEnabled?: boolean;
  aiRankedPayoutMode?: 'off' | 'on' | 'per_package';
  earnPerScoreEnabled?: boolean;
  partnerProgramEnabled?: boolean;
  partnerProgramTitle?: string;
  partnerProgramDescription?: string;
  partnerProgramRules?: string;
  partnerMinimumAccountAgeDays?: number;
  partnerMinimumWalletBalance?: number;
  partnerMinimumCompletedTransactions?: number;
  partnerRequireVerifiedEmail?: boolean;
  partnerRequireKyc?: boolean;
  partnerSupportedCountries?: string[];
  partnerDepositDays?: string[];
  partnerDepositMinimumAmount?: number;
  partnerDepositMaximumAmount?: number;
  partnerWithdrawalDays?: string[];
  partnerWithdrawalMinimumAmount?: number;
  partnerWithdrawalMaximumAmount?: number;

  // Email & Notification settings
  requireEmailVerification?: boolean;
  emailNotificationsEnabled?: boolean;
};

export type AiProviderConfig = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  supportsText?: boolean;
  supportsImage?: boolean;
  supportsVideo?: boolean;
  supportsAudio?: boolean;
  discoveredModels?: string[];
  discoveredModelModalities?: Record<string, string[]>;
  discoveredModelTypes?: Record<string, string[]>;
};

export type WithdrawalRequest = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number; // in points
  amountInCurrency?: number;
  amountCurrency?: string;
  amountUsd?: number;
  fxRateToUsd?: number;
  fxBaseCurrency?: string;
  fxFetchedAtIso?: string;
  source?: 'earnings' | 'partner_wallet';
  partnerId?: string;
  partnerUserId?: string;
  withdrawalMethodId?: string;
  paymentMethod: string;
  paymentDetails: string;
  fieldValues?: Record<string, string>;
  status: 'pending' | 'completed' | 'failed' | 'canceled';
  requestedAt: any; // Firestore Timestamp
  processedAt?: any; // Firestore Timestamp
};

export type Deposit = {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  amount: number;
  amountInCurrency?: number;
  amountCurrency?: string;
  amountUsd?: number;
  fxRateToUsd?: number;
  fxBaseCurrency?: string;
  fxFetchedAtIso?: string;
  method: string;
  status: 'completed' | 'pending' | 'failed';
  depositMethodId?: string;
  depositMethodProvider?: string;
  externalProvider?: string;
  externalTxnId?: string;
  externalOrderNumber?: string;
  externalInvoiceUrl?: string;
  fieldValues?: Record<string, string>;
  processedAt?: any;
  createdAt: any; // Firestore Timestamp or ISO String
};

export type PackagePurchase = {
  id: string;
  userId: string;
  packageId: string;
  packageName: string;
  amount: number;
  amountCurrency: string;
  amountUsd: number;
  status: 'completed';
  source?: 'deposit_balance';
  createdAt: any;
};

export type Expense = {
  id: string;
  amount: number;
  amountInCurrency?: number;
  amountCurrency?: string;
  amountUsd?: number;
  fxRateToUsd?: number;
  fxBaseCurrency?: string;
  fxFetchedAtIso?: string;
  category: string;
  note?: string;
  createdBy?: string;
  createdAt: any;
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

export type GeneratedImage = {
  id: string;
  userId: string;
  prompt: string;
  imageModel?: 'normal' | 'uncensored';
  status?: 'submitting' | 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  jobId?: string;
  providerModel?: string;
  errorMessage?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  createdAt: any;
  updatedAt?: any;
};

export type GeneratedVideo = {
  id: string;
  userId: string;
  prompt: string;
  rawIdea?: string;
  durationSeconds?: number;
  aspectRatio?: '9:16' | '16:9';
  resolution?: '480x848' | '848x480' | '720x1280' | '1280x720';
  status?: 'submitting' | 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  jobId?: string;
  providerModel?: string;
  errorMessage?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  createdAt: any;
  updatedAt?: any;
};

export type GeneratedMusic = {
  id: string;
  userId: string;
  prompt: string;
  altPrompt?: string;
  durationSeconds: number;
  audioUrl: string;
  storagePath?: string;
  createdAt: any;
};

export type MusicStyleProfile = {
  id: string;
  userId: string;
  name: string;
  caption: string;
  createdAt: any;
  updatedAt: any;
};
