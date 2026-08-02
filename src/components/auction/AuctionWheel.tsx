import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCw, Trophy, RefreshCw, Check, Clock, X, EyeOff, Eye } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useSettings } from '@/lib/settings';
import type { Lot } from './types';
import {
  useAnimatedSegments,
  arcPathForAngles,
  shuffle,
  type AnimSegment,
} from '../rouletteShared';

interface AuctionWheelProps {
  lots: Lot[];
  onWinner: (lot: Lot) => void;
  onReroll?: () => void;
  onEliminated?: (lot: Lot) => void;
  sidebarCollapsed?: boolean;
  wheelDirtyRef?: React.MutableRefObject<boolean>;
}

type Phase = 'idle' | 'spinning' | 'result';
type AnimMode = 'normal' | 'spicy';
type WheelType = 'normal' | 'elimination';

const SIZE = 600;
const HALF = SIZE / 2;
const RADIUS = HALF - 1;
const LABEL_RADIUS = 250;
const DEFAULT_DURATION = 10;

const PALETTE_DARK = [
  { a: '#22385f', b: '#2e4d80' },
  { a: '#164a4a', b: '#246b6b' },
  { a: '#1f4a2a', b: '#2e6a3f' },
  { a: '#5a4028', b: '#80603a' },
  { a: '#5a2a35', b: '#803a48' },
  { a: '#1f4558', b: '#2e5d75' },
];

const PALETTE_LIGHT = [
  { a: '#b0c4e4', b: '#c4d4ec' },
  { a: '#a4d4d4', b: '#c0e4e4' },
  { a: '#c0d8c8', b: '#d4e8d8' },
  { a: '#e4ccb4', b: '#f0dcc8' },
  { a: '#e4c8d0', b: '#f0d8e0' },
  { a: '#b8d0e4', b: '#cce0ec' },
];

function polar(deg: number, r: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [r * Math.cos(rad), r * Math.sin(rad)];
}

export function AuctionWheel({ lots, onWinner, onReroll, onEliminated, sidebarCollapsed, wheelDirtyRef }: AuctionWheelProps) {
  const { t } = useI18n();
  const { prefs } = useSettings();
  const isLight = prefs.theme === 'light';
  const PALETTE = isLight ? PALETTE_LIGHT : PALETTE_DARK;

  const validLots = useMemo(() => lots.filter((l) => l.price > 0), [lots]);

  const [wheelType, setWheelType] = useState<WheelType>('normal');
  const [shuffledLots, setShuffledLots] = useState<Lot[]>(() => shuffle(validLots));
  const [eliminatedIds, setEliminatedIds] = useState<Set<string>>(new Set());
  const [eliminatedModal, setEliminatedModal] = useState<Lot | null>(null);
  const [winner, setWinner] = useState<Lot | null>(null);
  const [pendingWinner, setPendingWinner] = useState<Lot | null>(null);
  const [eliminationComplete, setEliminationComplete] = useState(false);
  const [switchModeConfirm, setSwitchModeConfirm] = useState<WheelType | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [hideEliminated, setHideEliminated] = useState(false);

  const activeLots = useMemo(
    () => shuffledLots.filter((l) => !eliminatedIds.has(l.id)),
    [shuffledLots, eliminatedIds],
  );

  const eliminatedList = useMemo(
    () => validLots.filter((l) => eliminatedIds.has(l.id)),
    [validLots, eliminatedIds],
  );

  const isDirty = wheelType === 'elimination' && (eliminatedIds.size > 0 || winner !== null || pendingWinner !== null || eliminationComplete);

  useEffect(() => {
    if (wheelDirtyRef) wheelDirtyRef.current = isDirty;
  });

  const totalSum = useMemo(() => activeLots.reduce((s, l) => s + l.price, 0), [activeLots]);

  const segments = useMemo(() => {
    if (activeLots.length === 0 || totalSum === 0) return [];
    if (wheelType === 'elimination') {
      const inv = activeLots.map((l) => 1 / Math.max(l.price, 1));
      const invSum = inv.reduce((a, b) => a + b, 0);
      let acc = 0;
      return activeLots.map((lot, i) => {
        const w = inv[i] / invSum;
        const start = (acc / invSum) * 360;
        acc += inv[i];
        const end = (acc / invSum) * 360;
        return { lot, start, end, mid: (start + end) / 2, weight: w };
      });
    }
    let acc = 0;
    return activeLots.map((lot) => {
      const start = (acc / totalSum) * 360;
      acc += lot.price;
      const end = (acc / totalSum) * 360;
      return { lot, start, end, mid: (start + end) / 2, weight: lot.price / totalSum };
    });
  }, [activeLots, totalSum, wheelType]);

  const targetSegments: AnimSegment[] = useMemo(
    () => segments.map((s) => ({ key: s.lot.id, start: s.start, end: s.end })),
    [segments],
  );
  const displayed = useAnimatedSegments(targetSegments, 700);
  const activeCount = displayed.filter((d) => !d.exiting).length;
  const segByLotId = useMemo(
    () => new Map(segments.map((s) => [s.lot.id, s])),
    [segments],
  );

  const [phase, setPhase] = useState<Phase>('idle');
  const [rotation, setRotation] = useState(0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [durationStr, setDurationStr] = useState(String(DEFAULT_DURATION));
  const [durationFromPreset, setDurationFromPreset] = useState(true);
  const [animMode, setAnimMode] = useState<AnimMode>('normal');

  const wheelRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);
  const rotationRef = useRef(0);
  const idleRef = useRef<Animation | null>(null);

  // Reset elimination state when lot set changes
  useEffect(() => {
    setShuffledLots(shuffle(validLots));
    setEliminatedIds(new Set());
    setEliminationComplete(false);
    setEliminatedModal(null);
    setWinner(null);
    setPendingWinner(null);
    setSwitchModeConfirm(null);
    setResetConfirm(false);
    setPhase('idle');
    setRotation(0);
    rotationRef.current = 0;
  }, [lots.length]);

  useEffect(() => {
    if (!wheelRef.current) return;
    if (phase === 'idle') {
      idleRef.current = wheelRef.current.animate(
        [
          { transform: `rotate(${rotationRef.current}deg)` },
          { transform: `rotate(${rotationRef.current + 360}deg)` },
        ],
        { duration: 90000, iterations: Infinity, easing: 'linear' },
      );
    } else {
      idleRef.current?.cancel();
      idleRef.current = null;
    }
    return () => { idleRef.current?.cancel(); idleRef.current = null; };
  }, [phase]);

  const handleSpin = useCallback(() => {
    if (phase === 'spinning' || segments.length === 0 || !wheelRef.current) return;
    setPhase('spinning');
    setWinner(null);
    setHoveredIdx(null);
    setEliminatedModal(null);
    idleRef.current?.cancel();

    const r = Math.random();
    let acc = 0;
    let winIdx = 0;
    for (let i = 0; i < segments.length; i++) {
      acc += segments[i].weight;
      if (r < acc) { winIdx = i; break; }
    }

    const winSeg = segments[winIdx];
    const jitter = (Math.random() - 0.5) * (winSeg.end - winSeg.start) * 0.6;
    const thetaW = winSeg.mid + jitter;
    const fullSpins = 5 + Math.floor(Math.random() * 5);
    const targetMod = (360 - thetaW + 360) % 360;
    const currentMod = ((rotationRef.current % 360) + 360) % 360;
    const delta = (targetMod - currentMod + 360) % 360;
    const startRot = rotationRef.current;
    const finalRot = startRot + 360 * fullSpins + delta;
    rotationRef.current = finalRot;
    const total = finalRot - startRot;

    animRef.current?.cancel();

    let keyframes: Keyframe[];
    let easing: string;

    if (animMode === 'spicy') {
      keyframes = [
        { transform: `rotate(${startRot}deg)`, offset: 0, easing: 'cubic-bezier(0.42,0,0.95,0.5)' },
        { transform: `rotate(${startRot + total * 0.32}deg)`, offset: 0.15, easing: 'cubic-bezier(0.3,0.1,0.6,0.9)' },
        { transform: `rotate(${startRot + total * 0.62}deg)`, offset: 0.38, easing: 'cubic-bezier(0.25,0.1,0.3,1)' },
        { transform: `rotate(${startRot + total * 0.85}deg)`, offset: 0.68, easing: 'cubic-bezier(0.15,0,0.1,1)' },
        { transform: `rotate(${finalRot}deg)`, offset: 1, easing: 'cubic-bezier(0.05,0,0.02,1)' },
      ];
      easing = 'linear';
    } else {
      keyframes = [
        { transform: `rotate(${startRot}deg)`, offset: 0 },
        { transform: `rotate(${finalRot}deg)`, offset: 1 },
      ];
      easing = 'cubic-bezier(0.17,0.67,0.12,1)';
    }

    const dur = Math.max(500, (Number(durationStr) || DEFAULT_DURATION) * 1000);
    const anim = wheelRef.current.animate(keyframes, { duration: dur, easing, fill: 'forwards' });
    animRef.current = anim;

    const landedLot = activeLots[winIdx];

    const finish = () => {
      if (animRef.current === anim) {
        try { anim.commitStyles(); } catch {}
        anim.cancel();
        animRef.current = null;
      }
      setRotation(finalRot);

      if (wheelType === 'elimination') {
        const remaining = activeLots.filter((l) => l.id !== landedLot.id);
        setEliminatedIds((prev) => {
          const next = new Set(prev);
          next.add(landedLot.id);
          return next;
        });
        setEliminatedModal(landedLot);
        onEliminated?.(landedLot);

        if (remaining.length <= 1) {
          setPendingWinner(remaining[0] ?? landedLot);
        } else {
          setPhase('idle');
        }
      } else {
        setPhase('result');
        setWinner(landedLot);
        onWinner(landedLot);
      }
    };

    anim.onfinish = finish;
    window.setTimeout(() => {
      setPhase((p) => { if (p === 'spinning') { finish(); return wheelType === 'elimination' ? 'idle' : 'result'; } return p; });
    }, dur + 250);
  }, [phase, segments, activeLots, totalSum, onWinner, onEliminated, durationStr, animMode, wheelType]);

  const handleNextSpin = () => {
    setEliminatedModal(null);
    if (pendingWinner) {
      setWinner(pendingWinner);
      setPendingWinner(null);
      setEliminationComplete(true);
      setPhase('result');
      onWinner(pendingWinner);
      return;
    }
    setPhase('idle');
    setRotation(0);
    rotationRef.current = 0;
  };

  const handleConfirmWinner = () => {
    setWinner(null);
    setEliminationComplete(true);
  };

  const handleReroll = () => {
    setShuffledLots(shuffle(validLots));
    setEliminatedIds(new Set());
    setEliminationComplete(false);
    setEliminatedModal(null);
    setWinner(null);
    setPendingWinner(null);
    setSwitchModeConfirm(null);
    setResetConfirm(false);
    setPhase('idle');
    setRotation(0);
    rotationRef.current = 0;
    onReroll?.();
  };

  const handleWheelTypeClick = (m: WheelType) => {
    if (m === wheelType) return;
    if (isDirty) {
      setSwitchModeConfirm(m);
      return;
    }
    applyWheelType(m);
  };

  const applyWheelType = (m: WheelType) => {
    setWheelType(m);
    setShuffledLots(shuffle(validLots));
    setEliminatedIds(new Set());
    setEliminationComplete(false);
    setEliminatedModal(null);
    setWinner(null);
    setPendingWinner(null);
    setSwitchModeConfirm(null);
    setResetConfirm(false);
    setPhase('idle');
    setRotation(0);
    rotationRef.current = 0;
  };

  const handleSpinOrReset = () => {
    if (eliminationComplete) {
      setResetConfirm(true);
    } else {
      handleSpin();
    }
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '' || /^[0-9]*[.,]?[0-9]*$/.test(raw)) {
      setDurationStr(raw);
      setDurationFromPreset(false);
    }
  };

  const formatDuration = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (validLots.length === 0) {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center">
        <div
          className="relative flex items-center justify-center overflow-hidden rounded-full"
          style={{ width: 'min(82vw, 820px, calc(100vh - 320px))', height: 'min(82vw, 820px, calc(100vh - 320px))' }}
        >
          <svg viewBox={`${-HALF} ${-HALF} ${SIZE} ${SIZE}`} className="absolute inset-0 h-full w-full">
            <defs>
              <radialGradient id="aw-empty-shade" cx="50%" cy="50%" r="50%">
                <stop offset="55%" stopColor="rgba(0,0,0,0)" />
                <stop offset="100%" stopColor={isLight ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.35)'} />
              </radialGradient>
            </defs>
            <circle cx={0} cy={0} r={RADIUS} fill={isLight ? '#d8d8e0' : '#1e2235'} />
            <circle cx={0} cy={0} r={RADIUS - 0.5} fill="none" stroke="rgba(var(--accent-rgb),0.28)" strokeWidth={2.5} />
            <circle cx={0} cy={0} r={RADIUS - 4} fill="none" stroke={isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'} strokeWidth={1} />
            <circle cx={0} cy={0} r={RADIUS} fill="url(#aw-empty-shade)" />
          </svg>
          <div className="relative z-10 max-w-[60%] text-center">
            <RotateCw className="mx-auto mb-4 h-10 w-10 text-ink-600" strokeWidth={1.5} />
            <p className="text-sm font-medium text-ink-500">{t('auction_wheel_empty')}</p>
          </div>
        </div>
      </div>
    );
  }

  const dimmed = hoveredIdx !== null && phase === 'idle';
  const canSpin = phase !== 'spinning' && !(wheelType === 'elimination' && (!!winner || !!pendingWinner) && !eliminationComplete);
  const idle = phase === 'idle';



  return (
    <div className="flex flex-1 min-h-0 gap-6">
      {/* Lot list — fixed on the left, tracks sidebar width */}
      <div
        className="fixed z-30 hidden w-72 flex-col gap-2 md:flex"
        style={{ top: '5rem', left: sidebarCollapsed ? '84px' : '256px', transition: 'left 600ms cubic-bezier(0.22,1,0.36,1)' }}
      >
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-500">{t('auction_wheel_lots')}</h4>
          {wheelType === 'elimination' && eliminatedList.length > 0 && (
            <button
              onClick={() => setHideEliminated((v) => !v)}
              title={hideEliminated ? t('show_eliminated') : t('hide_eliminated')}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-ink-800 bg-ink-900/50 text-ink-500 transition hover:border-ink-700 hover:text-ink-300"
            >
              {hideEliminated ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            </button>
          )}
        </div>
        <div className="flex max-h-[calc(100vh-160px)] flex-col gap-2 overflow-y-auto pr-1.5">
          {[...validLots].sort((a, b) => b.price - a.price).map((lot) => {
            const isEliminated = eliminatedIds.has(lot.id);
            const seg = segments.find((s) => s.lot.id === lot.id);
            const i = seg ? segments.indexOf(seg) : -1;
            const isHovered = hoveredIdx === i;
            if (isEliminated && hideEliminated) return null;
            if (isEliminated) {
              return (
                <div
                  key={lot.id}
                  className="flex items-center gap-3 rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2.5 opacity-60"
                >
                  <X className="h-3.5 w-3.5 shrink-0 text-red-400/60" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-500 line-through">
                    {lot.name || `#${lot.order + 1}`}
                  </span>
                  <span className="w-16 shrink-0 text-right text-xs tabular-nums text-ink-600">{lot.price}{t('currency_symbol')}</span>
                  <span className="w-14 shrink-0 text-right text-xs font-bold tabular-nums text-red-400/50">
                    —
                  </span>
                </div>
              );
            }
            const weight = seg ? seg.weight : 0;
            const winPct = weight * 100;
            return (
              <button
                key={lot.id}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors duration-200 ${
                  isHovered
                    ? 'border-accent-500/60 bg-accent-500/10'
                    : 'border-ink-800 bg-ink-900/50 hover:border-ink-700 hover:bg-ink-800'
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-200">
                  {lot.name || `#${lot.order + 1}`}
                </span>
                <span className="w-16 shrink-0 text-right text-xs font-medium tabular-nums text-ink-400">
                  {lot.price}{t('currency_symbol')}
                </span>
                <span className="w-14 shrink-0 text-right text-xs font-bold tabular-nums text-accent-400">
                  {winPct.toFixed(2)}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fixed settings panel — top right */}
      <div className="fixed right-4 top-20 z-50 md:right-6">
        <div className="w-72 rounded-xl border border-ink-700 bg-ink-900/60 p-5 shadow-2xl backdrop-blur-md">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-ink-500">{t('spin_menu')}</p>

          <div className="mb-4 flex flex-col gap-2">
            <span className="text-xs font-medium text-ink-400">{t('wheel_type')}</span>
            <div className="flex gap-2">
              {(['normal', 'elimination'] as WheelType[]).map((m) => (
                <button
                  key={m}
                  onClick={() => handleWheelTypeClick(m)}
                  disabled={phase === 'spinning'}
                  className={`flex h-[42px] flex-1 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition disabled:opacity-50 ${
                    wheelType === m
                      ? 'border-accent-500/50 bg-accent-500/15 text-accent-300'
                      : 'border-ink-800 bg-ink-950 text-ink-400 hover:text-ink-200'
                  }`}
                >
                  {m === 'normal' ? t('wheel_normal') : t('wheel_elimination')}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-400">
              <Clock className="h-3.5 w-3.5 text-accent-400" />
              {t('spin_duration')}
            </div>
            <div className="flex flex-nowrap items-center gap-2 overflow-hidden">
              {[5, 15].map((s) => (
                <button
                  key={s}
                  onClick={() => { setDurationStr(String(s)); setDurationFromPreset(true); }}
                  disabled={phase === 'spinning'}
                  className={`flex h-[42px] shrink-0 items-center rounded-lg border border-ink-800 px-3 text-sm font-semibold transition disabled:opacity-50 ${
                    durationFromPreset && durationStr === String(s)
                      ? 'border-accent-500/50 bg-accent-500/15 text-accent-300'
                      : 'bg-ink-950 text-ink-400 hover:text-ink-200'
                  }`}
                >
                  {formatDuration(s)}
                </button>
              ))}
              <input
                type="text"
                inputMode="decimal"
                value={durationFromPreset ? '' : durationStr}
                onChange={handleDurationChange}
                disabled={phase === 'spinning'}
                placeholder={t('spin_custom_seconds')}
                className="h-[42px] min-w-0 flex-1 rounded-lg border border-ink-800 bg-ink-950 px-3 text-sm text-ink-200 placeholder:text-ink-600 focus:border-accent-500 focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-2">
            <span className="text-xs font-medium text-ink-400">{t('animation')}</span>
            <div className="flex gap-2">
              {(['normal', 'spicy'] as AnimMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setAnimMode(m)}
                  disabled={phase === 'spinning'}
                  className={`flex h-[42px] flex-1 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition disabled:opacity-50 ${
                    animMode === m
                      ? 'border-accent-500/50 bg-accent-500/15 text-accent-300'
                      : 'border-ink-800 bg-ink-950 text-ink-400 hover:text-ink-200'
                  }`}
                >
                  {m === 'normal' ? t('anim_normal') : t('anim_spicy')}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSpinOrReset}
            disabled={!canSpin}
            className="flex h-[42px] w-full items-center justify-center gap-2 rounded-lg border border-ink-700 bg-ink-800/60 px-4 text-sm font-semibold text-ink-100 transition hover:bg-ink-700/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {phase === 'spinning' ? t('spinning') : eliminationComplete ? t('start_over') : t('spin')}
          </button>
        </div>
      </div>

      {/* Main column — wheel */}
      <div className="relative flex min-w-0 flex-1 flex-col items-center justify-center">
        <div
          className={`relative overflow-hidden rounded-full transition-shadow duration-700 ${idle ? 'idle-glow' : ''}`}
          style={{ width: 'min(82vw, 820px, calc(100vh - 320px))', height: 'min(82vw, 820px, calc(100vh - 320px))' }}
        >
          {/* Pointer */}
          <div className="absolute left-1/2 top-[-14px] z-30 -translate-x-1/2 drop-shadow-[0_0_10px_rgba(var(--accent-rgb),0.9)]">
            <div className="h-0 w-0 border-l-[13px] border-r-[13px] border-t-[26px] border-l-transparent border-r-transparent border-t-accent-400" />
          </div>

          {/* Rotating wheel */}
          <div
            ref={wheelRef}
            className="absolute inset-0"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <svg viewBox={`${-HALF} ${-HALF} ${SIZE} ${SIZE}`} className="h-full w-full">
              <defs>
                {displayed.map((d) => {
                  const seg = segByLotId.get(d.key);
                  if (!seg) return null;
                  const origIdx = validLots.indexOf(seg.lot);
                  const c = PALETTE[origIdx % PALETTE.length];
                  return (
                    <radialGradient key={d.key} id={`aw-s${d.key}`} cx="35%" cy="35%" r="80%">
                      <stop offset="0%" stopColor={c.b} />
                      <stop offset="100%" stopColor={c.a} />
                    </radialGradient>
                  );
                })}
                <radialGradient id="aw-center-shade" cx="50%" cy="50%" r="50%">
                  <stop offset="55%" stopColor="rgba(0,0,0,0)" />
                  <stop offset="100%" stopColor={isLight ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.35)'} />
                </radialGradient>
              </defs>

              {/* Background disc — hides gaps during sector redistribution */}
              <circle cx={0} cy={0} r={RADIUS} fill={isLight ? '#d8d8e0' : '#1e2235'} />

              {/* Weighted sectors */}
              {displayed.map((d) => {
                const seg = segByLotId.get(d.key);
                if (!seg) return null;
                const origIdx = validLots.indexOf(seg.lot);
                const isHovered = hoveredIdx === origIdx;
                const isDimmed = dimmed && !isHovered;
                return (
                  <path
                    key={d.key}
                    d={arcPathForAngles(d.start, d.end, RADIUS)}
                    fill={`url(#aw-s${d.key})`}
                    stroke={isLight ? 'rgba(0,0,0,0.08)' : 'rgba(var(--accent-rgb),0.10)'}
                    style={{
                      transition: 'filter 0.3s ease',
                      filter: isDimmed ? 'grayscale(1) brightness(0.5)' : isHovered ? 'brightness(1.15)' : 'none',
                      opacity: d.exiting ? d.opacity : isDimmed ? 0.4 : 1,
                    }}
                    className={d.exiting ? 'elim-flash' : ''}
                  />
                );
              })}

              {/* Divider lines */}
              {activeCount > 1 && displayed.filter((d) => !d.exiting).map((d) => {
                const [lx, ly] = polar(d.start, RADIUS);
                return (
                  <line key={`d${d.key}`} x1={0} y1={0} x2={lx} y2={ly} stroke={isLight ? 'rgba(0,0,0,0.06)' : 'rgba(var(--accent-rgb),0.10)'} strokeWidth={1} />
                );
              })}

              {/* Outer rim */}
              <circle cx={0} cy={0} r={RADIUS - 0.5} fill="none" stroke="rgba(var(--accent-rgb),0.28)" strokeWidth={2.5} />
              <circle cx={0} cy={0} r={RADIUS - 4} fill="none" stroke={isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'} strokeWidth={1} />

              {/* Inner shading */}
              <circle cx={0} cy={0} r={RADIUS} fill="url(#aw-center-shade)" />

              {/* Lot labels */}
              {displayed.map((d) => {
                const seg = segByLotId.get(d.key);
                if (!seg) return null;
                const mid = (d.start + d.end) / 2;
                const [cx, cy] = polar(mid, LABEL_RADIUS);
                const fontSize = Math.max(11, Math.min(22, seg.weight * 56 + 10));
                const origIdx = validLots.indexOf(seg.lot);
                const isHovered = hoveredIdx === origIdx;
                const isDimmed = dimmed && !isHovered;
                const segAngle = d.end - d.start;
                const arcWidth = 2 * LABEL_RADIUS * Math.sin((Math.min(segAngle, 180) * Math.PI) / 360);
                const labelText = seg.lot.name || `#${seg.lot.order + 1}`;
                const textWidth = fontSize * 0.55 * labelText.length;
                const showLabel = textWidth <= arcWidth * 0.92;
                return (
                  <text
                    key={`l${d.key}`}
                    x={cx}
                    y={cy}
                    fill={isLight ? '#1a1a2e' : '#f0f0f8'}
                    fontSize={fontSize}
                    fontWeight="700"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{
                      pointerEvents: 'none',
                      opacity: d.exiting ? d.opacity : !showLabel ? 0 : isDimmed ? 0.3 : 1,
                    }}
                  >
                    {labelText}
                  </text>
                );
              })}
            </svg>
          </div>

          {/* Center hub */}
          <div className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
            <div className="absolute -inset-3 rounded-full bg-accent-500/15 blur-xl" />
            <button
              onClick={handleSpinOrReset}
              disabled={!canSpin}
              aria-label={eliminationComplete ? t('start_over') : t('spin')}
              className={`relative flex h-20 w-20 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-300 focus:outline-none ${
                phase === 'spinning'
                  ? 'spin-pulse cursor-default border-accent-400/50 bg-ink-800 text-accent-300'
                  : 'border-ink-700 bg-ink-800 text-accent-300 shadow-[0_0_18px_rgba(var(--accent-rgb),0.3),inset_0_1px_0_rgba(255,255,255,0.05)] hover:scale-105 hover:border-accent-500/60 hover:bg-accent-500/15 hover:text-accent-200 hover:shadow-[0_0_26px_rgba(var(--accent-rgb),0.5)] active:scale-95'
              }`}
            >
              {eliminationComplete ? <RefreshCw className="h-7 w-7" /> : <RotateCw className="h-8 w-8" strokeWidth={2} />}
            </button>
          </div>
        </div>

        {/* Eliminated lot modal */}
        {eliminatedModal && !eliminationComplete && (
          <div
            className="animate-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 p-4 backdrop-blur-sm"
            onClick={handleNextSpin}
          >
            <div
              className="animate-modal-in relative w-full max-w-md rounded-2xl border border-red-900/50 bg-ink-900/80 p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-5 flex flex-col items-center text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-red-400">
                  {t('auction_wheel_eliminated_title')}
                </p>
                <h3 className="mt-1 text-2xl font-extrabold text-ink-100 line-through decoration-red-500/60">
                  {eliminatedModal.name || `#${eliminatedModal.order + 1}`}
                </h3>
                <p className="mt-1 text-sm text-ink-500">{eliminatedModal.price} {t('currency_symbol')}</p>
              </div>
              <button
                onClick={handleNextSpin}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-4 py-3 text-sm font-medium text-ink-300 transition hover:bg-ink-700 hover:text-ink-100"
              >
                {pendingWinner ? (
                  <>
                    <Trophy className="h-4 w-4" />
                    {t('go_to_winner')}
                  </>
                ) : (
                  t('next_spin')
                )}
              </button>
            </div>
          </div>
        )}

        {/* Reset / switch mode confirmation */}
        {(switchModeConfirm || resetConfirm) && (
          <div
            className="animate-backdrop-in fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
            onClick={() => { setSwitchModeConfirm(null); setResetConfirm(false); }}
          >
            <div
              className="animate-modal-in relative w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-2 text-center text-lg font-bold text-ink-100">
                {resetConfirm ? t('reset_wheel_title') : t('switch_mode_title')}
              </h3>
              <p className="mb-6 text-center text-sm text-ink-400">
                {t('switch_mode_desc')}
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { if (resetConfirm) { handleReroll(); } else if (switchModeConfirm) { applyWheelType(switchModeConfirm); } }}
                  className="w-full rounded-lg bg-accent-500 px-4 py-3 text-sm font-bold text-ink-100 shadow-lg transition hover:bg-accent-400"
                >
                  {t('confirm')}
                </button>
                <button
                  onClick={() => { setSwitchModeConfirm(null); setResetConfirm(false); }}
                  className="w-full rounded-lg border border-ink-700 bg-ink-800 px-4 py-3 text-sm font-medium text-ink-300 transition hover:bg-ink-700 hover:text-ink-100"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Winner modal */}
        {winner && (
          <div
            className="animate-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
            onClick={handleReroll}
          >
            <div
              className="animate-modal-in relative w-full max-w-md rounded-2xl border border-accent-500/50 bg-ink-900 p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-5 flex flex-col items-center text-center">
                <div className="mb-1 flex items-center gap-2 text-accent-400">
                  <Trophy className="h-5 w-5" />
                  <span className="text-xs font-semibold uppercase tracking-[0.2em]">
                    {t('auction_wheel_winner')}
                  </span>
                </div>
                <h3 className="text-2xl font-extrabold text-ink-100">
                  {winner.name || `#${winner.order + 1}`}
                </h3>
                <p className="mt-1 text-sm text-ink-400">{winner.price} {t('currency_symbol')}</p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleConfirmWinner}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-500 px-4 py-3 text-sm font-bold text-ink-100 shadow-lg transition hover:bg-accent-400"
                >
                  <Check className="h-4 w-4" />
                  {t('auction_wheel_confirm_winner')}
                </button>
                <button
                  onClick={handleReroll}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-4 py-3 text-sm font-medium text-ink-300 transition hover:bg-ink-700 hover:text-ink-100"
                >
                  <RefreshCw className="h-4 w-4" />
                  {t('reroll')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
