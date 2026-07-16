# TaskFlow — Mobile (Expo)

Starting scaffold for the iPhone app (issue #7); Android comes from the same Expo
codebase (#8). It talks to the **same Supabase backend** as the web app, so auth,
RLS, and data are shared.

## What's here

- Email/password auth (Supabase Auth, session persisted with AsyncStorage).
- A task list (your incomplete top-level tasks), tap-to-complete, quick add.
- Realtime updates via Supabase Realtime.

This is intentionally minimal — a foundation to grow into full parity (task detail,
projects, sharing, pomodoro, push notifications).

## Run it

```bash
cd mobile
npm install
npx expo install           # aligns native package versions to the Expo SDK
cp .env.example .env        # fill in EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY
npx expo start             # press i for iOS simulator, a for Android
```

> The pinned versions in `package.json` are a starting point — `npx expo install`
> reconciles them with the installed Expo SDK. If you prefer, regenerate the shell
> with `npx create-expo-app` and drop in `App.tsx` + `lib/`.

## Roadmap (per the GitHub issues)

- Reuse the web app's domain types + filter logic via a shared package.
- Task detail, projects, board/calendar, pomodoro.
- **Apple In-App Purchase via RevenueCat** (#23) for subscriptions; Expo push for
  reminders/mentions.
- Android build + Play Store track (#8).
