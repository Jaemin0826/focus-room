# Focus Room

A visual prototype for a future work-timer: one task, one small room. This build is only the scene — an isometric 3×3 floor, two low back walls, and a cube under a narrow spotlight, drawn as a monochrome dotted wireframe on a curved CRT. Shading is an ordered dither, so the cube’s lit and dark faces read as pixel patterns. There is no timer and no app logic yet.

Scroll or pinch to move closer and farther.

## Run locally

```bash
npm install
npm run dev
```

The dev server uses the GitHub Pages base path, so open the `/focus-room/` URL Vite prints.

## Stack

Vite, React, TypeScript, Three.js, React Three Fiber, Drei, and React Three Postprocessing.

## Deploy

The site is published by the **Deploy GitHub Pages** workflow on every push to `main`.

Live URL: https://jaemin0826.github.io/focus-room/

In the repository settings, **Pages → Build and deployment → Source** must be **GitHub Actions**.
