import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Participant, RoleWeights } from './types';
import { DEFAULT_ROLE_WEIGHTS } from './types';
import { useI18n } from '@/i18n';

const ITEM_WIDTH = 150;
const ITEM_GAP = 14;
const STRIDE = ITEM_WIDTH + ITEM_GAP;
const MIN_DURATION = 9;
const MAX_DURATION = 14;

interface GiveawayRouletteProps {
  participants: Participant[];
  spinSignal: number;
  onResult: (winner: Participant | null) => void;
  roleWeights?: RoleWeights;
  excludedIds?: Set<string>;
}

type Phase = 'idle' | 'spinning' | 'result';

function avatarUrlFor(username: string): string {
  return `https://unavatar.io/twitch/${encodeURIComponent(username)}`;
}

export function GiveawayRoulette({ participants, spinSignal, onResult, roleWeights = DEFAULT_ROLE_WEIGHTS, excludedIds }: GiveawayRouletteProps) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>('idle');
  const [offset, setOffset] = useState(0);
  const [transition, setTransition] = useState(false);
  const [duration, setDuration] = useState(7.2);
  const [strip, setStrip] = useState<Participant[]>([]);
  const [winner, setWinner] = useState<Participant | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const buildStrip = useCallback((pool: Participant[], weights: RoleWeights, forcedWinner?: Participant) => {
    if (pool.length === 0) return [];
    const out: Participant[] = [];
    const winIndex = forcedWinner ? 40 + Math.floor(Math.random() * 10) : -1;
    for (let i = 0; i < 60; i++) {
      if (i === winIndex && forcedWinner) {
        out.push(forcedWinner);
      } else {
        out.push(pool[Math.floor(Math.random() * pool.length)]);
      }
    }
    return out;
  }, []);

  const pickWeightedWinner = useCallback((pool: Participant[], weights: RoleWeights): Participant => {
    if (pool.length === 1) return pool[0];
    const getWeight = (p: Participant): number => {
      if (p.roles.includes('mod')) return weights.mod;
      if (p.roles.includes('vip')) return weights.vip;
      if (p.roles.includes('subscriber')) return weights.subscriber;
      return weights.default;
    };
    const weightedPool: Participant[] = [];
    for (const p of pool) {
      const w = Math.max(0, getWeight(p));
      const count = Math.max(1, Math.round(w));
      for (let i = 0; i < count; i++) weightedPool.push(p);
    }
    return weightedPool[Math.floor(Math.random() * weightedPool.length)];
  }, []);

  useEffect(() => {
    if (phase === 'idle' && strip.length === 0 && participants.length > 0) {
      setStrip(buildStrip(participants, roleWeights));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants]);

  const spin = useCallback(() => {
    let pool = excludedIds && excludedIds.size > 0
      ? participants.filter((p) => !excludedIds.has(p.id))
      : participants;
    // Fallback: if all participants are excluded, use the full list so roulette can still spin
    if (pool.length === 0 && participants.length > 0) pool = participants;
    if (phase === 'spinning' || pool.length === 0) return;
    setPhase('spinning');
    setWinner(null);
    setTransition(false);

    const forcedWinner = pickWeightedWinner(pool, roleWeights);
    const newStrip = buildStrip(pool, roleWeights, forcedWinner);
    setStrip(newStrip);

    const minWinIndex = 40;
    const maxWinIndex = newStrip.length - 5;
    const winIndex = minWinIndex + Math.floor(Math.random() * (maxWinIndex - minWinIndex));
    // Ensure the forced winner lands on winIndex
    newStrip[winIndex] = forcedWinner;
    const jitter = (Math.random() - 0.5) * (ITEM_WIDTH * 0.6);
    const containerWidth = viewportRef.current?.clientWidth ?? 800;
    const baseOffset = containerWidth / 2 - ITEM_WIDTH / 2;
    const targetOffset = -(winIndex * STRIDE + jitter) + baseOffset;

    setOffset(baseOffset);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransition(true);
        setOffset(targetOffset);
      });
    });

    const dur = MIN_DURATION + Math.random() * (MAX_DURATION - MIN_DURATION);
    setDuration(dur);

    setTimeout(() => {
      setPhase('result');
      setWinner(forcedWinner);
      onResultRef.current(forcedWinner);
    }, dur * 1000 + 50);
  }, [phase, participants, excludedIds, buildStrip, pickWeightedWinner, roleWeights]);

  useEffect(() => {
    if (spinSignal > 0) spin();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinSignal]);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-20 bg-gradient-to-r from-ink-950 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-20 bg-gradient-to-l from-ink-950 to-transparent" />
        <div className="pointer-events-none absolute left-1/2 top-0 z-30 h-full -translate-x-1/2">
          <div className="h-full w-0.5 bg-accent-500 shadow-[0_0_8px_rgba(var(--accent-rgb),0.8)]" />
          <div className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-accent-500 shadow-[0_0_8px_rgba(var(--accent-rgb),0.8)]" />
          <div className="absolute bottom-0 left-1/2 h-3 w-3 -translate-x-1/2 translate-y-1/2 rotate-45 bg-accent-500 shadow-[0_0_8px_rgba(var(--accent-rgb),0.8)]" />
        </div>

        <div ref={viewportRef} className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900/50 py-6">
          {participants.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-500">
              {t('gw_no_participants')}
            </div>
          ) : (
            <div
              className="flex"
              style={{
                gap: ITEM_GAP,
                transform: `translateX(${offset}px)`,
                transition: transition
                  ? `transform ${duration}s cubic-bezier(0.12, 0.66, 0.06, 1)`
                  : 'none',
              }}
            >
              {strip.map((p, i) => (
                <div key={i} className="flex shrink-0 flex-col items-center gap-2" style={{ width: ITEM_WIDTH }}>
                  <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-ink-800 bg-ink-850 overflow-hidden">
                    <img
                      src={p.avatarUrl || avatarUrlFor(p.username)}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                    />
                  </div>
                  <span className="max-w-[140px] truncate text-xs font-medium" style={{ color: p.color }}>
                    {p.displayName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {winner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
          className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-accent-500/40 bg-accent-500/10 p-6 text-center"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-400">{t('gw_winner')}</span>
          <img
            src={winner.avatarUrl || avatarUrlFor(winner.username)}
            alt=""
            className="h-20 w-20 rounded-full border-2 border-accent-500 object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          />
          <h3 className="text-2xl font-extrabold" style={{ color: winner.color }}>
            {winner.displayName}
          </h3>
          <span className="text-sm text-ink-400">@{winner.username} · {winner.messageCount} {t('gw_messages_short')}</span>
        </motion.div>
      )}
    </div>
  );
}
