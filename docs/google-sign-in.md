# Google sign-in — setup

"Continue with Google" is on the sign-in and sign-up pages **as soon as Google is enabled in Supabase**. The app reads
`/auth/v1/settings` (cached 5 minutes) and hides the button otherwise, so it never shows a broken button.

Production: app `https://wonder-creator.vercel.app`, Supabase project `dgyjzyyhayctcdrpgyji`.

## 1. Google Cloud Console (console.cloud.google.com)
1. Create or choose a project → **Google Auth Platform** (OAuth consent screen).
   - Branding: app name *Wonder Creator*, support email, logo (optional — needs Google review), app home page
     `https://wonder-creator.vercel.app`, privacy policy `https://wonder-creator.vercel.app/legal/privacy`, terms
     `https://wonder-creator.vercel.app/legal/terms`.
   - Authorised domains: Google usually won't accept a shared `*.vercel.app` address. Until you have your own domain,
     leave the home/privacy/terms links and logo empty — sign-in with the basic scopes below still works; add them
     (and the domain) once you have one.
   - Audience: **External**. Data access / scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
     (non-sensitive — no Google verification needed for these).
   - **Publish the app** ("In production"). While it's "Testing", only listed test users can sign in.
2. **Clients → Create client → Web application**:
   - Authorised JavaScript origins: `https://wonder-creator.vercel.app`
   - Authorised redirect URIs: `https://dgyjzyyhayctcdrpgyji.supabase.co/auth/v1/callback`
   - Copy the **Client ID** and **Client secret**.

## 2. Supabase dashboard (project dgyjzyyhayctcdrpgyji)
1. **Authentication → Sign In / Providers → Google**: enable, paste Client ID and Client secret, save.
   (Leave "Skip nonce check" off.)
2. **Authentication → URL Configuration**:
   - Site URL: `https://wonder-creator.vercel.app`
   - Redirect URLs: `https://wonder-creator.vercel.app/auth/callback` (add `https://*-<team>.vercel.app/auth/callback`
     too if you want Google sign-in on preview deployments).
3. Recommended: **Authentication → Sign In / Providers → Email → Confirm email: on** (accounts with the same verified
   email are then linked safely: someone who signed up with email can later "Continue with Google").

Nothing is needed in Vercel — no new environment variables.

## 3. Check it
Open `https://wonder-creator.vercel.app/sign-in` (a private window; allow up to 5 minutes after enabling) →
**Continue with Google** → pick an account → a new account sees *Before you begin* (Terms, Privacy, 18+) → onboarding.
Existing accounts with two-step verification are asked for their code after Google.

## Notes
- Custom domain: Google shows "to continue to dgyjzyyhayctcdrpgyji.supabase.co" on its account chooser. To show your
  own domain, use a Supabase custom domain (paid add-on) and update the redirect URI in step 1.2.
- Local development: Google is off in `supabase/config.toml`. To try it locally, create a second OAuth client with
  origin `http://localhost:3000` and redirect `http://127.0.0.1:54321/auth/v1/callback`, set `enabled = true`, export
  `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`, and restart Supabase.
- Privacy: Google acts as an independent controller for your Google account; we receive only name, email and profile
  picture (`/legal/privacy`).
