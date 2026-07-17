# TaskFlow — Mobile (Expo / React Native)

The iPhone app (issue #7); Android comes from the same Expo codebase (#8). It
talks to the **same Supabase backend** as the web app, so auth, RLS, and data are
shared.

## What's here

Near feature-parity with the web app:

- **Auth** — email/password (Supabase Auth), session persisted via AsyncStorage.
- **List** — tasks grouped by section, inline add, tap-to-complete, subtasks shown
  indented, project filter chips, completed toggle, add section / add project.
- **Board** — horizontally scrollable columns per section.
- **Calendar** — month grid with due-date chips; tap a chip to open the task.
- **Task detail** — edit name/description, due date (native date picker), priority,
  section, recurrence, project links, assignee (restricted to collaborators),
  subtasks with due dates, comments, delete.
- **Settings** — manage collaborators by email, configure Pomodoro durations, sign out.
- **Notifications** — list with unread badge and mark-all-read.
- **Realtime** — the whole workspace re-syncs on Supabase Realtime changes.

Architecture mirrors the web app: a `WorkspaceProvider` store (`lib/store.tsx`)
holds all data + mutations and derives `connectedProfiles` so pickers only show
collaborators; screens live in `screens/`, shared UI in `components/`.

## Run it

```bash
cd mobile
npm install
npx expo install           # aligns native package versions to the Expo SDK
cp .env.example .env        # fill in EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY
npx expo start             # press i for iOS simulator, a for Android
```

> The pinned versions in `package.json` are a starting point — `npx expo install`
> reconciles them with the installed Expo SDK.

Type-check without a simulator: `npm run typecheck`.

## Still to do

- **Drag-to-reorder / drag-to-reschedule** (web has it; mobile edits via the detail
  screen for now).
- **Apple In-App Purchase via RevenueCat** (#23) for subscriptions; the web billing
  routes and the RevenueCat webhook already exist.
- **Expo push notifications** for reminders/mentions.
- Android build + Play Store track (#8).
