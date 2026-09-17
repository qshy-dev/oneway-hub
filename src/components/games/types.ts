import type { ChatMessage } from '../giveaways/types';

export interface ParachuteDiver {
  id: string;
  message: ChatMessage;
  avatarUrl: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  rotationSpeed: number;
  swingPhase: number;
  swingAmplitude: number;
  startTime: number;
  landed: boolean;
  landedAt: number | null;
  score: number | null;
  hitTarget: boolean;
}

export interface LandingTarget {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GameTheme {
  id: string;
  name: string;
  emoji: string;
  targetLabel: string;
  targetColor: string;
  targetBorderColor: string;
  splashColors: string[];
  backgroundGradient: [string, string];
  particleEffect: 'bubbles' | 'snow' | 'leaves' | 'confetti' | 'stars';
}

export interface GameConfig {
  gravity: number;
  maxSpeed: number;
  windStrength: number;
  targetWidthPercent: number;
  targetHeightPercent: number;
  baseScore: number;
  maxBonusScore: number;
  optimalTimeMs: number;
  maxTimeMs: number;
  targetDisplayDurationMs: number;
  command: string;
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  gravity: 0.06,
  maxSpeed: 2.5,
  windStrength: 0.4,
  targetWidthPercent: 12,
  targetHeightPercent: 8,
  baseScore: 100,
  maxBonusScore: 400,
  optimalTimeMs: 8000,
  maxTimeMs: 25000,
  targetDisplayDurationMs: 10000,
  command: '!drop',
};

export interface GameResult {
  username: string;
  displayName: string;
  color: string;
  score: number;
  hit: boolean;
  durationMs: number;
}
