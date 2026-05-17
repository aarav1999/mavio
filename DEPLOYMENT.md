# Deployment Guide

## Prerequisites

- GitHub account
- Vercel account
- Google Cloud Console project (for Gmail OAuth)
- Azure AD tenant (for Outlook OAuth)
- Neon Postgres project (for database)
- Groq API key
- Hugging Face API key

## Step 1: Push to GitHub

1. Initialize git repository (if not already done):
```bash
git init
git add .
git commit -m "Initial commit"
```

2. Create a new repository on GitHub
3. Add remote and push:
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

## Step 2: Configure Environment Variables

Copy the deployment environment variables template:
```bash
cp deployment/.env.example deployment/.env.production
```

Fill in the required environment variables:
- `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: From Google Cloud Console
- `AZURE_AD_CLIENT_ID` / `AZURE_AD_CLIENT_SECRET` / `AZURE_AD_TENANT_ID`: From Azure Portal
- `GROQ_API_KEY`: From https://console.groq.com/keys
- `HF_API_KEY`: From https://huggingface.co/settings/tokens
- `DATABASE_URL` / `DIRECT_URL`: From Neon project
- `ENCRYPTION_KEY`: Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Step 3: Deploy to Vercel

### Option A: Via Vercel Dashboard

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. **Important**: Set root directory to `frontend`
4. Add environment variables from Step 2
5. Click Deploy

### Option B: Via Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login:
```bash
vercel login
```

3. Deploy from the frontend directory:
```bash
cd frontend
vercel --prod
```

4. Follow the prompts to set environment variables

## Step 4: Configure OAuth Redirect URIs

After deployment, you'll get a Vercel URL (e.g., https://mavio.vercel.app)

### Google OAuth

1. Go to Google Cloud Console → OAuth 2.0 Client IDs
2. Add to Authorized redirect URIs:
   - `https://YOUR_VERCEL_URL/api/auth/callback/google`

### Azure AD

1. Go to Azure Portal → App registrations → Your app
2. Add to Redirect URIs:
   - `https://YOUR_VERCEL_URL/api/auth/callback/azure-ad`

## Step 5: Set NEXTAUTH_URL

In Vercel project settings:
1. Go to Settings → Environment Variables
2. Add `NEXTAUTH_URL` with value: `https://YOUR_VERCEL_URL`

## Step 6: Run Database Migrations

1. In Vercel, go to your project
2. Go to Settings → Environment Variables
3. Make sure `DATABASE_URL` and `DIRECT_URL` are set
4. Vercel will automatically run `prisma generate` during build
5. For initial schema push, you may need to run:
```bash
cd frontend
npx prisma db push
```

## Step 7: Verify Deployment

1. Visit your Vercel URL
2. Test Google OAuth login
3. Test Azure AD login
4. Test IMAP connection (if configured)
5. Test AI features
6. Test email operations (compose, reply, archive, delete)

## Troubleshooting

### Build Fails

- Check that all environment variables are set in Vercel
- Verify `DATABASE_URL` uses the pooler URL (recommended)
- Check that `ENCRYPTION_KEY` is a valid 32-byte hex string

### OAuth Fails

- Verify redirect URIs match exactly (no trailing slashes)
- Check that OAuth scopes are correct
- Ensure `NEXTAUTH_URL` is set to your Vercel URL

### Database Connection Fails

- Use the pooler URL for `DATABASE_URL`
- Use the direct URL for `DIRECT_URL`
- Verify Neon project is active

### AI Features Not Working

- Verify `GROQ_API_KEY` is valid
- Check quota limits (free tier: 14,400 requests/day)
- Verify `HF_API_KEY` is set for semantic search

## Production Checklist

- [ ] Repository pushed to GitHub
- [ ] Vercel project created (root: frontend)
- [ ] All environment variables configured
- [ ] OAuth redirect URIs updated
- [ ] `NEXTAUTH_URL` set
- [ ] Database schema pushed
- [ ] Google OAuth tested
- [ ] Azure AD OAuth tested
- [ ] IMAP connection tested (if applicable)
- [ ] AI features tested
- [ ] Email operations tested
- [ ] Mobile responsiveness verified
- [ ] PWA installable
