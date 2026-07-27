import { useState, useEffect, useRef } from 'react';
import { X, Sparkles } from 'lucide-react';
import { decodeCrosshairShareCode, type Crosshair } from 'csgo-sharecode';
import { CrosshairCodePreview } from './CrosshairPreview';
import { useI18n } from '@/i18n';
import { randomCrosshairCode } from '@/lib/randomCrosshair';

export type DetailItem = { player: string; code: string; crosshair: Crosshair };

export interface RouletteItem {
  player: string;
  code: string;
  isRandom?: boolean;
}

export function decodeSafe(code: string): Crosshair {
  try {
    return decodeCrosshairShareCode(code);
  } catch {
    return {
      gap: -2, outline: 1, red: 0, green: 255, blue: 0, alpha: 255,
      splitDistance: 3, followRecoil: false, fixedCrosshairGap: 3, color: 4,
      outlineEnabled: false, innerSplitAlpha: 0.1, outerSplitAlpha: 1,
      splitSizeRatio: 1, thickness: 1, centerDotEnabled: false,
      deployedWeaponGapEnabled: false, alphaEnabled: false, tStyleEnabled: false,
      style: 4, length: 4,
    };
  }
}

export function buildConVars(ch: Crosshair): string {
  return [
    `cl_crosshairstyle "${ch.style}"`,
    `cl_crosshairsize "${ch.length}"`,
    `cl_crosshairthickness "${ch.thickness}"`,
    `cl_crosshairgap "${ch.gap}"`,
    `cl_crosshair_drawoutline "${ch.outlineEnabled ? 1 : 0}"`,
    `cl_crosshair_outlinethickness "${ch.outline}"`,
    `cl_crosshaircolor "${ch.color}"`,
    `cl_crosshaircolor_r "${ch.red}"`,
    `cl_crosshaircolor_g "${ch.green}"`,
    `cl_crosshaircolor_b "${ch.blue}"`,
    `cl_crosshairalpha "${ch.alpha}"`,
    `cl_crosshairusealpha "${ch.alphaEnabled ? 1 : 0}"`,
    `cl_crosshair_t "${ch.tStyleEnabled ? 1 : 0}"`,
    `cl_crosshairdot "${ch.centerDotEnabled ? 1 : 0}"`,
  ].join('\n');
}

export function CopyField({
  label,
  value,
  multiline,
  t,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  t: (k: string) => string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex w-full flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wider text-ink-500">
        {label}
      </span>
      <div className="flex w-full items-stretch gap-2">
          <code
          className={`min-w-0 flex-1 rounded-lg border border-ink-800 bg-ink-950 px-3 py-2 font-mono text-sm text-accent-400 ${
            multiline
              ? 'max-h-56 overflow-y-auto whitespace-pre break-words'
              : 'whitespace-pre-wrap break-all'
          }`}
        >
          {value}
        </code>
        <button
          onClick={handleCopy}
          className="shrink-0 self-start rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm font-medium text-ink-300 transition hover:bg-ink-700 hover:text-ink-100"
        >
          {copied ? t('copied') : t('copy')}
        </button>
      </div>
    </div>
  );
}

export function RandomReveal({
  finalCode,
  onComplete,
}: {
  finalCode: string;
  onComplete: () => void;
}) {
  const { t } = useI18n();
  const [currentCode, setCurrentCode] = useState(() => randomCrosshairCode().code);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    const timeouts: number[] = [];
    let delay = 60;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      completeRef.current();
    };

    const scheduleNext = () => {
      if (delay > 400) {
        setCurrentCode(finalCode);
        timeouts.push(window.setTimeout(finish, 700));
        return;
      }
      setCurrentCode(randomCrosshairCode().code);
      timeouts.push(window.setTimeout(scheduleNext, delay));
      delay *= 1.18;
    };

    timeouts.push(window.setTimeout(scheduleNext, delay));
    return () => timeouts.forEach(clearTimeout);
  }, [finalCode]);

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink-950/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-5">
        <div className="flex items-center gap-2 text-accent-400">
          <Sparkles className="h-5 w-5 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-[0.2em]">
            {t('randomizing')}
          </span>
          <Sparkles className="h-5 w-5 animate-pulse" />
        </div>
        <div className="relative">
          <div className="absolute -inset-4 animate-pulse rounded-2xl bg-accent-500/20 blur-2xl" />
          <CrosshairCodePreview
            code={currentCode}
            className="relative h-44 w-44 rounded-xl border-2 border-accent-500/40 bg-ink-850"
            background="dark"
          />
        </div>
      </div>
    </div>
  );
}

// Single unified result popup used by both roulettes and the history list.
export function DetailModal({
  item,
  onClose,
}: {
  item: DetailItem;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-fade-in relative w-full max-w-3xl rounded-2xl border border-ink-700 bg-ink-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-lg border border-ink-700 bg-ink-800 p-1.5 text-ink-400 transition hover:bg-ink-700 hover:text-ink-100"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-5 flex flex-col items-center text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-accent-500">
            {t('you_won')}
          </p>
          <h3 className="mt-1 text-3xl font-extrabold text-ink-100">
            {item.player}
          </h3>
        </div>
        <div className="flex flex-col items-center gap-6">
          <CrosshairCodePreview
            code={item.code}
            className="h-44 w-44 shrink-0 rounded-xl border border-ink-800 bg-ink-850"
            background="dark"
          />
          <div className="flex w-full min-w-0 flex-col gap-3">
            <CopyField label={t('share_code')} value={item.code} t={t} />
            <CopyField
              label={t('console')}
              value={buildConVars(item.crosshair)}
              multiline
              t={t}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
