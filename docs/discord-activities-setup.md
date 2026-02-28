# Discord Activities Setup Guide

This guide walks through setting up Discord Activities for GameVibe AI, allowing users to play generated games directly within Discord.

## Prerequisites

- Discord application with bot already configured
- Web runtime deployed to a publicly accessible URL
- Bot running with `WEB_RUNTIME_URL` configured

## Step 1: Deploy Web Runtime

The web runtime must be accessible from the internet for Discord Activities to work.

### Quick Deploy Options

#### Vercel (Recommended)
```bash
cd packages/web-runtime
npx vercel --prod
```

#### Netlify
```bash
cd packages/web-runtime
pnpm build
npx netlify deploy --prod --dir=dist
```

#### Docker + VPS
```bash
docker build -f packages/web-runtime/Dockerfile -t gamevibe-web .
docker run -d -p 80:80 gamevibe-web
```

## Step 2: Configure Discord Application

1. Visit [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Go to **OAuth2 > General**
4. Add your web runtime URL to **Redirects**:
   - `https://your-domain.com/auth/callback`

5. Go to **Activities**
6. Click **Enable Activities**
7. Set **Default Activity Launch URL**: `https://your-domain.com`
8. Save changes

## Step 3: Update Bot Configuration

Update your `.env` file:
```env
WEB_RUNTIME_URL=https://your-domain.com
```

Restart the bot to apply changes.

## Step 4: Test Discord Activities

1. Use `/create-game` to generate a game
2. Click the **Play Now** button
3. Discord will create an activity invite
4. Click the invite link to launch the game
5. The game opens in Discord's embedded browser

## Troubleshooting

### "Discord Activities are not yet configured"
- Ensure `WEB_RUNTIME_URL` is set in your `.env`
- Restart the bot after setting the URL

### Activity doesn't launch
- Verify web runtime is accessible: `curl https://your-domain.com/health`
- Check Discord application Activities settings
- Ensure the bot has permission to create invites

### Game doesn't load
- Check browser console for errors (F12)
- Verify `VITE_DISCORD_CLIENT_ID` matches your application
- Ensure CORS headers are configured properly

### "Can only be launched in server channels"
- Discord Activities require guild channels
- Cannot be launched in DMs or threads

## Development Tips

### Local Testing
For local development, you can use ngrok to expose your local web runtime:

```bash
# Start web runtime locally
pnpm --filter @gamevibe/web-runtime dev

# In another terminal, expose it with ngrok
ngrok http 3001

# Update WEB_RUNTIME_URL with the ngrok URL
WEB_RUNTIME_URL=https://your-subdomain.ngrok.io
```

### Debugging
Enable debug logging in the bot:
```env
LOG_LEVEL=debug
```

Check activity logs in Discord Developer Portal under your application.

## Security Considerations

1. **Authentication**: The web runtime validates Discord OAuth tokens
2. **CORS**: Configure allowed origins to prevent unauthorized access
3. **Rate Limiting**: Implement rate limits on game creation
4. **Content Security**: Validate and sanitize generated game code

## Next Steps

- Set up multiplayer support with Colyseus
- Implement leaderboards and achievements
- Add voice controls for accessibility
- Configure analytics and monitoring