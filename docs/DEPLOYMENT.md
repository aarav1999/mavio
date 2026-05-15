# Deployment Guide — Vercel

## Pre-flight checklist

- [ ] All tests pass: `cd frontend && npm test`
- [ ] Production build succeeds: `cd frontend && npm run build`
- [ ] `.gitignore` covers `.env.local`, `node_modules`, `.next` (yes — already at repo root)
- [ ] **Rotate any credentials that were ever pasted in chat or screenshots** (Google OAuth secret, Groq key, DB password)

---

## Step 1 — Push to GitHub

```bash
# from repo root
git init
git add .
git commit -m "Initial commit — Mavio AI email client"

# create empty repo on github.com, then:
git remote add origin https://github.com/<you>/<repo>.git
git branch -M main
git push -u origin main
```

---

## Step 2 — Create Vercel project

1. Go to https://vercel.com → **Add New** → **Project**
2. Import the GitHub repo
3. **Root Directory** → set to `frontend` (important — the Next.js app is in a subfolder)
4. **Framework Preset** → Next.js (auto-detected)
5. Leave build commands at default (`vercel.json` already overrides them)

---

## Step 3 — Add environment variables in Vercel

Copy from your `.env.local`, but **set `NEXTAUTH_URL` to your Vercel URL**:

| Key | Value |
|---|---|
| `NEXTAUTH_URL` | `https://<your-project>.vercel.app` |
| `NEXTAUTH_SECRET` | output of `openssl rand -base64 32` (new secret for prod) |
| `GOOGLE_CLIENT_ID` | from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | from Google Cloud Console |
| `GROQ_API_KEY` | from console.groq.com |
| `DATABASE_URL` | Neon connection string |
| `DIRECT_URL` | Neon connection string (same or pooled variant) |
| `NEXT_PUBLIC_APP_URL` | `https://<your-project>.vercel.app` |

---

## Step 4 — Update Google OAuth Console

Go to https://console.cloud.google.com → **APIs & Services** → **Credentials** → your OAuth 2.0 Client.

**Authorized JavaScript origins** — add:
```
https://<your-project>.vercel.app
```

**Authorized redirect URIs** — add:
```
https://<your-project>.vercel.app/api/auth/callback/google
```

Save. Wait ~30 seconds for Google to propagate.

---

## Step 5 — Deploy

In Vercel, click **Deploy**. First build takes ~2 min.

After deploy:
1. Open the Vercel URL
2. Click **Continue with Google** → consent screen → land on `/inbox`
3. Verify inbox loads, click an email, click **Generate** in AI panel — summary should appear in under 1 s

---

## Step 6 — Update the README

Add your live URL to the top of `README.md`:

```md
> **Live demo:** https://<your-project>.vercel.app
```

Commit and push. Vercel auto-redeploys.

---

## Troubleshooting

**"Invalid Credentials" 401 on /api/emails**
The OAuth token expired and refresh failed. Sign out (`/api/auth/signout`) and sign back in.

**"Configuration" or "Callback" error on sign in**
Google redirect URI mismatch. Re-check Step 4 — the URI must exactly match `https://<your-project>.vercel.app/api/auth/callback/google` with no trailing slash.

**AI features rate-limited**
Groq free tier is 14,400 req/day. If hit, wait or rotate to a second Groq account.

**Build fails on Prisma**
Vercel's build command must run `prisma generate` first. The `vercel.json` already does this.
