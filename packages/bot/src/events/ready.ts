import { Client, Events, ActivityType } from 'discord.js';

export class ReadyEvent {
  constructor(private client: Client) {}
  
  register(): void {
    this.client.once(Events.ClientReady, this.execute.bind(this));
  }
  
  private async execute(client: Client<true>): Promise<void> {
    console.log(`✅ Ready! Logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} servers`);
    
    // Set bot activity
    this.updateActivity();
    
    // Update activity every 5 minutes
    setInterval(() => this.updateActivity(), 5 * 60 * 1000);
  }
  
  private updateActivity(): void {
    const activities = [
      { name: 'games being created', type: ActivityType.Watching },
      { name: '/create-game', type: ActivityType.Listening },
      { name: 'with AI magic', type: ActivityType.Playing },
      { name: `in ${this.client.guilds.cache.size} servers`, type: ActivityType.Playing }
    ];
    
    const activity = activities[Math.floor(Math.random() * activities.length)];
    this.client.user?.setActivity(activity.name, { type: activity.type });
  }
}