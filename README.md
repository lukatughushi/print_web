# printweb

Custom print-on-demand platform.

```
printweb/
├── frontend/             # React + Vite → Vercel (Root Directory: frontend)
│   ├── vercel.json       # build, SPA rewrites, cache headers, skip-if-unchanged
│   └── .env.example      # VITE_API_URL
├── backend/              # NestJS + MongoDB Atlas → Render (rootDir: backend)
│   └── .env.example      # MONGODB_URI, JWT_SECRET, CORS_ORIGINS, …
├── legacy/server/        # old Express + Prisma API, kept for reference while porting
├── render.yaml           # Render blueprint (must live at the repo root)
└── package.json          # dev helpers only (concurrently); not a deploy target
```

`frontend/` and `backend/` are independent npm packages with their own lockfiles, so each
platform installs and builds only its own folder. Node ≥ 22.12 everywhere (`engines`).

## Local development

```bash
npm install            # root: installs concurrently
npm run install:all    # installs backend + frontend
cp backend/.env.example backend/.env   # fill in MONGODB_URI and JWT_SECRET
cp frontend/.env.example frontend/.env # defaults to http://localhost:3000
npm run seed           # admin@example.com / Admin123!, user@example.com / User1234!
npm run dev            # API on :3000/api, web on :5173
```

## Backend API (`/api`)

| Method | Path | Access |
| --- | --- | --- |
| POST | `/auth/register`, `/auth/login` | public → `{ accessToken, user }` |
| GET | `/users/me` | JWT |
| GET | `/users` | admin |
| GET | `/products`, `/products/:id` | public |
| POST / PATCH / DELETE | `/products[/:id]` | admin (broadcasts `product:*` over Socket.IO) |
| POST | `/files` (multipart field `file`) | JWT, stored in GridFS |
| GET | `/files/:id` | public |
| DELETE | `/files/:id` | owner or admin |
| GET | `/health` | public (Render health check) |

Routes require a JWT by default; mark exceptions with `@Public()` and restrict with `@Roles(Role.Admin)`.
Socket.IO runs on the same port — connect with `io(API_ORIGIN, { auth: { token } })`.

## Deployment

**Render (backend):** New → Blueprint → select this repo (uses `render.yaml`). Set `MONGODB_URI` and
`CORS_ORIGINS=https://<your-app>.vercel.app`; optionally `VERCEL_PREVIEW_PROJECT=<your-app>` to allow
preview URLs. In MongoDB Atlas → Network Access, allow `0.0.0.0/0`. Seed once from the Render shell:
`npm run seed:prod`.

Because the service's `rootDir` is `backend`, commits that only touch `frontend/` don't redeploy it.

**Vercel (frontend):** import the repo with Root Directory `frontend` (framework is detected from
`vercel.json`), and set `VITE_API_URL=https://<your-service>.onrender.com` (origin only — request paths
already start with `/api`; it's inlined at build time, so redeploy after changing it).
`frontend/vercel.json` rewrites app routes to `index.html` so deep links work (`/assets` and `/models`
are served as files, with long-lived caching), and its `ignoreCommand` skips builds for commits that
don't touch `frontend/`.

**Git LFS:** the 3D models (`frontend/public/models/**/*.glb`) are stored in Git LFS (see
`.gitattributes`). After cloning, run `git lfs install && git lfs pull`. In Vercel, enable
Project → Settings → Git → **Git LFS**, otherwise builds ship LFS pointer files instead of the models
and the 3D viewer fails to load them. Add new models under `frontend/public/models/` and they're tracked
automatically.

Deploy order: Render first → copy its URL into Vercel's `VITE_API_URL` → deploy Vercel → put the
Vercel URL into Render's `CORS_ORIGINS`.

## Frontend auth

- `src/lib/api.js` — the single Axios client: attaches the JWT, and on a 401 clears it and signs the user out.
- `src/context/AuthProvider.jsx` + `useAuth()` — `user`, `isAdmin`, `login`, `register`, `logout`; restores the session on load.
- `src/components/ProtectedRoute.jsx` — `<Route element={<ProtectedRoute roles={['admin']} redirectTo="/admin/login" />}>`.
- Tailwind v4 is loaded without Preflight so existing CSS-module pages are unchanged; brand colors are
  available as `navy`, `coral`, `cream`, `ink`, `line` (see `@theme` in `src/index.css`).
