# Deployment Guide

## Railway Deployment

### 1. Create Railway Project

1. Go to [Railway](https://railway.app/)
2. Create new project
3. Connect GitHub repository

### 2. Configure Environment Variables

Add the following environment variables in Railway dashboard:

- `DATABASE_URL=file:/data/prod.db`
- `LINE_CHANNEL_SECRET=<your_value>`
- `LINE_CHANNEL_ACCESS_TOKEN=<your_value>`
- `GOOGLE_CLIENT_ID=<your_value>`
- `GOOGLE_CLIENT_SECRET=<your_value>`
- `GOOGLE_REDIRECT_URI=https://<your-app>.railway.app/auth/google/callback`
- `GEMINI_API_KEY=<your_value>`
- `ENCRYPTION_KEY=<generated_with_openssl_rand>`
- `NODE_ENV=production`

### 3. Setup Volume for SQLite

1. Go to your Railway service settings
2. Add a Volume
3. Mount path: `/data`
4. This will persist your SQLite database

### 4. Update LINE Webhook URL

1. Get your Railway deployment URL
2. Go to LINE Developers Console
3. Update Webhook URL to: `https://<your-app>.railway.app/webhook`
4. Enable webhook

### 5. Update Google OAuth Redirect URI

1. Go to Google Cloud Console
2. Add authorized redirect URI: `https://<your-app>.railway.app/auth/google/callback`

### 6. Deploy

Railway will automatically deploy on git push to main branch.

Check logs to verify deployment:
```bash
railway logs
```

### Testing Production

1. Send message to LINE bot
2. If unauthenticated, click auth link
3. Complete Google OAuth
4. Send schedule message
5. Verify extraction works
