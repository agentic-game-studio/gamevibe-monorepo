# GameVibe AI Deployment Guide

This guide covers deploying GameVibe AI components to production.

## Prerequisites

- Docker and Docker Compose installed
- A domain name for the web runtime
- Discord application configured with Activities enabled
- PostgreSQL database (or use the containerized one)
- Redis instance (or use the containerized one)

## Web Runtime Deployment

The web runtime needs to be publicly accessible for Discord Activities to work.

### Option 1: Deploy with Docker

1. Build the web runtime image:
```bash
docker build -f packages/web-runtime/Dockerfile -t gamevibe-web .
```

2. Run the container:
```bash
docker run -d \
  --name gamevibe-web \
  -p 80:80 \
  -e VITE_DISCORD_CLIENT_ID=your_client_id \
  -e VITE_API_BASE_URL=https://your-api-domain.com \
  gamevibe-web
```

### Option 2: Deploy to Cloud Providers

#### Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy from the web-runtime directory:
```bash
cd packages/web-runtime
vercel --prod
```

3. Set environment variables in Vercel dashboard:
   - `VITE_DISCORD_CLIENT_ID`
   - `VITE_API_BASE_URL`

#### Netlify

1. Install Netlify CLI:
```bash
npm i -g netlify-cli
```

2. Build and deploy:
```bash
cd packages/web-runtime
pnpm build
netlify deploy --prod --dir=dist
```

#### Railway

1. Create a new Railway project
2. Connect your GitHub repository
3. Set the root directory to `packages/web-runtime`
4. Add environment variables
5. Deploy

### Option 3: Deploy to VPS

1. Set up Nginx on your VPS
2. Build the web runtime locally:
```bash
cd packages/web-runtime
pnpm build
```

3. Upload the `dist` folder to your VPS
4. Configure Nginx using the provided `nginx.conf`

## Multiplayer Server Deployment

The multiplayer server needs to be accessible via WebSocket for real-time game sessions.

### Docker Deployment

1. Build the multiplayer server image:
```bash
docker build -f packages/multiplayer-server/Dockerfile -t gamevibe-multiplayer .
```

2. Run the container:
```bash
docker run -d \
  --name gamevibe-multiplayer \
  -p 2567:2567 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e REDIS_URL=redis://host:6379 \
  -e JWT_SECRET=your-secret-key \
  gamevibe-multiplayer
```

### Cloud Deployment

For production, deploy the multiplayer server to a service that supports WebSocket connections:

- **AWS ECS/Fargate**: Supports WebSocket via Application Load Balancer
- **Google Cloud Run**: WebSocket support available
- **Railway/Render**: Built-in WebSocket support
- **VPS**: Deploy with Docker and configure firewall for port 2567

### WebSocket Proxy Configuration

If using a reverse proxy, ensure WebSocket support is enabled:

```nginx
location /multiplayer {
    proxy_pass http://localhost:2567;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## Bot Deployment

### With Docker Compose (Recommended)

1. Update `.env` with production values:
```env
# Update these values
WEB_RUNTIME_URL=https://your-web-runtime-domain.com
DATABASE_URL=postgresql://user:pass@host:5432/gamevibe
REDIS_URL=redis://your-redis-host:6379
```

2. Deploy using Docker Compose:
```bash
docker-compose up -d gamevibe-bot gamevibe-web gamevibe-multiplayer postgres redis jaeger
```

### Kubernetes Deployment

See `k8s/` directory for Kubernetes manifests (coming soon).

## Discord Activity Configuration

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Navigate to "Activities" section
4. Enable "Activities" for your application
5. Set the Activity URL to your deployed web runtime URL
6. Configure OAuth2 redirect URLs
7. Save changes

## Environment Variables

### Bot Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DISCORD_TOKEN | Bot token from Discord | Yes |
| DISCORD_CLIENT_ID | Application client ID | Yes |
| DISCORD_PUBLIC_KEY | Application public key | Yes |
| DATABASE_URL | PostgreSQL connection string | Yes |
| REDIS_URL | Redis connection string | Yes |
| ANTHROPIC_API_KEY | Claude API key | Yes |
| OPENAI_API_KEY | OpenAI API key | Yes |
| WEB_RUNTIME_URL | Public URL of web runtime | Yes |
| MULTIPLAYER_URL | WebSocket URL for multiplayer | Yes |
| JWT_SECRET | Secret for multiplayer auth | Yes |

### Web Runtime Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| VITE_DISCORD_CLIENT_ID | Discord application client ID | Yes |
| VITE_API_BASE_URL | Bot API URL | Yes |
| VITE_MULTIPLAYER_URL | Multiplayer WebSocket URL | Yes |

## SSL/TLS Configuration

For production, ensure both the bot API and web runtime are served over HTTPS:

1. Use a reverse proxy like Nginx or Caddy
2. Obtain SSL certificates using Let's Encrypt
3. Configure your domain's DNS records

Example Nginx configuration for SSL:
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Monitoring

Access monitoring tools:
- Jaeger UI: http://your-domain:16686
- Bot health: http://your-domain:8081/health/ready
- Web runtime health: http://your-domain:3001/health
- Multiplayer health: http://your-domain:2567/health

## Troubleshooting

### Discord Activities Not Loading

1. Verify web runtime is publicly accessible
2. Check Discord application settings
3. Ensure CORS headers are properly configured
4. Check browser console for errors

### Bot Not Responding

1. Check bot logs: `docker logs gamevibe-bot`
2. Verify Discord token is valid
3. Check database connectivity
4. Ensure Redis is running

### Game Generation Failing

1. Verify AI API keys are valid
2. Check API rate limits
3. Review error logs
4. Ensure sufficient system resources

### Multiplayer Connection Issues

1. Check WebSocket connectivity: `wscat -c ws://your-domain:2567`
2. Verify JWT_SECRET matches between bot and multiplayer server
3. Check firewall allows port 2567 (or configured port)
4. Review multiplayer server logs: `docker logs gamevibe-multiplayer`
5. Ensure Redis is accessible from multiplayer server