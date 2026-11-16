# Focus Room

A visual prototype for a future work-timer: one task, one small room. The scene is an isometric 3×3 floor and a cube on a monochrome CRT. A small panel tracks task time. Signed-in time is stored in Supabase; signed-out time stays in this browser until you move it.

Scroll or pinch to move closer and farther.

## Run locally

```bash
npm install
npm run dev
```

The dev server uses the GitHub Pages base path, so open the `/focus-room/` URL Vite prints.

## Stack

Vite, React, TypeScript, Three.js, React Three Fiber, Drei, React Three Postprocessing, and Supabase.

## Timer setup

Login is a display name plus a 4-digit PIN. The app turns that into a Supabase email and password so each person only sees their own rows.

1. In the Supabase SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql).
2. Authentication → Sign In / Providers → Email: turn **Confirm email** off.

Until the SQL has been run, the panel still times tasks in this browser. After login, **기록 옮기기** uploads those records.

## Deploy

The site is published by the **Deploy GitHub Pages** workflow on every push to `main`.

Live URL: https://jaemin0826.github.io/focus-room/

In the repository settings, **Pages → Build and deployment → Source** must be **GitHub Actions**.
