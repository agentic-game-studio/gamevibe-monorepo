# Bot Listing Optimization Guide

## Overview

GameVibe AI is listed on multiple Discord bot listing sites to increase discovery and user acquisition. This guide covers setup, optimization, and maintenance of bot listings.

## Supported Platforms

### 1. Top.gg (Discord Bot List)
- **URL**: https://top.gg/bot/{bot-id}
- **Features**: Voting, webhooks, server count API
- **Benefits**: Largest bot listing site, high traffic
- **Vote Rewards**: 10 credits (20 on weekends)

### 2. Discord.bots.gg
- **URL**: https://discord.bots.gg/bots/{bot-id}
- **Features**: Voting, webhooks, detailed analytics
- **Benefits**: Clean interface, developer-friendly
- **Vote Rewards**: 10 credits per vote

### 3. Discordbotlist.com
- **URL**: https://discordbotlist.com/bots/{bot-id}
- **Features**: Basic listing, server stats
- **Benefits**: Additional exposure
- **Vote Rewards**: 10 credits per vote

## Bot Listing Setup

### 1. Environment Configuration

```bash
# Top.gg Configuration
TOPGG_TOKEN=your_topgg_api_token
TOPGG_WEBHOOK_SECRET=your_topgg_webhook_secret

# Discord.bots.gg Configuration
DISCORD_BOTS_GG_TOKEN=your_discord_bots_gg_token
DISCORD_BOTS_GG_WEBHOOK_SECRET=your_webhook_secret

# Discordbotlist.com Configuration
DISCORD_BOT_LIST_TOKEN=your_discordbotlist_token
```

### 2. Webhook Setup

Configure webhook URLs on each platform:
- Top.gg: `https://your-domain.com/webhooks/topgg/vote`
- Discord.bots.gg: `https://your-domain.com/webhooks/discordbotsgg/vote`
- Others: `https://your-domain.com/webhooks/vote/{site-name}`

### 3. Bot Description Template

```markdown
# GameVibe AI - Create Games with AI in Discord!

🎮 **Transform your ideas into playable games using AI!**

GameVibe AI lets you create fully functional games right in Discord using natural language. Just describe what you want, and our AI will generate a complete game that runs directly in Discord Activities!

## ✨ Key Features

🎯 **AI-Powered Game Creation**
- Describe your game idea in plain English
- AI generates complete, playable games in seconds
- Multiple game types: Platformer, Puzzle, RPG, Shooter, and more!

🎨 **AI-Generated Assets**
- Automatic sprite and background generation
- Unique art for every game
- Professional quality graphics

🏆 **Leaderboards & Competition**
- Global and per-game leaderboards
- Challenge friends with credit wagering
- Achievement system with rewards

💎 **Creator Economy**
- Earn credits when others play your games
- Bronze → Diamond creator tiers
- Share games across servers

🚀 **Advanced Features**
- Multiplayer support (up to 8 players)
- Game remixing with 14+ templates
- Social preview cards for sharing
- Embeddable games for websites

## 🎮 Quick Start

1. Add GameVibe AI to your server
2. Use `/create-game` and describe your game idea
3. Click "Play Now" to launch your game!
4. Share with `/share` to earn credits

## 💰 Pricing

- **FREE**: 3 games/month
- **STARTER** ($9.99): 50 games/month + premium features
- **PRO** ($29.99): 100 games/month + advanced AI
- **ENTERPRISE** ($99.99): Unlimited everything

## 🔗 Links

- [Support Server](https://discord.gg/your-support)
- [Documentation](https://docs.gamevibe.ai)
- [Vote & Earn Credits](https://your-vote-page)

## 📊 Stats

- 50,000+ games created
- 1M+ games played
- 95% cost reduction with AI optimization
- 4.8/5 average rating

**Vote for GameVibe AI to support development and earn credits!**
```

### 4. Tags/Categories

Recommended tags for maximum visibility:
- `games`
- `ai`
- `fun`
- `economy`
- `creator`
- `multiplayer`
- `activities`
- `entertainment`
- `social`
- `leveling`

## Marketing Assets

### 1. Bot Avatar
- Size: 512x512px
- Format: PNG with transparency
- Design: GameVibe AI logo with vibrant colors

### 2. Banner Images
- Top.gg Banner: 1920x1080px
- Card Image: 640x360px
- Showcase GIFs: 5-second gameplay loops

### 3. Screenshots
Include 4-6 screenshots showing:
1. Game creation command
2. AI generating a game
3. Playing a game in Discord
4. Leaderboard/achievements
5. Creator dashboard
6. Multiplayer gameplay

## Optimization Strategies

### 1. Vote Incentives
- **Immediate Rewards**: 10 credits per vote (20 on weekends)
- **Milestone Rewards**: Achievements at 1, 10, 50, 100 votes
- **Vote Reminders**: Optional DM reminders every 12 hours
- **Streak Bonuses**: Extra credits for daily voting

### 2. SEO Optimization
- Use relevant keywords in description
- Update bot info regularly
- Respond to reviews promptly
- Maintain high uptime (99%+)

### 3. Social Proof
- Display server count prominently
- Show game creation statistics
- Feature positive reviews
- Highlight creator success stories

### 4. Regular Updates
- Post changelog updates
- Announce new features
- Run voting events
- Feature game of the week

## Vote Tracking Implementation

### 1. Webhook Handler
```typescript
// Processes incoming vote webhooks
// Awards credits to voters
// Tracks achievements
// Updates analytics
```

### 2. Vote Command
```typescript
/vote links     - Show all voting sites
/vote stats     - View your voting history
/vote remind    - Toggle vote reminders
```

### 3. Analytics
Track key metrics:
- Daily/weekly/monthly votes
- Vote-to-install conversion
- Credit usage from votes
- Voter retention rate

## Maintenance Checklist

### Weekly
- [ ] Update server count statistics
- [ ] Check webhook functionality
- [ ] Review vote analytics
- [ ] Respond to bot reviews

### Monthly
- [ ] Update bot description if needed
- [ ] Refresh screenshots/GIFs
- [ ] Analyze voting trends
- [ ] Plan voting events

### Quarterly
- [ ] Major description overhaul
- [ ] New marketing assets
- [ ] Competitive analysis
- [ ] ROI assessment

## Monitoring & Alerts

### Automated Monitoring
- Server count updates every 30 minutes
- Webhook health checks
- Vote processing success rate
- Credit distribution tracking

### Alert Conditions
- Webhook failures
- Stats update failures
- Unusual voting patterns
- Credit distribution errors

## Best Practices

1. **Consistency**: Keep all listings synchronized
2. **Engagement**: Respond to user reviews/comments
3. **Transparency**: Clear pricing and features
4. **Innovation**: Highlight unique features
5. **Community**: Link to support server
6. **Rewards**: Make voting worthwhile
7. **Simplicity**: Easy-to-understand description
8. **Visuals**: High-quality images and GIFs

## Troubleshooting

### Common Issues

1. **Webhooks Not Working**
   - Verify webhook URL is correct
   - Check webhook secret configuration
   - Ensure server is accessible
   - Review webhook logs

2. **Stats Not Updating**
   - Check API token validity
   - Verify bot has correct permissions
   - Review rate limits
   - Check scheduling service

3. **Low Vote Count**
   - Improve vote incentives
   - Add vote reminders
   - Run voting events
   - Cross-promote on social media

## Success Metrics

- **Votes per day**: Target 100+
- **Vote conversion**: 5-10% of users
- **Credit redemption**: 80%+ of earned credits
- **Retention**: 30%+ monthly voters
- **Growth**: 20%+ MoM vote increase