# GameVibe Enterprise API

The GameVibe Enterprise API provides comprehensive access to GameVibe's game generation, analytics, and management capabilities for enterprise clients and third-party integrations.

## Features

- **🎮 Game Management**: Create, update, and manage games programmatically
- **📊 Advanced Analytics**: Comprehensive game and user analytics
- **🔐 API Key Authentication**: Secure authentication with tier-based permissions
- **⚡ Rate Limiting**: Intelligent rate limiting based on subscription tier
- **🔗 Webhooks**: Real-time event notifications
- **📚 OpenAPI Documentation**: Interactive API documentation
- **🔄 Bulk Operations**: Batch processing for enterprise workflows
- **🏆 Leaderboard Integration**: Access and manage game leaderboards
- **👥 User Management**: User analytics and management tools

## Getting Started

### 1. Contact Sales

To get started with the Enterprise API, contact our sales team:
- 📧 Email: enterprise@gamevibe.ai
- 🌐 Website: https://gamevibe.ai/enterprise
- 💬 Discord: https://discord.gg/gamevibe

### 2. Subscription Tiers

Choose the tier that matches your needs:

#### Starter ($99/month)
- **100 req/min, 1K req/hour, 10K req/day**
- Game management (read, create, update)
- Basic analytics
- Community leaderboards
- Email support

#### Pro ($299/month)  
- **500 req/min, 10K req/hour, 100K req/day**
- Everything in Starter
- User management
- Advanced analytics
- Custom webhooks
- Priority support

#### Enterprise ($999/month)
- **2K req/min, 50K req/hour, 1M req/day**
- Everything in Pro
- Bulk operations
- Custom integrations
- Dedicated support
- SLA guarantees

### 3. API Key Setup

Once your account is set up, you'll receive an API key:

```bash
# Set your API key as an environment variable
export GAMEVIBE_API_KEY="gv_your_api_key_here"
```

### 4. Base URL

All API requests should be made to:
```
https://api.gamevibe.ai/api/v1/enterprise
```

For development/testing:
```
http://localhost:8081/api/v1/enterprise
```

## Authentication

All API requests require authentication using an API key in the Authorization header:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://api.gamevibe.ai/api/v1/enterprise/status
```

## Quick Start Examples

### Check API Status

```bash
curl -H "Authorization: Bearer $GAMEVIBE_API_KEY" \
     https://api.gamevibe.ai/api/v1/enterprise/status
```

### Create a Game

```bash
curl -X POST \
     -H "Authorization: Bearer $GAMEVIBE_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "My Enterprise Game",
       "description": "A game created via API",
       "type": "platformer",
       "serverId": "your_discord_server_id"
     }' \
     https://api.gamevibe.ai/api/v1/enterprise/games
```

### List Games

```bash
curl -H "Authorization: Bearer $GAMEVIBE_API_KEY" \
     "https://api.gamevibe.ai/api/v1/enterprise/games?limit=10&offset=0"
```

### Get Analytics

```bash
curl -H "Authorization: Bearer $GAMEVIBE_API_KEY" \
     "https://api.gamevibe.ai/api/v1/enterprise/analytics/overview?timeframe=30d"
```

## API Documentation

### Interactive Documentation

Visit the interactive API documentation:
- **Local**: http://localhost:8081/api/v1/enterprise/docs
- **Production**: https://api.gamevibe.ai/api/v1/enterprise/docs

### OpenAPI Specification

Download the OpenAPI spec:
- **JSON**: http://localhost:8081/api/v1/enterprise/openapi.json
- **Postman Collection**: http://localhost:8081/api/v1/enterprise/docs/postman

## Main API Endpoints

### Game Management
- `GET /games` - List games
- `POST /games` - Create a new game
- `GET /games/{gameId}` - Get game details
- `PUT /games/{gameId}` - Update game
- `DELETE /games/{gameId}` - Delete game

### Analytics
- `GET /analytics/overview` - Organization analytics
- `GET /analytics/games/{gameId}` - Game-specific analytics
- `GET /analytics/real-time` - Real-time data
- `POST /analytics/events` - Track custom events

### Leaderboards
- `GET /leaderboards/{gameId}` - Get leaderboard
- `POST /leaderboards/{gameId}/scores` - Submit score
- `GET /leaderboards/{gameId}/stats` - Leaderboard statistics

### User Management (Pro+)
- `GET /users` - List users
- `GET /users/{userId}` - Get user details
- `GET /users/{userId}/games` - User's games
- `GET /users/{userId}/stats` - User statistics

### Webhooks (Pro+)
- `GET /webhooks` - List webhooks
- `POST /webhooks` - Create webhook
- `GET /webhooks/{webhookId}` - Get webhook
- `PUT /webhooks/{webhookId}` - Update webhook
- `DELETE /webhooks/{webhookId}` - Delete webhook

### Bulk Operations (Enterprise)
- `POST /bulk/games` - Bulk create games
- `PUT /bulk/games` - Bulk update games
- `POST /bulk/users/invite` - Bulk invite users
- `GET /bulk/analytics` - Bulk analytics export

## Rate Limiting

Rate limits are enforced per API key and vary by subscription tier:

### Response Headers
All responses include rate limit information:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### Exceeding Limits
When rate limits are exceeded, you'll receive a `429 Too Many Requests` response:
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60,
  "limits": {
    "requestsPerMinute": 100,
    "requestsPerHour": 1000,
    "requestsPerDay": 10000
  }
}
```

## Webhooks

Configure webhooks to receive real-time notifications about events.

### Available Events
- `game.created` - New game created
- `game.updated` - Game updated
- `game.deleted` - Game deleted
- `game.played` - Game played by user
- `user.registered` - New user registered
- `leaderboard.updated` - Leaderboard rankings changed
- `subscription.updated` - Subscription changes
- `analytics.milestone` - Analytics milestones reached

### Webhook Setup

```bash
curl -X POST \
     -H "Authorization: Bearer $GAMEVIBE_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "My Webhook",
       "url": "https://your-app.com/webhooks/gamevibe",
       "events": ["game.created", "game.played"],
       "headers": {
         "X-Custom-Header": "value"
       }
     }' \
     https://api.gamevibe.ai/api/v1/enterprise/webhooks
```

### Webhook Payload Example

```json
{
  "id": "evt_1234567890",
  "event": "game.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "game": {
      "id": "game_abc123",
      "name": "New Game",
      "type": "platformer",
      "creatorId": "user_xyz789",
      "serverId": "server_def456"
    }
  },
  "webhook": {
    "id": "webhook_123",
    "name": "My Webhook"
  }
}
```

### Webhook Security

Webhooks are signed with HMAC SHA256. Verify the signature:

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = 'sha256=' + 
    crypto.createHmac('sha256', secret).update(payload).digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Usage
const isValid = verifyWebhookSignature(
  requestBody,
  request.headers['x-gamevibe-signature'],
  webhookSecret
);
```

## Error Handling

The API uses standard HTTP status codes and returns errors in JSON format:

### Error Response Format
```json
{
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional error context"
  }
}
```

### Common Status Codes
- `400 Bad Request` - Invalid request format
- `401 Unauthorized` - Invalid or missing API key
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## SDKs and Libraries

### Node.js
```javascript
const GameVibeAPI = require('@gamevibe/enterprise-api');

const client = new GameVibeAPI({
  apiKey: process.env.GAMEVIBE_API_KEY,
  baseUrl: 'https://api.gamevibe.ai'
});

// Create a game
const game = await client.games.create({
  name: 'My Game',
  description: 'A fun game',
  type: 'platformer'
});

// Get analytics
const analytics = await client.analytics.overview({
  timeframe: '30d'
});
```

### Python
```python
import gamevibe

client = gamevibe.Client(
    api_key=os.environ['GAMEVIBE_API_KEY'],
    base_url='https://api.gamevibe.ai'
)

# Create a game
game = client.games.create(
    name='My Game',
    description='A fun game',
    type='platformer'
)

# Get analytics  
analytics = client.analytics.overview(timeframe='30d')
```

### cURL Examples Collection

Download our complete cURL examples collection:
```bash
curl -o gamevibe-api-examples.sh \
     https://api.gamevibe.ai/api/v1/enterprise/docs/examples.sh
chmod +x gamevibe-api-examples.sh
```

## Best Practices

### 1. Error Handling
Always implement proper error handling:
```javascript
try {
  const response = await fetch('/api/v1/enterprise/games', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`API Error: ${error.error}`);
  }
  
  const data = await response.json();
  return data;
} catch (error) {
  console.error('API request failed:', error);
  // Handle error appropriately
}
```

### 2. Rate Limit Handling
Implement exponential backoff for rate limits:
```javascript
async function apiRequestWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '60');
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      continue;
    }
    
    return response;
  }
  
  throw new Error('Max retries exceeded');
}
```

### 3. Webhook Reliability
Implement webhook endpoints with proper retry handling:
```javascript
app.post('/webhooks/gamevibe', (req, res) => {
  // Verify signature first
  if (!verifyWebhookSignature(req.body, req.headers['x-gamevibe-signature'], secret)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook asynchronously
  processWebhookAsync(req.body);
  
  // Respond quickly to avoid retries
  res.status(200).send('OK');
});
```

### 4. Pagination
Handle paginated responses properly:
```javascript
async function getAllGames() {
  const games = [];
  let offset = 0;
  const limit = 100;
  
  while (true) {
    const response = await api.get(`/games?limit=${limit}&offset=${offset}`);
    games.push(...response.games);
    
    if (!response.pagination.hasMore) break;
    offset += limit;
  }
  
  return games;
}
```

## Monitoring and Observability

### Health Checks
Monitor API health:
```bash
# API status
curl https://api.gamevibe.ai/api/v1/enterprise/status

# System health  
curl https://api.gamevibe.ai/health
```

### Metrics
Track your API usage:
- Request volume and patterns
- Error rates by endpoint
- Response times
- Rate limit utilization

### Logging
Enable debug logging for troubleshooting:
```javascript
const client = new GameVibeAPI({
  apiKey: process.env.GAMEVIBE_API_KEY,
  debug: true, // Enable debug logging
  timeout: 30000 // 30 second timeout
});
```

## Support

### Documentation
- **API Docs**: https://docs.gamevibe.ai/enterprise-api
- **Developer Portal**: https://developers.gamevibe.ai
- **Status Page**: https://status.gamevibe.ai

### Support Channels
- **Enterprise Support**: enterprise@gamevibe.ai
- **Technical Support**: support@gamevibe.ai
- **Community Discord**: https://discord.gg/gamevibe
- **GitHub Issues**: https://github.com/gamevibe/enterprise-api

### SLA (Enterprise Tier)
- **99.9% Uptime Guarantee**
- **< 2 hour Response Time**
- **Dedicated Support Manager**
- **Priority Bug Fixes**

## Changelog

### v1.0.0 (2024-01-15)
- Initial release of Enterprise API
- Game management endpoints
- Analytics and reporting
- Webhook system
- API key authentication
- Rate limiting
- OpenAPI documentation

---

## Legal

- **Terms of Service**: https://gamevibe.ai/terms
- **Privacy Policy**: https://gamevibe.ai/privacy
- **API License**: https://gamevibe.ai/api-license

For enterprise license agreements and custom terms, contact enterprise@gamevibe.ai.