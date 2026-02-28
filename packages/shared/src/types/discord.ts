export interface DiscordActivity {
  instanceId: string;
  participants: ActivityParticipant[];
  secrets?: ActivitySecrets;
  embedded?: boolean;
}

export interface ActivityParticipant {
  userId: string;
  username: string;
  discriminator: string;
  avatar?: string;
  bot: boolean;
}

export interface ActivitySecrets {
  join?: string;
  spectate?: string;
  match?: string;
}

export interface VoiceState {
  userId: string;
  channelId?: string;
  guildId?: string;
  deaf: boolean;
  mute: boolean;
  selfDeaf: boolean;
  selfMute: boolean;
  speaking: boolean;
}