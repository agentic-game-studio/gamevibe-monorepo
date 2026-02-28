# Ambassador System

The GameVibe AI Ambassador System creates a structured program for recognizing and rewarding community leaders who help drive engagement and growth within Discord servers.

## Overview

Server ambassadors are special community members who:
- Help onboard new users and create engaging experiences
- Promote GameVibe AI features and drive server growth
- Earn enhanced rewards and special privileges
- Contribute to community building and viral expansion

## Ambassador Ranks

### 🥉 Apprentice (0-499 contribution points)
- **Default Rank**: New ambassadors start here
- **Credit Multiplier**: 1.5x personal credit earning rate
- **Max Personal Credits**: 2,000
- **Promotion Reward**: None

### 🥈 Ambassador (500-999 contribution points)
- **Credit Multiplier**: 1.5x personal credit earning rate
- **Max Personal Credits**: 2,000
- **Promotion Reward**: 100 personal credits

### 🥇 Senior Ambassador (1,000-1,999 contribution points)
- **Credit Multiplier**: 1.5x personal credit earning rate
- **Max Personal Credits**: 2,000
- **Promotion Reward**: 250 personal credits

### 👑 Master Ambassador (2,000+ contribution points)
- **Credit Multiplier**: 1.5x personal credit earning rate
- **Max Personal Credits**: 2,000
- **Promotion Reward**: 500 personal credits

## Ambassador Activities & Points

### 🎮 Game Created (25 points)
- Automatically tracked when ambassador creates games
- One-time reward per game
- Encourages content creation

### 👥 Player Recruited (15 points)
- Triggered when new players engage with games
- Rewards community building efforts
- Helps track ambassador influence

### ⚔️ Challenge Hosted (20 points)
- Manually recorded or auto-tracked
- Promotes competitive engagement
- Builds server activity

### 🎉 Community Event (50 points)
- Manually recorded by admins
- High-value contribution recognition
- Encourages organized activities

### 💡 Feedback Provided (10 points)
- Manually recorded for valuable input
- Encourages constructive participation
- Helps improve the platform

### 🐛 Bug Reported (30 points)
- High value for quality assurance
- Manually verified by admins
- Improves platform stability

### 📚 Tutorial Created (40 points)
- Educational content creation
- Helps onboard new users
- Knowledge sharing reward

### 🤝 Mentored User (35 points)
- One-on-one help and guidance
- Community support recognition
- Personal development focus

### 🚀 Viral Content (60 points)
- Games reaching 100+ plays
- Automatically tracked
- Rewards successful content

### 📈 Server Growth (45 points)
- Manually recorded by admins
- Tracks ambassador impact on membership
- Long-term growth contribution

## Discord Commands

### `/ambassador appoint <user> [notes]`
**Permissions**: Manage Server
- Appoints a user as server ambassador
- Sets initial rank to Apprentice
- Sends welcome notification to new ambassador

### `/ambassador remove <user> [reason]`
**Permissions**: Manage Server
- Removes ambassador status
- Updates status to Retired
- Records reason for removal

### `/ambassador status [user]`
**Permissions**: Public
- Shows ambassador rank, contributions, and recent activities
- Defaults to command user if no target specified
- Displays streak and reward information

### `/ambassador stats`
**Permissions**: Public
- Server-wide ambassador statistics
- Shows total ambassadors, activities, and top contributors
- Monthly activity summaries

### `/ambassador list [status]`
**Permissions**: Public
- Lists all server ambassadors
- Optional filtering by status (Active, Inactive, Retired, Suspended)
- Shows appointment dates and contribution totals

### `/ambassador activity <ambassador> <type> <title> [description] [points]`
**Permissions**: Manage Server or Self-recording
- Records manual ambassador activities
- Custom point values (1-100)
- Comprehensive activity tracking

### `/ambassador rewards`
**Permissions**: Administrator
- Processes monthly ambassador rewards
- Distributes performance bonuses
- Resets monthly contribution counters

## Reward System

### Monthly Performance Bonuses
Distributed automatically based on monthly contributions:
- **Base Reward**: 1 credit per 10 contribution points
- **Rank Bonus**:
  - Apprentice: +10 credits
  - Ambassador: +20 credits
  - Senior: +30 credits
  - Master: +50 credits

### Rank Promotion Rewards
One-time bonuses for achieving new ranks:
- **Ambassador**: 100 credits
- **Senior**: 250 credits  
- **Master**: 500 credits

### Credit Earning Multiplier
Ambassadors earn 1.5x personal credits on all activities:
- Applied to game play rewards
- Applied to achievement bonuses
- Applied to challenge winnings
- Stacks with creator tier multipliers

## Integration with Existing Systems

### Personal Credits
- Ambassador multiplier applied to all credit earning
- Higher credit limits for ambassadors (2,000 vs 1,000)
- Automatic bonus tracking and analytics

### Achievement System
- 4 ambassador-specific achievements
- Integration with existing achievement rewards
- Contribution milestone recognition

### Challenge System
- Challenge hosting tracked as activity
- Automatic recording of hosted challenges
- Community competition encouragement

### Game Tracking
- Automatic activity recording for game creation
- Viral content detection (100+ plays)
- Player recruitment tracking

## Administrative Features

### Ambassador Management
- Server owners/admins can appoint/remove ambassadors
- Status tracking (Active, Inactive, Retired, Suspended)
- Performance monitoring and statistics

### Activity Verification
- Manual activity recording with admin verification
- Automatic activities for key actions
- Point system for contribution tracking

### Monthly Reward Processing
- Automated monthly bonus calculation
- Credit distribution to qualifying ambassadors
- Performance analytics and reporting

## Viral Growth Mechanics

### Cross-Server Recognition
- Ambassador status visible across servers
- Global contribution tracking
- Multi-server ambassador opportunities

### Social Pressure & Recognition
- Public ambassador lists and rankings
- Achievement unlocks for milestones
- Community recognition programs

### Organic Growth Incentives
- Player recruitment rewards
- Viral content bonuses
- Server growth contributions

## Analytics & Metrics

### Tracked Metrics
- Ambassador appointment/removal rates
- Activity distribution by type
- Contribution point accumulation
- Reward distribution patterns
- Rank advancement timelines

### Performance Indicators
- Ambassador retention rates
- Server growth correlation with ambassador activity
- Credit circulation through ambassador bonuses
- Community engagement improvements

### Growth Analytics
- Cross-server ambassador activity
- Viral content creation rates
- Player recruitment effectiveness
- Long-term community building impact

## Security & Fair Play

### Appointment Controls
- Requires Manage Server permissions
- Admin accountability with appointment tracking
- Notes system for appointment reasoning

### Activity Verification
- Automatic verification for system activities
- Admin verification for manual activities
- Point limits prevent gaming the system

### Abuse Prevention
- Activity caps and verification requirements
- Admin oversight of high-value activities
- Removal system for inappropriate behavior

## Future Enhancements

### Advanced Recognition
- Special badges and titles
- Ambassador-only features and channels
- Early access to new features

### Enhanced Rewards
- Physical rewards for top ambassadors
- Seasonal competition programs
- Partnership opportunities

### Cross-Platform Integration
- Ambassador recognition in web runtime
- Mobile app integration
- External platform partnerships

### Community Features
- Ambassador-only Discord channels
- Mentorship pairing programs
- Ambassador governance participation

## Technical Implementation

### Database Schema
- **ServerAmbassador**: Core ambassador records with status and performance tracking
- **AmbassadorActivity**: Detailed activity logging with verification
- **AmbassadorReward**: Reward distribution tracking and history

### Service Integration
- **AmbassadorService**: Core ambassador management functionality  
- **GameTrackingService**: Automatic activity recording integration
- **PersonalCreditService**: Ambassador bonus application
- **AchievementService**: Ambassador achievement tracking

### API Endpoints
All ambassador functionality is managed through Discord slash commands with proper permission controls and user verification.

## Best Practices

### For Server Admins
- Appoint active, helpful community members
- Regularly review ambassador performance
- Process monthly rewards consistently
- Recognize exceptional contributions publicly

### For Ambassadors
- Focus on genuine community building
- Create valuable content and experiences
- Help new users get started
- Maintain positive community presence

### For Users
- Engage with ambassador-created content
- Participate in community challenges
- Provide feedback and report issues
- Support server growth initiatives

The Ambassador System transforms engaged community members into official growth drivers, creating sustainable viral expansion while rewarding valuable contributions to the GameVibe AI ecosystem.