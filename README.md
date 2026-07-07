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

### Firebase Admin Credentials (Required for secure server endpoints)

This project uses secure server-side endpoints that verify Firebase ID tokens and perform trusted Firestore writes. For that, you must also configure Firebase Admin SDK credentials.

1. In Firebase Console, open your project.
2. Go to **Project Settings** > **Service accounts**.
3. Click **Generate new private key** and download the JSON file.
4. Map values from that JSON to your `.env` file:
   * `FIREBASE_ADMIN_PROJECT_ID` = `project_id`
   * `FIREBASE_ADMIN_CLIENT_EMAIL` = `client_email`
   * `FIREBASE_ADMIN_PRIVATE_KEY` = `private_key`

Use this format in `.env`:

```dotenv
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Important:
* Do not use `NEXT_PUBLIC_` for admin credentials.
* Keep admin credentials server-only.
* In `.env` files, preserve newlines in `FIREBASE_ADMIN_PRIVATE_KEY` as `\n`.

Now you can run the app:

```bash
npm run dev
```

To get started with development, take a look at `src/app/page.tsx`.
