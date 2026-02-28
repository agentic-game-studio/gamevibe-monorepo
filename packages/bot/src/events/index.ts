import { Client } from 'discord.js';
import { Container } from 'inversify';
import { ReadyEvent } from './ready.js';
import { InteractionCreateEvent } from './interaction-create.js';
import { GuildCreateEvent } from './guild-create.js';

export function registerEvents(client: Client, container: Container): void {
  // Initialize event handlers
  const readyEvent = new ReadyEvent(client);
  const interactionCreateEvent = new InteractionCreateEvent(client, container);
  const guildCreateEvent = new GuildCreateEvent(client, container);
  
  // Register events
  readyEvent.register();
  interactionCreateEvent.register();
  guildCreateEvent.register();
}