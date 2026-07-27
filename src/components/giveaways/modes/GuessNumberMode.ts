import { Dice5 } from 'lucide-react';
import type { GiveawayMode } from '../types';

function rollRandomTarget(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const GuessNumberMode: GiveawayMode = {
  config: {
    id: 'guessNumber',
    label: 'Угадай число',
    icon: Dice5,
    fields: [
      {
        key: 'min',
        label: 'Минимум',
        type: 'number',
        default: 1,
      },
      {
        key: 'max',
        label: 'Максимум',
        type: 'number',
        default: 500,
      },
      {
        key: 'targetMode',
        label: 'Загаданное число',
        type: 'select',
        default: 'random',
        options: [
          { label: 'Случайное', value: 'random' },
          { label: 'Ввести вручную', value: 'manual' },
        ],
      },
      {
        key: 'manualTarget',
        label: 'Загаданное число (скрыто)',
        type: 'password',
        placeholder: 'например 247',
        default: '',
      },
    ],
  },
  onCollectStart(config) {
    const next = { ...config };
    const targetMode = String(config.targetMode ?? 'random');
    if (targetMode === 'random') {
      const min = Number(config.min ?? 1);
      const max = Number(config.max ?? 500);
      next._randomTarget = rollRandomTarget(min, max);
    }
    return next;
  },
  handleMessage(msg, ctx) {
    if (!ctx.isCollecting()) return;
    const text = msg.text.trim();
    if (!/^\d+$/.test(text)) return;
    const guess = parseInt(text, 10);
    const min = Number(ctx.config.min ?? 1);
    const max = Number(ctx.config.max ?? 500);
    if (guess < min || guess > max) return;

    const participant = ctx.addParticipant(msg);
    if (!participant) return;

    const targetMode = String(ctx.config.targetMode ?? 'random');
    let target: number | null = null;
    if (targetMode === 'manual') {
      target = Number(ctx.config.manualTarget ?? NaN);
    } else {
      target = Number((ctx.config as Record<string, unknown>)._randomTarget ?? NaN);
    }
    if (target != null && Number.isFinite(target) && guess === target) {
      ctx.log(ctx.t('gw_log_guessed_number', String(target), msg.displayName), 'event');
      ctx.declareWinner(participant);
    }
  },
};
