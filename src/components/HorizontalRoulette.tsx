import { useCallback, useEffect, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { type ProCrosshair } from '@/data/proCrosshairs';
import { CrosshairCodePreview } from './CrosshairPreview';
import { type Crosshair } from 'csgo-sharecode';
import { useI18n } from '@/i18n';
import {
  decodeSafe,
  DetailModal,
  RandomReveal,
  type DetailItem,
  type RouletteItem,
} from './rouletteShared';
import { randomCrosshairCode } from '@/lib/randomCrosshair';

const ITEM_WIDTH = 150;
const ITEM_GAP = 14;
const STRIDE = ITEM_WIDTH + ITEM_GAP;

const MIN_DURATION = 9;
const MAX_DURATION = 14;

const STRIP_LENGTH = 60;

/** Module-level strip cache: persists across unmounts (tab/section switches). */
let stripCache: { key: string; strip: RouletteItem[] } | null = null;

/** Deterministic key for the current item set, ignoring label language. */
function itemsKey(items: ProCrosshair[], includeRandom: boolean): string {
  const codes = items.map((i) => i.code).join('|');
  return `${codes}::${includeRandom}`;
}

/** Fisher-Yates shuffle (returns a new array). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build a strip of length STRIP_LENGTH from the pool with no adjacent duplicates.
 * The pool is shuffled and tiled; if the pool has only one item, it repeats
 * (unavoidable) but we still avoid visual monotony by keeping the single item.
 */
function buildStripFromPool(pool: RouletteItem[]): RouletteItem[] {
  if (pool.length === 0) return [];
  const strip: RouletteItem[] = [];
  let last: RouletteItem | null = null;
  while (strip.length < STRIP_LENGTH) {
    const shuffled = shuffle(pool);
    for (const item of shuffled) {
      if (strip.length >= STRIP_LENGTH) break;
      // Avoid placing the same item twice in a row when pool > 1
      if (pool.length > 1 && item === last) continue;
      strip.push(item);
      last = item;
    }
  }
  return strip;
}

interface RouletteProps {
  items: ProCrosshair[];
  onWin: (player: string, code: string, crosshair: Crosshair) => void;
  history: { player: string; code: string }[];
  includeRandom: boolean;
}

type Phase = 'idle' | 'spinning' | 'result';

export function HorizontalRoulette({ items, onWin, history, includeRandom }: RouletteProps) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>('idle');
  const [offset, setOffset] = useState(0);
  const [transition, setTransition] = useState(false);
  const [duration, setDuration] = useState(7.2);
  const [detail, setDetail] = useState<DetailItem | null>(null);
  const [randomReveal, setRandomReveal] = useState<DetailItem | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Stable pool reference — only the item codes and includeRandom matter,
  // not the language-dependent label (e.g. "Your crosshair" / "Random").
  const key = itemsKey(items, includeRandom);
  const keyRef = useRef(key);

  // Build the pool with current i18n labels (cheap, only used when regenerating)
  const buildPool = useCallback((): RouletteItem[] => {
    const pool: RouletteItem[] = [...items];
    if (includeRandom) {
      const r = randomCrosshairCode();
      if (r.code) pool.push({ player: t('random_player'), code: r.code, isRandom: true });
    }
    return pool;
  }, [items, includeRandom, t]);

  const [strip, setStrip] = useState<RouletteItem[]>(() => {
    // Restore from cache if the item set hasn't changed (e.g. tab/section switch)
    if (stripCache && stripCache.key === key) return stripCache.strip;
    const pool = buildPool();
    return buildStripFromPool(pool);
  });

  // Regenerate strip ONLY when the actual item set changes (codes / includeRandom).
  // Language changes and tab/section switches must NOT reshuffle.
  useEffect(() => {
    if (phase !== 'idle') return;
    if (keyRef.current === key) return;
    keyRef.current = key;
    const pool = buildPool();
    const newStrip = buildStripFromPool(pool);
    stripCache = { key, strip: newStrip };
    setStrip(newStrip);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, phase]);

  const handleSpin = useCallback(() => {
    if (phase === 'spinning' || (items.length === 0 && !includeRandom)) return;
    setPhase('spinning');
    setDetail(null);
    setTransition(false);

    const pool = buildPool();
    const newStrip = buildStripFromPool(pool);
    stripCache = { key, strip: newStrip };
    setStrip(newStrip);

    const minWinIndex = 40;
    const maxWinIndex = newStrip.length - 5;
    const winIndex =
      minWinIndex + Math.floor(Math.random() * (maxWinIndex - minWinIndex));
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

    const winItem = newStrip[winIndex];
    const ch = decodeSafe(winItem.code);
    const dur = MIN_DURATION + Math.random() * (MAX_DURATION - MIN_DURATION);
    setDuration(dur);

    setTimeout(() => {
      setPhase('result');
      onWin(winItem.player, winItem.code, ch);
      if (winItem.isRandom) {
        setRandomReveal({ player: winItem.player, code: winItem.code, crosshair: ch });
      } else {
        setDetail({ player: winItem.player, code: winItem.code, crosshair: ch });
      }
    }, dur * 1000 + 50);
  }, [phase, onWin, buildPool, items.length, includeRandom]);

  return (
    <div className="relative flex flex-col gap-8 pb-44">
      <div className="flex flex-col gap-8">
      {/* Wheel */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-20 bg-gradient-to-r from-ink-950 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-20 bg-gradient-to-l from-ink-950 to-transparent" />

        {/* center marker */}
        <div className="pointer-events-none absolute left-1/2 top-0 z-30 h-full -translate-x-1/2">
          <div className="h-full w-0.5 bg-accent-500 shadow-[0_0_8px_rgba(var(--accent-rgb),0.8)]" />
          <div className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-accent-500 shadow-[0_0_8px_rgba(var(--accent-rgb),0.8)]" />
          <div className="absolute bottom-0 left-1/2 h-3 w-3 -translate-x-1/2 translate-y-1/2 rotate-45 bg-accent-500 shadow-[0_0_8px_rgba(var(--accent-rgb),0.8)]" />
        </div>

        <div
          ref={viewportRef}
          className="overflow-hidden rounded-2xl border border-ink-800/60 bg-ink-900/20 py-6"
        >
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
            {strip.map((item, i) => (
              <div
                key={i}
                className="flex shrink-0 flex-col items-center gap-2"
                style={{ width: ITEM_WIDTH }}
              >
                <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-ink-800 bg-ink-850">
                  {item.isRandom ? (
                    <HelpCircle className="h-9 w-9 text-accent-400/70" strokeWidth={1} />
                  ) : (
                    <CrosshairCodePreview
                      code={item.code}
                      className="h-20 w-20"
                      background="transparent"
                    />
                  )}
                </div>
                <span className="text-xs font-medium text-ink-400">
                  {item.player}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spin button */}
      <div className="flex justify-center">
        <button
          onClick={handleSpin}
          disabled={phase === 'spinning'}
          className={`rounded-xl px-12 py-3.5 text-base font-semibold tracking-wide transition-all ${
            phase === 'spinning'
              ? 'cursor-default bg-ink-800 text-ink-500'
              : 'bg-ink-100 text-ink-950 hover:bg-accent-400 hover:scale-[1.02] active:scale-95'
          }`}
        >
          {phase === 'spinning' ? t('spinning') : t('spin')}
        </button>
      </div>
      </div>

      {/* History — absolutely positioned so it doesn't shift the wheel */}
      {history.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0">
          <h4 className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.15em] text-ink-500">
            {t('recent_wins')}
          </h4>
          <div className="flex flex-wrap justify-center gap-3">
            {history.slice(0, 10).map((h, i) => (
              <button
                key={i}
                onClick={() => setDetail({ player: h.player, code: h.code, crosshair: decodeSafe(h.code) })}
                className="flex items-center gap-2.5 rounded-lg border border-ink-800 bg-ink-900/50 px-3 py-2 transition hover:border-accent-500/50 hover:bg-ink-800"
              >
                <CrosshairCodePreview
                  code={h.code}
                  className="h-10 w-10 rounded border border-ink-800 bg-ink-850"
                  background="dark"
                />
                <span className="text-sm font-medium text-ink-300">
                  {h.player}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detail && <DetailModal item={detail} onClose={() => setDetail(null)} />}
      {randomReveal && (
        <RandomReveal
          finalCode={randomReveal.code}
          onComplete={() => {
            setDetail(randomReveal);
            setRandomReveal(null);
          }}
        />
      )}
    </div>
  );
}
