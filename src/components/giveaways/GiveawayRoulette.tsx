import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import type { Participant, RoleWeights } from './types';
import { DEFAULT_ROLE_WEIGHTS } from './types';
import { Avatar } from './Avatar';
import { useI18n } from '@/i18n';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dedupeParticipants(pool: Participant[]): Participant[] {
  const seen = new Set<string>();
  const out: Participant[] = [];
  for (const p of pool) {
    const key = p.username.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function buildUniqueStrip(pool: Participant[], len: number): Participant[] {
  const unique = dedupeParticipants(pool);
  if (unique.length === 0) return [];
  const out: Participant[] = [];
  let last: string | undefined;
  while (out.length < len) {
    const shuffled = shuffle(unique);
    for (const p of shuffled) {
      if (out.length >= len) break;
      if (p.username === last && unique.length > 1) continue;
      out.push(p);
      last = p.username;
    }
  }
  return out;
}

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
  onPickWinner?: () => void;
}

type Phase = 'idle' | 'spinning' | 'result';

function avatarUrlFor(username: string): string {
  return `https://unavatar.io/twitch/${encodeURIComponent(username)}`;
}

export function GiveawayRoulette({ participants, spinSignal, onResult, roleWeights = DEFAULT_ROLE_WEIGHTS, excludedIds, onPickWinner }: GiveawayRouletteProps) {
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

  const buildStrip = useCallback((pool: Participant[]): Participant[] => {
    if (pool.length === 0) return [];
    return buildUniqueStrip(pool, 60);
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
      setStrip(buildStrip(participants));
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
    const newStrip = buildStrip(pool);
    setStrip(newStrip);

    const minWinIndex = 40;
    const maxWinIndex = newStrip.length - 5;
    // Find a win index whose neighbors differ from the forced winner to avoid consecutive duplicates
    const candidates: number[] = [];
    for (let i = minWinIndex; i <= maxWinIndex; i++) {
      const leftOk = i === 0 || newStrip[i - 1].username !== forcedWinner.username;
      const rightOk = i === newStrip.length - 1 || newStrip[i + 1].username !== forcedWinner.username;
      if (leftOk && rightOk) candidates.push(i);
    }
    const winIndex = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : minWinIndex + Math.floor(Math.random() * (maxWinIndex - minWinIndex));
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
                    <Avatar
                      src={p.avatarUrl || avatarUrlFor(p.username)}
                      username={p.username}
                      displayName={p.displayName}
                      color={p.color}
                      className="h-full w-full object-cover"
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

      {phase === 'idle' && !winner && onPickWinner && participants.length > 0 && (
        <div className="flex justify-center">
          <button
            onClick={onPickWinner}
            className="flex items-center gap-2 rounded-xl bg-accent-500 px-12 py-3.5 text-base font-semibold tracking-wide text-white transition-all hover:bg-accent-400 hover:scale-[1.02] active:scale-95"
          >
            <Trophy className="h-5 w-5" />
            {t('gw_pick_winner')}
          </button>
        </div>
      )}

      {winner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
          className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-accent-500/40 bg-accent-500/10 p-6 text-center"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-400">{t('gw_winner')}</span>
          <Avatar
            src={winner.avatarUrl || avatarUrlFor(winner.username)}
            username={winner.username}
            displayName={winner.displayName}
            color={winner.color}
            className="h-20 w-20 rounded-full border-2 border-accent-500 object-cover"
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
