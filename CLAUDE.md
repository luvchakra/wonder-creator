@AGENTS.md

# wonder-creator

Next.js 16 (App Router, TypeScript, Tailwind CSS v4) with Supabase, deployed on Vercel.

## Commands

- `npm run dev`: start the dev server on http://localhost:3000
- `npm run lint`: ESLint
- `npm run typecheck`: `tsc --noEmit`
- `npm run build`: production build

CI (`.github/workflows/ci.yml`) runs lint, typecheck and build on pushes to `main` and on PRs. Run all three before pushing.

## Layout

- `src/app/`: routes (App Router)
- `src/lib/supabase/client.ts`: Supabase client for Client Components
- `src/lib/supabase/server.ts`: Supabase client for Server Components, Server Functions and Route Handlers (create one per request)
- `src/lib/supabase/proxy.ts` + `src/proxy.ts`: refreshes the auth session on each request. Next.js 16 renamed `middleware.ts` to `proxy.ts`.
- `@/*` maps to `src/*`

## Conventions

- Env vars: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (see `.env.example`). Never commit `.env.local` or a service-role/secret key.
- On the server, check identity with `supabase.auth.getClaims()` or `getUser()`, never `getSession()`.
- Enable Row Level Security on every new Supabase table.
