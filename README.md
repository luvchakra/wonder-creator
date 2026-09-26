# wonder-creator

Next.js 16 + Supabase app, ready to deploy on Vercel.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL and publishable key
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |

## Supabase

- Browser: `import { createClient } from "@/lib/supabase/client"`
- Server: `const supabase = await createClient()` from `@/lib/supabase/server`

`src/proxy.ts` keeps the auth session fresh on every request.

## Deploying

Import the repo in Vercel and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the project's environment variables.
