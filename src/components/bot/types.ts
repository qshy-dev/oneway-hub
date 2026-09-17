import type { ChatterRole } from '../giveaways/types';

export interface BotConfig {
  connected: boolean;
  bot_username: string;
  bot_twitch_user_id: string;
  bot_display_name: string;
  access_token: string;
  scopes: string[];
}

export interface BotChannel {
  id: string;
  twitch_channel_id: string;
  channel_name: string;
  enabled: boolean;
  created_at: string;
  connected?: boolean;
}

export type BotChannelConnectionStatus = 'idle' | 'joining' | 'joined' | 'failed' | 'leaving';

export interface BotChannelConnectionState {
  channelName: string;
  status: BotChannelConnectionStatus;
  error?: string;
  joinedAt?: number;
}

export interface BotChatMessage {
  id: string;
  channelId: string;
  channelName: string;
  userId: string;
  username: string;
  displayName: string;
  text: string;
  color: string | null;
  badges: string[];
  roles: ChatterRole[];
  timestamp: number;
}

export interface BotCommandResult {
  matched: boolean;
  output: string | null;
  reply: string | null;
}

export interface BotLog {
  id: string;
  type: 'message' | 'command' | 'event' | 'error';
  text: string;
  timestamp: number;
}

export type BotConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface ChattersResponse {
  user_id: string;
  user_login: string;
  display_name: string;
  roles: string[];
  is_bot: boolean;
}

export interface ViewerInfo {
  channel: string;
  live: boolean;
  viewers: number;
}