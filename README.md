# NagarSetu

An AI-powered civic complaint management platform for Haldwani-Kathgodam
Municipal Corporation, Uttarakhand. Built with React 18, Vite, and Tailwind CSS 4.

## Getting started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

## Other scripts

```bash
npm run build     # production build into dist/
npm run preview   # preview the production build locally
```

## Demo credentials

The login forms are wired to hardcoded demo accounts (no backend yet):

- **Citizen** &mdash; `citizen@nagarsetu.in` / `citizen123`
- **Administrator** &mdash; `admin@nagarsetu.in` / `admin123`

## Project structure

```
index.html
src/
  main.jsx          entry point
  App.jsx            top-level view switcher (entry / citizen / admin)
  index.css          Tailwind import, fonts, global styles/animations
  components/
    PortalEntry.jsx     landing page (citizen/admin entry points)
    LoginPanel.jsx       login modal
    RegisterPanel.jsx    citizen registration drawer
    UserPortal.jsx       citizen dashboard shell (sidebar + content)
    UserDashboard.jsx    citizen dashboard content
    AdminPortal.jsx      administrator dashboard shell + content
```

## Notes

- Tailwind CSS 4 is wired up via `@tailwindcss/vite` — no `tailwind.config.js`
  or `postcss.config.js` needed.
- Fonts (Inter + Fraunces) load via the `@import` at the top of `src/index.css`.
- The sidebar in `UserPortal.jsx` / `AdminPortal.jsx` is a full off-canvas
  drawer below the `lg` breakpoint and persistent above it — don't remove the
  `lg:translate-x-0` / `lg:ml-72` pairing or content will end up hidden
  behind it again on smaller screens.
