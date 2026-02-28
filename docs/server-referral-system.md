# Server Referral System

## Overview

The Server Referral System allows Discord servers to earn credits by referring other servers to add GameVibe AI bot. This is designed specifically for Discord's server-based subscription model where one person pays for the entire server.

## How It Works

### 1. Getting a Referral Link
Servers can generate their unique referral link using:
```
/server-referral link
```

This creates a unique referral code (e.g., `SRV-ABCD1234`) and provides an invite link with tracking.

### 2. Referral Rewards

#### Immediate Rewards
- **100 credits** - When a new server adds the bot via your referral link
- **500-2500 credits** - When the referred server subscribes (based on tier)

#### Monthly Commissions
- **10% commission** - Ongoing monthly credits from referred server subscriptions
- Automatically processed monthly via `PersonalCreditService.processMonthlyCommissions()`

### 3. Tracking & Analytics
View your server's referral performance:
```
/server-referral stats
```

Shows:
- Total referrals
- Subscribed referrals
- Total earnings
- Conversion rate
- Monthly commission
- Recent referrals

## Technical Implementation

### Database Schema

#### Server Table Updates
```prisma
model Server {
  // ... existing fields
  referralCode String? @unique // Unique referral code for this server
  
  // Relations
  referredServers ServerReferral[] @relation("ReferringServer")
  referralReceived ServerReferral? @relation("ReferredServer")
}
```

#### ServerReferral Model
```prisma
model ServerReferral {
  id                String   @id @default(cuid())
  referringServerId String   
  referredServerId  String   
  referralCode      String   
  installedAt       DateTime @default(now())
  subscribedAt      DateTime?
  subscriptionTier  SubscriptionTier?
  
  // Relations
  referringServer   Server   @relation("ReferringServer", fields: [referringServerId], references: [id])
  referredServer    Server   @relation("ReferredServer", fields: [referredServerId], references: [id])
  
  @@unique([referredServerId]) // A server can only be referred once
}
```

### Key Components

1. **ServerReferralCommand** (`/server-referral`)
   - `link` subcommand - Generate referral link
   - `stats` subcommand - View referral statistics

2. **PersonalCreditService.processServerReferral()**
   - Handles referral processing
   - Awards credits to server owners
   - Tracks subscription upgrades

3. **GuildCreateEvent**
   - Tracks when bot is added to new servers
   - Processes referral codes (requires OAuth integration)

### Referral Flow

1. **Server A** generates referral link with code `SRV-ABC123`
2. **Server B** owner clicks the link and adds the bot
3. **GuildCreateEvent** fires and checks for referral code
4. **PersonalCreditService** awards 100 credits to Server A's owner
5. If **Server B** subscribes, Server A's owner gets 500-2500 bonus credits
6. Monthly, Server A's owner receives 10% commission on Server B's subscription

## Milestones & Achievements

Servers earn bonus credits at referral milestones:
- 5 referrals: +250 credits
- 10 referrals: +500 credits  
- 25 referrals: +1,250 credits
- 50 referrals: +2,500 credits
- 100 referrals: +5,000 credits

## Important Notes

### Server-Based Model
- Referrals are **server-to-server**, not user-to-user
- Credits are awarded to the server subscription manager
- One referral code per server

### OAuth Integration Required
Full referral tracking requires OAuth callback integration to capture the referral code when the bot is added. Currently, the system is ready but needs the OAuth flow to be implemented.

### Credit Attribution
- Credits go to the server's subscription manager
- If no subscription exists, credits are held until a manager is assigned
- Server owners should ensure they have a subscription set up to receive credits

## API Endpoints

The bot provides internal tracking via:
- Bot invite links with `ref` parameter
- Analytics tracking for referral performance
- Automatic commission processing

## Best Practices

1. **Share Strategically**: Target Discord communities that would benefit from AI game creation
2. **Provide Value**: Explain GameVibe AI's benefits when sharing
3. **Track Performance**: Use `/server-referral stats` to monitor success
4. **Engage Referred Servers**: Help them get started to increase subscription conversion

## Future Enhancements

- [ ] Referral leaderboards
- [ ] Special badges for top referrers
- [ ] Bonus multipliers for high-performing referrers
- [ ] Referral campaigns with time-limited bonuses
- [ ] Server ambassador program integration