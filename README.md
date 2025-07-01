# Firebase Studio

This is a NextJS starter in Firebase Studio.

## Getting Started

To run the application locally and connect to Firebase services, you'll need to configure your environment variables.

1.  **Create a Firebase Project**: If you don't have one already, create a new project at [https://console.firebase.google.com/](https://console.firebase.google.com/).
2.  **Get Firebase Credentials**: In your Firebase project, go to **Project Settings** (the gear icon) > **General**. Under "Your apps", select your web app (or create one). In the app's settings, find the "Firebase SDK snippet" and choose the "Config" option. This will show you your project's credentials.
3.  **Set Up Environment File**:
    *   Create a new file in the root of the project named `.env`.
    *   Copy the contents from `.env.example` into your new `.env` file.
    *   Paste your Firebase credentials into the corresponding variables in the `.env` file.

Now you can run the app:

```bash
npm run dev
```

To get started with development, take a look at `src/app/page.tsx`.
