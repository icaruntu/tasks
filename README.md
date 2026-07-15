# TaskFlow

Simple, shareable task management with projects, Pomodoro, due-date reminders, and
list / board / calendar views. Web-first (Next.js on Vercel + Supabase), architected
so the same Supabase backend can power the planned iPhone (then Android) apps.

## Features

- **Sections & tasks** — create your own sections; tick the circle on the left of a
  task to complete it; inline quick-add.
- **Task detail** — assignee, due date, section, project(s), priority (high / medium /
  low), description, subtasks, attachments, and comments with `@mentions`.
- **Projects & sharing** — group tasks into projects and share them with other users
  (owner / editor / viewer roles) via row-level security.
- **Views** — List, Board (Kanban by section), and Calendar (month grid by due date).
- **Filters** — completion (incomplete default / complete / all), due date (before
  today, today, tomorrow, this week, next week, within 14 days), and priority.
- **Search** — instant search across task names and descriptions.
- **Drag & drop** — reorder tasks within a section and move them between sections /
  board columns.
- **Pomodoro** — a focus timer (25/5/15) you can pin to any task; completed focus
  sessions are logged.
- **Reminders & daily email** — notification triggers fire on assignment, mention, and
  comment; a scheduled Edge Function emails each person their actionable tasks each
  morning (owner **and** the responsible assignee are both notified).

## Stack

| Layer     | Choice                                             |
| --------- | -------------------------------------------------- |
| Framework | Next.js 15 (App Router) + React 19 + TypeScript    |
| Styling   | Tailwind CSS v4 (light/dark, system fonts)         |
| Backend   | Supabase (Postgres + Auth + Storage + Edge Funcs)  |
| DnD       | `@dnd-kit`                                          |
| Dates     | `date-fns`                                          |
| Hosting   | Vercel                                             |

## Getting started (local)

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable                        | Where                             |
| ------------------------------- | --------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |

## Database

The full schema (tables, RLS policies, storage bucket, and notification triggers)
lives in [`supabase/migrations/0001_initial_schema.sql`](supabase/migrations/0001_initial_schema.sql).

- Apply with the Supabase CLI (`supabase db push`) or paste it into the SQL editor.
- Regenerate types after changes: `supabase gen types typescript --linked > src/lib/database.types.ts`.

**Access model (RLS):** a task is visible to its creator, its assignee, and any member
of a project it belongs to. `SECURITY DEFINER` helper functions (`can_access_task`,
`is_project_member`) keep the policies non-recursive.

### Auth

Email + password is enabled out of the box. For instant sign-up without SMTP, turn off
**Authentication → Sign In / Providers → Confirm email** in the Supabase dashboard, or
configure an SMTP provider so confirmation emails are delivered. Add your deployed URL
to **Authentication → URL Configuration** (Site URL + redirect allow-list) so magic
links and confirmations point back to production.

### Daily digest / reminders

[`supabase/functions/daily-digest`](supabase/functions/daily-digest/index.ts) emails
each user their overdue + due-today tasks and records reminder notifications.

```bash
supabase functions deploy daily-digest
supabase secrets set RESEND_API_KEY=... DIGEST_FROM="TaskFlow <tasks@yourdomain.com>" APP_URL=https://your-app.vercel.app
# then schedule it daily (Dashboard → Edge Functions → Schedules, or pg_cron)
```

Without `RESEND_API_KEY` the function runs in dry-run mode and just logs recipients.

## Deploy to Vercel

1. Import the repo into Vercel.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment
   variables.
3. Deploy. The middleware guards every route and refreshes the Supabase session.

## Project structure

```
src/
  app/
    (app)/            authenticated area (list, board, calendar) + shared layout
    login/            auth screen + server actions
    auth/callback/    magic-link / OAuth code exchange
  middleware.ts       session refresh + route guard
  components/         providers, app shell, task detail, views, UI atoms
  lib/
    supabase/         browser / server / middleware clients
    database.types.ts generated types
    types.ts          domain types, priority + filter definitions
    dates.ts          due-date filter logic
    filter.ts         task filtering + sorting
supabase/
  migrations/         SQL schema
  functions/          Edge Functions (daily-digest)
```

## Roadmap

- **iPhone app** (Expo / React Native) reusing the Supabase client + shared domain
  types, then Android.
- Realtime sync (Supabase Realtime) so shared projects update live.
- Recurring tasks and calendar drag-to-reschedule.
- In-app notification center (data model + triggers already in place).
