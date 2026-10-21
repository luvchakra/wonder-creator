# Careers (owner, 21 Oct 2026)

Public pages that show our open jobs and take applications. **WonderJobs** (https://jobs.wonderapps.biz) runs
everything behind them: the jobs, storing applications, the emails to the applicant and the hiring team, reminders,
decisions and deletion. This app only displays its data and forwards what an applicant submits. **It stores no applicant
data.**

## Pages (public, no sign-in)

| Address | What it shows |
|---|---|
| `/careers` | The open jobs linked to this career site (title, location, work mode, type, pay when given, skills), each linking to its page. No jobs → "No open positions right now". No key → "Careers isn't set up yet" (administrators see why). Unreachable → "unavailable", with Try again. Never sample jobs. |
| `/careers/{id}` | The description (plain text, rendered as text), Share, the Apply form, schema.org `JobPosting` JSON-LD. A closed position → "This position is no longer open" + back to `/careers`. |
| `/careers/status?t={token}` | The link in the applicant's email: job, company, status, applied and last update; Withdraw (confirmed) when allowed. `noindex`, `Referrer-Policy: no-referrer` (meta and header), disallowed in robots.txt. |

Register `https://<this app's domain>/careers` in WonderJobs (Hiring › Jobs › Career sites › Add a career site › "On
our own website" › Careers page address); WonderJobs builds its email links from it.

## The connection (server only)

- `apps/web/src/lib/careers/client.ts`: the WonderJobs client (plain, unit-tested with a mocked fetch).
  `wonderjobs.ts` (`server-only`) wires it to the key and is all pages and routes import; the server-only boundary test
  keeps it out of client code.
- Host fixed at `https://jobs.wonderapps.biz`; `WONDERJOBS_CAREERS_URL` overrides only for `https://*.wonderapps.biz`.
- Key `wjcs_…`, sent only as `Authorization: Bearer` from the server. Saved by a **platform administrator** in **Settings
  › Careers** (`/settings/careers`): stored in Supabase Vault (`careers_connection`, migration …096, service role only),
  shown back only as `wjcs_••••••••abcd`, every save and clear audited (`admin.careers_key_saved` /
  `admin.careers_key_cleared`, who and when, last four only). `WONDERJOBS_CAREERS_KEY` is the fallback when none is saved.
  **Test connection** reports Connected (with the job count), Wrong key (401) or Unavailable.
- Platform administrators are `WONDERCREATOR_PLATFORM_ADMIN_EMAILS` (comma-separated sign-in emails; nobody when unset).
  Anyone else gets "not found" from the page and the API.
- 8 s timeout; a GET is retried once after a network error or a 5xx, a POST never; 429 → "busy, try again shortly" with
  its Retry-After. Responses are `no-store`; the job list and the key are kept in memory for up to 60 s; never the
  status or anything about an applicant.
- Logs: only the job id, the status and the time taken. Never an application, an email, a token or the key.

## Apply and status (this app's own routes)

- `POST /api/v1/careers/jobs/{id}/applications`: validated here (trimmed, limits, https links, consent), a hidden
  `website` honeypot (filled → told it worked, never forwarded), about 10 an hour per address, then forwarded. "Sent" only
  after WonderJobs' 200; its 400/409 words shown as they are.
- `POST /api/v1/careers/status` `{ token, action: "view" | "withdraw" }`: the token travels in bodies only.
- Both are public and keep `withApi`'s cross-site POST protection. The CSP is unchanged: the browser never calls WonderJobs.
