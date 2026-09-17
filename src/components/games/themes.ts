import type { GameTheme } from './types';

export const GAME_THEMES: GameTheme[] = [
  {
    id: 'cauldron',
    name: 'Котёл (Хеллоуин)',
    emoji: '🎃',
    targetLabel: 'Котёл',
    targetColor: '#1a472a',
    targetBorderColor: '#22c55e',
    splashColors: ['#22c55e', '#4ade80', '#86efac', '#bbf7d0'],
    backgroundGradient: ['#0f0f23', '#1a1a2e'],
    particleEffect: 'bubbles',
  },
  {
    id: 'snow',
    name: 'Сугроб (Новый год)',
    emoji: '❄️',
    targetLabel: 'Сугроб',
    targetColor: '#e0f2fe',
    targetBorderColor: '#38bdf8',
    splashColors: ['#e0f2fe', '#bae6fd', '#7dd3fc', '#f0f9ff'],
    backgroundGradient: ['#0c1929', '#162032'],
    particleEffect: 'snow',
  },
  {
    id: 'pool',
    name: 'Бассейн (Лето)',
    emoji: '🏊',
    targetLabel: 'Бассейн',
    targetColor: '#0ea5e9',
    targetBorderColor: '#38bdf8',
    splashColors: ['#38bdf8', '#7dd3fc', '#bae6fd', '#e0f2fe'],
    backgroundGradient: ['#0a1628', '#0f2847'],
    particleEffect: 'bubbles',
  },
  {
    id: 'leaves',
    name: 'Куча листьев (Осень)',
    emoji: '🍂',
    targetLabel: 'Куча листьев',
    targetColor: '#92400e',
    targetBorderColor: '#f59e0b',
    splashColors: ['#f59e0b', '#d97706', '#b45309', '#78350f'],
    backgroundGradient: ['#1a1208', '#2d1f0f'],
    particleEffect: 'leaves',
  },
  {
    id: 'rainbow',
    name: 'Радуга',
    emoji: '🌈',
    targetLabel: 'Радуга',
    targetColor: '#7c3aed',
    targetBorderColor: '#a78bfa',
    splashColors: ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6'],
    backgroundGradient: ['#1a1a2e', '#2d1b69'],
    particleEffect: 'confetti',
  },
  {
    id: 'cake',
    name: 'Торт',
    emoji: '🎂',
    targetLabel: 'Торт',
    targetColor: '#be185d',
    targetBorderColor: '#f472b6',
    splashColors: ['#f472b6', '#ec4899', '#db2777', '#fbbf24'],
    backgroundGradient: ['#1a0a1e', '#2d1038'],
    particleEffect: 'confetti',
  },
];

export function getTheme(id: string): GameTheme {
  return GAME_THEMES.find(t => t.id === id) ?? GAME_THEMES[0];
}
