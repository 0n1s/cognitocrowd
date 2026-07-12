# TrainlyLabs — AI Contributor Platform

A full-stack web platform where contributors can qualify for paid AI training tasks, use AI workspace tools (chat, image/video/music generation), manage wallet activity, and participate in community programs.

Built with **Next.js 15**, **Firebase**, **Genkit AI**, and **Tailwind CSS**.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Project Structure](#project-structure)
- [Key Modules](#key-modules)
- [Captcha Configuration](#captcha-configuration)
- [Exchange Rates](#exchange-rates)
- [Email (Zeptomail)](#email-zeptomail)
- [AI Models](#ai-models)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## Features

### Contributor Features
- **Dashboard** — Overview of earnings, completed tasks, package info
- **AI Chat** — Multi-model chat (Normal, Uncensored, Coding, Hacking) with reasoning summaries
- **AI Image Studio** — Generate images using configured AI models
- **AI Video Studio** — Generate short videos
- **AI Music Studio** — Generate music tracks
- **Contributions** — Complete paid tasks (multiple choice, ranking, likert scale, open text, etc.)
- **Wallet** — Manage earnings, deposits, withdrawals
- **Rewards & Referrals** — Earn referral bonuses
- **Leaderboard** — Compete with other contributors
- **Packages** — Subscription plans with feature limits
- **Partner Portal** — Country partner deposit/withdrawal management

### Admin Features
- **Dashboard** — Stats, finance analytics, charts
- **User management** — View/edit users, approve/reject onboarding, email verification status
- **Task/Contribution management** — Create, bulk-generate via AI, pause/delete
- **Package management** — Create and manage subscription packages
- **Deposit & Withdrawal management** — Approve/review transactions
- **Qualification tests** — AI-generated expertise tests, anti-copy protection
- **Settings** — AI model config, email/notification settings, captcha, onboarding course, FAQ generator, public trust pages, support widget, partner program, withdrawal schedule
- **Email Logs** — Track all transactional emails sent from the platform

### Security
- Captcha on signup/login (local math captcha or Cloudflare Turnstile)
- Rate limiting on admin actions and public endpoints
- Email verification requirement (configurable)
- Firebase ID token verification on all API routes

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 15](https://nextjs.org/) (App Router, Turbopack) |
| UI Library | [React 18](https://react.dev/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) + shadcn/ui components |
| Authentication | [Firebase Auth](https://firebase.google.com/docs/auth) (email/password + Google OAuth) |
| Database | [Firebase Firestore](https://firebase.google.com/docs/firestore) |
| File Storage | [Firebase Storage](https://firebase.google.com/docs/storage) |
| AI Flows | [Genkit](https://firebase.google.com/docs/genkit) with OpenAI-compatible providers |
| Email | [Zeptomail](https://zeptomail.com/) transactional API |
| Push Notifications | Firebase Cloud Messaging (FCM) |
| Currency | Open Exchange Rates API |
| Hosting | Vercel / Firebase App Hosting |

---

## Getting Started

### Prerequisites

- Node.js 22.x
- A Firebase project with **Authentication**, **Firestore**, and **Storage** enabled
- A Zeptomail account (for transactional emails)
- (Optional) An Open Exchange Rates API key

### Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in the required values:

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API key | ✅ |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain | ✅ |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | ✅ |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | ✅ |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID | ✅ |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID | ✅ |
| `FIREBASE_ADMIN_PROJECT_ID` | Admin SDK project ID | ✅ |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Admin SDK client email | ✅ |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Admin SDK private key | ✅ |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Web push certificate | ❌ |
| `ZEPTOMAIL_API_KEY` | Zeptomail API key | ❌ (emails won't send) |
| `OPENAI_COMPATIBLE_BASE_URL` | AI provider base URL | ❌ (configurable in admin) |
| `OPENAI_COMPATIBLE_API_KEY` | AI provider API key | ❌ (configurable in admin) |

#### Firebase Admin Credentials

1. In Firebase Console → Project Settings → Service accounts
2. Click **Generate new private key**
3. Map the JSON fields to your `.env`:

```dotenv
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Important:** Keep `\n` for newlines in the private key. Do not use `NEXT_PUBLIC_` prefix for admin credentials.

---

## Running Locally

```bash
# Install dependencies
npm install

# Start the dev server (port 9002)
npm run dev

# Start Genkit AI flow development (optional)
npm run genkit:dev

# Type-check
npm run typecheck

# Build for production
npm run build
```

Open [http://localhost:9002](http://localhost:9002) in your browser.

---

## Project Structure

```
src/
├── ai/                  # Genkit AI flows and model definitions
│   ├── flows/           # AI flows (chat, task generation, image, video, etc.)
│   ├── models.ts        # Model registry and provider config
│   └── genkit.ts        # Genkit runtime setup
├── app/                 # Next.js App Router pages and API routes
│   ├── (admin)/         # Admin panel layout and pages
│   ├── (app)/           # Authenticated app layout and pages
│   ├── (auth)/          # Auth pages (login, signup, forgot-password)
│   ├── (onboarding)/    # Onboarding flow
│   ├── api/             # API routes
│   │   ├── admin/       # Admin API endpoints
│   │   └── user/        # User API endpoints
│   ├── verify-email/    # Email verification page
│   └── page.tsx         # Landing page
├── components/          # Shared UI components
│   ├── ui/              # shadcn/ui components
│   ├── admin/           # Admin-specific components
│   └── security/        # Captcha components
├── hooks/               # Custom React hooks
└── lib/                 # Utility libraries
    ├── database.ts      # Firestore read helpers
    ├── firebase.ts      # Firebase client init
    ├── firebase-admin.ts# Firebase Admin SDK init
    ├── email.ts         # Zeptomail email sender
    ├── email-templates.ts # Branded HTML email templates
    ├── user-api.ts      # User action helpers
    ├── admin-api.ts     # Admin API client
    ├── notifications-admin.ts # Notification system
    ├── referrals-admin.ts # Referral bonus logic
    └── types.ts         # TypeScript type definitions
```

---

## Key Modules

### AI Chat (`/chat`)
Multi-model chat with Normal, Uncensored, Coding, and Hacking modes. Messages persist locally and sync to Firestore. Supports markdown rendering with syntax highlighting.

### AI Image/Video/Music Generation
Each generation studio has its own page with model selection, prompt input, progress tracking, and generation history.

### Contribuions (`/tasks`)
Users complete AI-evaluated tasks. Supports multiple question types:
- Multiple choice preference
- Ranking
- Likert scale
- Classification / Sentiment / Topic
- Open text feedback
- Pairwise comparison
- Multi-label

### Admin Panel (`/admin`)
Full admin control center with:
- Dashboard with statistics and finance charts
- User management with approval flow
- Package management
- Task creation (manual + AI bulk generation)
- Deposit/withdrawal moderation
- Qualification test management
- Partner program management
- Landing page content editor with rich text
- FAQ generator using AI
- AI model provider configuration
- Email & notification settings
- Email logs viewer

---

## Captcha Configuration

Two captcha providers are supported:

### Local Captcha (default)
Simple math challenge, no external service required.

```dotenv
CAPTCHA_PROVIDER=local
LOCAL_CAPTCHA_SECRET=replace-with-a-strong-random-secret
```

### Cloudflare Turnstile
```dotenv
CAPTCHA_PROVIDER=turnstile
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-site-key
TURNSTILE_SECRET_KEY=your-secret-key
```

---

## Exchange Rates

The platform supports automatic currency conversion for deposits, withdrawals, and expenses.

### Setup
```dotenv
OPENXCHANGE_API_KEY=your-openexchangerates-app-id
CRON_SECRET=your-random-long-secret
```

### How it works
- Hourly cron syncs rates from Open Exchange Rates
- Rates stored in `system/exchange_rates` Firestore document
- Cron endpoint: `POST /api/cron/exchange-rates` (secured with `Authorization: Bearer <CRON_SECRET>`)

### Manual test
```bash
curl -X POST http://localhost:9002/api/cron/exchange-rates \
    -H "Authorization: Bearer $CRON_SECRET"
```

---

## Email (Zeptomail)

Transactional emails are sent via Zeptomail for:
- Deposit approvals
- Withdrawal status changes
- Account approval/rejection
- Plan/package changes
- Partner application outcomes

All sent emails are logged to a Firestore `email_logs` collection and viewable in the Admin Panel → Email Logs.

```dotenv
ZEPTOMAIL_API_KEY=your-zeptomail-api-key
```

**To test:** Admin Settings → Email & Notification Settings → Send Test Email.

---

## AI Models

Configure AI providers and default models in the Admin Panel under **AI Model Settings**. Supports any OpenAI-compatible provider:

1. Add a provider (name, base URL, API key)
2. Set supported modalities (text, image, video, audio)
3. Click **Discover Models** to auto-detect available models
4. Choose default models per modality
5. Click **Test** to verify each model works

Models can also be configured via environment variables:
```dotenv
OPENAI_COMPATIBLE_BASE_URL=https://api.openai.com/v1
OPENAI_COMPATIBLE_API_KEY=sk-...
```

The AI flow system uses Genkit's plugin architecture with:
- Custom flow definitions in `src/ai/flows/`
- Model routing by modality and model ID
- Fallback chain: admin-saved provider → environment variable → static model list

---

## Deployment

### Vercel
```bash
npm run build
vercel --prod
```

### Firebase App Hosting
Configure via `apphosting.yaml` in the project root. Environment variables are managed through the Firebase Console or Vercel dashboard.

### Firestore Security Rules
Deploy rules from `firestore.rules`:
```bash
firebase deploy --only firestore:rules
```

### Storage Rules
Deploy rules from `storage.rules`:
```bash
firebase deploy --only storage:rules
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run `npm run typecheck` to verify types
5. Run `npm run lint` to check code style
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

---

## License

This project is private and proprietary. Unauthorized copying, distribution, or use is prohibited.