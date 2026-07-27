import type { LucideIcon } from 'lucide-react';
import { KeywordMode } from './modes/KeywordMode';
import { GuessNumberMode } from './modes/GuessNumberMode';

export type GiveawayModeId = 'keyword' | 'guessNumber';

export type ChatterRole = 'mod' | 'vip' | 'subscriber' | 'broadcaster';

export interface RoleWeights {
  mod: number;
  vip: number;
  subscriber: number;
  default: number;
}

export const DEFAULT_ROLE_WEIGHTS: RoleWeights = {
  mod: 3,
  vip: 2,
  subscriber: 1.5,
  default: 1,
};

export interface Participant {
  id: string;
  username: string;
  displayName: string;
  color: string;
  avatarUrl: string;
  firstSeenAt: number;
  messageCount: number;
  roles: ChatterRole[];
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  color: string;
  text: string;
  timestamp: number;
  roles: ChatterRole[];
}

export type LogType = 'message' | 'participant' | 'event' | 'error';

export interface LogEntry {
  id: string;
  type: LogType;
  text: string;
  timestamp: number;
}

export interface GiveawayHistoryEntry {
  id: string;
  date: number;
  mode: GiveawayModeId;
  modeLabel: string;
  participants: number;
  messages: number;
  winner: string | null;
  durationSec: number;
}

export interface ModeConfigField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'password';
  placeholder?: string;
  options?: { label: string; value: string }[];
  default: string | number | boolean;
}

export interface GiveawayModeConfig {
  id: GiveawayModeId;
  label: string;
  icon: LucideIcon;
  fields: ModeConfigField[];
}

export interface GiveawayModeContext {
  config: Record<string, string | number | boolean>;
  addParticipant: (msg: ChatMessage) => Participant | null;
  isCollecting: () => boolean;
  log: (text: string, type?: LogType) => void;
  declareWinner: (participant: Participant) => void;
  t: (key: string, ...args: string[]) => string;
}

export interface GiveawayMode {
  config: GiveawayModeConfig;
  handleMessage: (msg: ChatMessage, ctx: GiveawayModeContext) => void;
  onCollectStart?: (config: Record<string, string | number | boolean>) => Record<string, string | number | boolean>;
}

const modes: Record<GiveawayModeId, GiveawayMode> = {
  keyword: KeywordMode,
  guessNumber: GuessNumberMode,
};

export const modeList: GiveawayModeConfig[] = [
  KeywordMode.config,
  GuessNumberMode.config,
];

export function getMode(id: GiveawayModeId): GiveawayMode {
  return modes[id];
}
