import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, HelpCircle, RotateCw, Trophy, RefreshCw, Check } from 'lucide-react';
import { type ProCrosshair } from '@/data/proCrosshairs';
import { CrosshairCodePreview } from './CrosshairPreview';
import { type Crosshair } from 'csgo-sharecode';
import { useI18n } from '@/i18n';
import { useSettings } from '@/lib/settings';
import {
  decodeSafe,
  DetailModal,
  RandomReveal,
  type DetailItem,
} from './rouletteShared';
import { randomCrosshairCode } from '@/lib/randomCrosshair';

interface WheelRouletteProps {
  items: ProCrosshair[];
  onWin: (player: string, code: string, crosshair: Crosshair) => void;
  history: { player: string; code: string }[];
  includeRandom: boolean;
  sidebarCollapsed: boolean;
}

type Phase = 'idle' | 'spinning' | 'result';
type AnimMode = 'normal' | 'spicy';
type WheelType = 'normal' | 'elimination';

interface Sector {
  index: number;
  player: string;
  code: string;
  isRandom?: boolean;
}

const SIZE = 600;
const HALF = SIZE / 2;
const RADIUS = HALF - 1;
const IMG_RADIUS = 248;
const DEFAULT_DURATION = 10;

const PALETTE_DARK = [
  { a: '#1e2235', b: '#262d44' },
  { a: '#1a242e', b: '#223038' },
  { a: '#221e30', b: '#2e2840' },
  { a: '#1d2622', b: '#263330' },
  { a: '#241e2a', b: '#322840' },
  { a: '#1f2128', b: '#292b38' },
];

const PALETTE_LIGHT = [
  { a: '#c8c8d0', b: '#d8d8e0' },
  { a: '#c0c4cc', b: '#d0d4dc' },
  { a: '#ccc4d0', b: '#dccedc' },
  { a: '#c4ccc4', b: '#d4dcd4' },
  { a: '#ccc8c8', b: '#dcd8d8' },
  { a: '#c4c4cc', b: '#d4d4dc' },
];

function polar(deg: number, r: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [r * Math.cos(rad), r * Math.sin(rad)];
}

function arcPath(i: number, seg: number): string {
  const a1 = i * seg;
  const a2 = (i + 1) * seg;
  const [x1, y1] = polar(a1, RADIUS);
  const [x2, y2] = polar(a2, RADIUS);
  const large = seg > 180 ? 1 : 0;
  return `M 0 0 L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${x2} ${y2} Z`;
}

function imgSizeFor(segDeg: number): number {
  if (segDeg >= 360) return 220;
  const rad = (segDeg * Math.PI) / 180;
  const arcW = 2 * IMG_RADIUS * Math.sin(rad / 2);
  const maxByEdge = 2 * (RADIUS - IMG_RADIUS - 2);
  return Math.max(34, Math.min(132, arcW * 0.92, maxByEdge));
}

export function WheelRoulette({ items, onWin, history, includeRandom, sidebarCollapsed }: WheelRouletteProps) {
  const { t } = useI18n();
  const { prefs } = useSettings();
  const isLight = prefs.theme === 'light';
  const PALETTE = isLight ? PALETTE_LIGHT : PALETTE_DARK;

  const fullSectors = useMemo<Sector[]>(() => {
    const base: Sector[] = items.map((p, i) => ({ index: i, player: p.player, code: p.code }));
    if (includeRandom) {
      const r = randomCrosshairCode();
      if (r.code) base.push({ index: base.length, player: '', code: r.code, isRandom: true });
    }
    return base;
  }, [items, includeRandom]);

  const [wheelType, setWheelType] = useState<WheelType>('normal');
  const [activeSectors, setActiveSectors] = useState<Sector[]>(fullSectors);
  const [eliminated, setEliminated] = useState<Sector[]>([]);
  const [winner, setWinner] = useState<Sector | null>(null);
  const [pendingWinner, setPendingWinner] = useState<Sector | null>(null);
  const [eliminatedModal, setEliminatedModal] = useState<Sector | null>(null);
  const [switchModeConfirm, setSwitchModeConfirm] = useState<WheelType | null>(null);
  const [eliminationComplete, setEliminationComplete] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  useEffect(() => {
    setActiveSectors(fullSectors);
    setEliminated([]);
    setWinner(null);
    setEliminatedModal(null);
    setEliminationComplete(false);
    setResetConfirm(false);
    setPhase('idle');
    setRotation(0);
    rotationRef.current = 0;
  }, [fullSectors]);

  const sectors = activeSectors;
  const N = sectors.length;
  const seg = 360 / Math.max(N, 1);
  const imgSize = imgSizeFor(seg);

  const [phase, setPhase] = useState<Phase>('idle');
  const [rotation, setRotation] = useState(0);
  const [durationStr, setDurationStr] = useState(String(DEFAULT_DURATION));
  const [durationFromPreset, setDurationFromPreset] = useState(true);
  const [animMode, setAnimMode] = useState<AnimMode>('normal');
  const [detail, setDetail] = useState<DetailItem | null>(null);
  const [randomReveal, setRandomReveal] = useState<DetailItem | null>(null);

  const wheelRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);
  const rotationRef = useRef(0);
  const idleRef = useRef<Animation | null>(null);
  const spinIconRef = useRef<SVGSVGElement>(null);
  const iconAnimRef = useRef<Animation | null>(null);

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
    if (phase === 'spinning' || N === 0 || !wheelRef.current) return;
    setPhase('spinning');
    setDetail(null);
    idleRef.current?.cancel();

    const w = Math.floor(Math.random() * N);
    const jitter = (Math.random() - 0.5) * seg * 0.7;
    const thetaW = w * seg + seg / 2 + jitter;
    const fullSpins = 5 + Math.floor(Math.random() * 5);
    const targetMod = (360 - thetaW + 360) % 360;
    const currentMod = ((rotationRef.current % 360) + 360) % 360;
    const delta = (targetMod - currentMod + 360) % 360;
    const startRot = rotationRef.current;
    const finalRot = startRot + 360 * fullSpins + delta;
    rotationRef.current = finalRot;
    const total = finalRot - startRot;

    animRef.current?.cancel();
    iconAnimRef.current?.cancel();

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

    if (spinIconRef.current) {
      iconAnimRef.current = spinIconRef.current.animate(keyframes, { duration: dur, easing, fill: 'forwards' });
    }

    const winItem = sectors[w];
    const ch = decodeSafe(winItem.code);

    const finish = () => {
      if (animRef.current === anim) {
        try { anim.commitStyles(); } catch {}
        anim.cancel();
        animRef.current = null;
      }
      if (iconAnimRef.current) {
        try { iconAnimRef.current.commitStyles(); } catch {}
        iconAnimRef.current.cancel();
        iconAnimRef.current = null;
      }
      if (spinIconRef.current) spinIconRef.current.style.transform = `rotate(${finalRot}deg)`;
      setRotation(finalRot);
      setPhase('result');
      onWin(winItem.isRandom ? t('random_player') : winItem.player, winItem.code, ch);

      window.setTimeout(() => {
        if (wheelType === 'elimination') {
          // The landed sector is eliminated (removed from the wheel)
          const remaining = activeSectors.filter((s) => s.index !== winItem.index);
          setEliminated((prev) => [...prev, winItem]);
          setEliminatedModal(winItem);
          if (remaining.length <= 1) {
            // Last one standing is the winner — defer until eliminated modal dismissed
            setPendingWinner(remaining[0] ?? winItem);
          } else {
            setActiveSectors(remaining);
          }
        } else {
          if (winItem.isRandom) setRandomReveal({ player: t('random_player'), code: winItem.code, crosshair: ch });
          else setDetail({ player: winItem.player, code: winItem.code, crosshair: ch });
        }
      }, 300);
    };

    anim.onfinish = finish;
    window.setTimeout(() => {
      setPhase((p) => { if (p === 'spinning') { finish(); return 'result'; } return p; });
    }, dur + 250);
  }, [phase, onWin, sectors, N, seg, durationStr, animMode, wheelType, activeSectors.length]);

  const handleConfirmWinner = () => {
    if (!winner) return;
    const ch = decodeSafe(winner.code);
    setDetail({ player: winner.isRandom ? t('random_player') : winner.player, code: winner.code, crosshair: ch });
    setActiveSectors([winner]);
    setWinner(null);
    setEliminationComplete(true);
  };

  const handleNextSpin = () => {
    setEliminatedModal(null);
    if (pendingWinner) {
      setWinner(pendingWinner);
      setPendingWinner(null);
      return;
    }
    setPhase('idle');
    setRotation(0);
    rotationRef.current = 0;
  };

  const handleReroll = () => {
    setActiveSectors(fullSectors);
    setEliminated([]);
    setWinner(null);
    setPendingWinner(null);
    setEliminatedModal(null);
    setSwitchModeConfirm(null);
    setEliminationComplete(false);
    setResetConfirm(false);
    setPhase('idle');
    setRotation(0);
    rotationRef.current = 0;
  };

  const handleWheelTypeClick = (m: WheelType) => {
    if (wheelType === m) return;
    // Switching away from elimination with progress: confirm first
    if (wheelType === 'elimination' && (eliminated.length > 0 || phase !== 'idle')) {
      setSwitchModeConfirm(m);
      return;
    }
    applyWheelType(m);
  };

  const applyWheelType = (m: WheelType) => {
    setWheelType(m);
    setActiveSectors(fullSectors);
    setEliminated([]);
    setWinner(null);
    setPendingWinner(null);
    setEliminatedModal(null);
    setSwitchModeConfirm(null);
    setEliminationComplete(false);
    setResetConfirm(false);
    setPhase('idle');
    setRotation(0);
    rotationRef.current = 0;
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

  const handleSpinOrReset = () => {
    if (eliminationComplete) {
      setResetConfirm(true);
    } else {
      handleSpin();
    }
  };

  const idle = phase === 'idle';
  return (
    <div className="flex flex-1 min-h-0 gap-6">
      {/* Fixed settings panel — top right */}
      <div className="fixed right-4 top-20 z-50 md:right-6">
          <div className="w-80 rounded-xl border border-ink-700 bg-ink-900/60 p-5 shadow-2xl backdrop-blur-md">
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
              onClick={eliminationComplete ? () => setResetConfirm(true) : handleSpin}
              disabled={phase === 'spinning' || (wheelType === 'elimination' && (!!winner || !!pendingWinner) && !eliminationComplete)}
              className="flex h-[42px] w-full items-center justify-center gap-2 rounded-lg border border-ink-700 bg-ink-800/60 px-4 text-sm font-semibold text-ink-100 transition hover:bg-ink-700/60 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {phase === 'spinning' ? t('spinning') : eliminationComplete ? t('start_over') : t('spin')}
            </button>
          </div>
      </div>

      {/* History — fixed on the left, tracks sidebar width, same top offset as settings panel */}
      {history.length > 0 && (
        <div
          className="fixed z-30 hidden w-44 flex-col gap-2 md:flex"
          style={{ top: '5rem', left: sidebarCollapsed ? '84px' : '256px', transition: 'left 600ms cubic-bezier(0.22,1,0.36,1)' }}
        >
          <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-500">{t('recent_wins')}</h4>
          <div className="flex max-h-[calc(100vh-280px)] flex-col gap-2 overflow-y-auto">
            {history.slice(0, 10).map((h, i) => (
              <button
                key={i}
                onClick={() => setDetail({ player: h.player, code: h.code, crosshair: decodeSafe(h.code) })}
                className="flex items-center gap-2.5 rounded-lg border border-ink-800 bg-ink-900/50 px-2.5 py-2 transition hover:border-accent-500/50 hover:bg-ink-800"
              >
                <CrosshairCodePreview code={h.code} className="h-9 w-9 shrink-0" background="transparent" />
                <span className="min-w-0 truncate text-sm font-medium text-ink-300">{h.player}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Main column — wheel + eliminated */}
      <div className="relative flex min-w-0 flex-1 flex-col gap-4">
      {/* Wheel */}
      <div className="flex flex-1 min-h-0 items-center justify-center">
        <div
          className={`relative overflow-hidden rounded-full transition-shadow duration-700 ${idle ? 'idle-glow' : ''}`}
          style={{ width: 'min(82vw, 820px, calc(100vh - 260px))', height: 'min(82vw, 820px, calc(100vh - 260px))' }}
        >
          {/* Pointer */}
          <div className="absolute left-1/2 top-[-14px] z-30 -translate-x-1/2 drop-shadow-[0_0_10px_rgba(var(--accent-rgb),0.9)]">
            <div className="h-0 w-0 border-l-[13px] border-r-[13px] border-t-[26px] border-l-transparent border-r-transparent border-t-accent-400" />
          </div>

          {/* Rotating wheel — pure SVG, sectors reach the very edge */}
          <div
            ref={wheelRef}
            className="absolute inset-0"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <svg viewBox={`${-HALF} ${-HALF} ${SIZE} ${SIZE}`} className="h-full w-full">
              <defs>
                {sectors.map((_, i) => {
                  const c = PALETTE[i % PALETTE.length];
                  return (
                    <radialGradient key={i} id={`s${i}`} cx="35%" cy="35%" r="80%">
                      <stop offset="0%" stopColor={c.b} />
                      <stop offset="100%" stopColor={c.a} />
                    </radialGradient>
                  );
                })}
                <radialGradient id="center-shade" cx="50%" cy="50%" r="50%">
                  <stop offset="55%" stopColor="rgba(0,0,0,0)" />
                  <stop offset="100%" stopColor={isLight ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.35)'} />
                </radialGradient>
              </defs>

              {/* Sectors — fill the entire circle */}
              {sectors.map((_, i) => (
                <path
                  key={i}
                  d={arcPath(i, seg)}
                  fill={`url(#s${i})`}
                  stroke={isLight ? 'rgba(0,0,0,0.08)' : 'rgba(var(--accent-rgb),0.10)'}
                />
              ))}

              {/* Divider lines */}
              {N > 1 && sectors.map((_, i) => {
                const [lx, ly] = polar(i * seg, RADIUS);
                return (
                  <line key={`d${i}`} x1={0} y1={0} x2={lx} y2={ly} stroke={isLight ? 'rgba(0,0,0,0.06)' : 'rgba(var(--accent-rgb),0.10)'} strokeWidth={1} />
                );
              })}

              {/* Outer rim — subtle double stroke for volume */}
              <circle cx={0} cy={0} r={RADIUS - 0.5} fill="none" stroke="rgba(var(--accent-rgb),0.28)" strokeWidth={2.5} />
              <circle cx={0} cy={0} r={RADIUS - 4} fill="none" stroke={isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'} strokeWidth={1} />

              {/* Subtle inner shading for depth */}
              <circle cx={0} cy={0} r={RADIUS} fill="url(#center-shade)" />

              {/* Crosshair previews */}
              {sectors.map((s, i) => {
                const am = i * seg + seg / 2;
                const [cx, cy] = N === 1 ? [0, 0] : polar(am, IMG_RADIUS);
                const half = imgSize / 2;
                return (
                  <foreignObject key={`i${i}`} x={cx - half} y={cy - half} width={imgSize} height={imgSize} style={{ overflow: 'visible' }}>
                    {s.isRandom ? (
                      <div className="flex h-full w-full items-center justify-center">
                        <HelpCircle style={{ width: imgSize * 0.45, height: imgSize * 0.45 }} className="text-accent-400/70" strokeWidth={1.5} />
                      </div>
                    ) : (
                      <CrosshairCodePreview code={s.code} className="h-full w-full" background="transparent" />
                    )}
                  </foreignObject>
                );
              })}
            </svg>
          </div>

          {/* Center hub */}
          <div className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
            <div className="absolute -inset-3 rounded-full bg-accent-500/15 blur-xl" />
            <button
              onClick={handleSpinOrReset}
              disabled={phase === 'spinning' || (wheelType === 'elimination' && (!!winner || !!pendingWinner) && !eliminationComplete)}
              aria-label={eliminationComplete ? t('start_over') : t('spin')}
              className={`relative flex h-20 w-20 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-300 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none ${
                phase === 'spinning'
                  ? 'spin-pulse cursor-default border-accent-400/50 bg-ink-800 text-accent-300'
                  : 'border-ink-700 bg-ink-800 text-accent-300 shadow-[0_0_18px_rgba(var(--accent-rgb),0.3),inset_0_1px_0_rgba(255,255,255,0.05)] hover:scale-105 hover:border-accent-500/60 hover:bg-accent-500/15 hover:text-accent-200 hover:shadow-[0_0_26px_rgba(var(--accent-rgb),0.5)] active:scale-95'
              }`}
            >
              <RotateCw ref={spinIconRef} className="h-8 w-8" strokeWidth={2} style={{ transform: `rotate(${rotation}deg)` }} />
            </button>
          </div>
        </div>
      </div>


      {detail && <DetailModal item={detail} onClose={() => setDetail(null)} />}
      {randomReveal && (
        <RandomReveal finalCode={randomReveal.code} onComplete={() => { setDetail(randomReveal); setRandomReveal(null); }} />
      )}

      {/* Eliminated crosshair modal */}
      {eliminatedModal && (
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
                {t('eliminated_title')}
              </p>
              <h3 className="mt-1 text-2xl font-extrabold text-ink-100 line-through decoration-red-500/60">
                {eliminatedModal.isRandom ? t('random_player') : eliminatedModal.player}
              </h3>
            </div>
            <div className="relative mx-auto mb-6 flex h-44 w-44 items-center justify-center rounded-xl border border-ink-800 bg-ink-850">
              <CrosshairCodePreview
                code={eliminatedModal.code}
                className="h-full w-full opacity-40"
                background="dark"
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
                  <line x1="8" y1="8" x2="92" y2="92" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
                  <line x1="92" y1="8" x2="8" y2="92" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
                </svg>
              </div>
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
          className="animate-backdrop-in absolute inset-0 z-[60] flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
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
          className="animate-backdrop-in absolute inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
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
                  {t('winner')}
                </span>
              </div>
              <h3 className="text-2xl font-extrabold text-ink-100">
                {winner.isRandom ? t('random_player') : winner.player}
              </h3>
            </div>
            <div className="relative mx-auto mb-6 flex h-44 w-44 items-center justify-center rounded-xl border border-accent-500/30 bg-ink-850">
              <div className="absolute -inset-2 rounded-xl bg-accent-500/15 blur-xl" />
              <CrosshairCodePreview
                code={winner.code}
                className="relative h-full w-full"
                background="dark"
              />
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleConfirmWinner}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-500 px-4 py-3 text-sm font-bold text-ink-100 shadow-lg transition hover:bg-accent-400"
              >
                <Check className="h-4 w-4" />
                {t('confirm_winner')}
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
