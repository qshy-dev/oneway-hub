import { useMemo, useState } from 'react';
import { encodeCrosshair, type Crosshair } from 'csgo-sharecode';
import { Dices } from 'lucide-react';
import { CrosshairPreview } from './CrosshairPreview';
import { buildConVars } from '@/lib/crosshairCommands';
import { useI18n } from '@/i18n';

const DEFAULT: Crosshair = {
  gap: -2, outline: 1, red: 0, green: 255, blue: 0, alpha: 255,
  splitDistance: 3, followRecoil: false, fixedCrosshairGap: 3, color: 1,
  outlineEnabled: true, innerSplitAlpha: 0.1, outerSplitAlpha: 1,
  splitSizeRatio: 1, thickness: 1, centerDotEnabled: false,
  deployedWeaponGapEnabled: false, alphaEnabled: true, tStyleEnabled: false,
  style: 4, length: 4,
};

const COLOR_PRESETS = [
  { label: 'Red', color: 0, r: 255, g: 0, b: 0 },
  { label: 'Green', color: 1, r: 0, g: 255, b: 0 },
  { label: 'Yellow', color: 2, r: 255, g: 255, b: 0 },
  { label: 'Blue', color: 3, r: 0, g: 153, b: 255 },
  { label: 'Cyan', color: 4, r: 0, g: 255, b: 255 },
  { label: 'Custom', color: 5, r: 255, g: 255, b: 255 },
];

export function Generator() {
  const { t } = useI18n();
  const [ch, setCh] = useState<Crosshair>(DEFAULT);
  const update = (patch: Partial<Crosshair>) => setCh((c) => ({ ...c, ...patch }));

  const shareCode = useMemo(() => {
    try { return encodeCrosshair(ch); } catch { return '—'; }
  }, [ch]);
  const consoleCode = useMemo(() => buildConVars(ch), [ch]);

  const randomize = () => {
    update({
      style: 4,
      length: round1(randRange(1, 10)),
      thickness: round1(randRange(0, 3)),
      gap: round1(randRange(-8, 4)),
      color: Math.floor(Math.random() * 6),
      red: Math.floor(Math.random() * 256),
      green: Math.floor(Math.random() * 256),
      blue: Math.floor(Math.random() * 256),
      alpha: Math.floor(Math.random() * 256),
      alphaEnabled: Math.random() > 0.3,
      outlineEnabled: Math.random() > 0.4,
      outline: round1(randRange(0, 3)),
      centerDotEnabled: Math.random() > 0.6,
      tStyleEnabled: Math.random() > 0.8,
    });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_440px]">
      {/* Settings */}
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink-100">{t('settings')}</h3>
          <button
            onClick={randomize}
            className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm font-medium text-ink-200 transition hover:bg-ink-700"
          >
            <Dices className="h-4 w-4" />
            {t('randomize')}
          </button>
        </div>

        <Section title={t('style')}>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4].map((s) => (
              <button
                key={s}
                onClick={() => update({ style: s })}
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  ch.style === s
                    ? 'border-accent-500 bg-accent-500/10 text-accent-400'
                    : 'border-ink-800 bg-ink-900/60 text-ink-200 hover:border-ink-600 hover:text-ink-200'
                }`}
              >
                {t(`style_${s}`)}
              </button>
            ))}
          </div>
        </Section>

        <Section title={t('shape')}>
          <Slider label={t('length')} value={ch.length} min={0} max={20} step={0.1} onChange={(v) => update({ length: v })} />
          <Slider label={t('thickness')} value={ch.thickness} min={0} max={6} step={0.1} onChange={(v) => update({ thickness: v })} />
          <Slider label={t('gap')} value={ch.gap} min={-5} max={5} step={0.1} onChange={(v) => update({ gap: v })} />
          <Slider label={t('outline_thickness')} value={ch.outline} min={0} max={3} step={0.5} onChange={(v) => update({ outline: v })} />
        </Section>

        <Section title={t('options')}>
          <div className="flex flex-wrap gap-3">
            <Toggle label={t('outline')} checked={ch.outlineEnabled} onChange={(v) => update({ outlineEnabled: v })} />
            <Toggle label={t('center_dot')} checked={ch.centerDotEnabled} onChange={(v) => update({ centerDotEnabled: v })} />
            <Toggle label={t('t_style')} checked={ch.tStyleEnabled} onChange={(v) => update({ tStyleEnabled: v })} />
            <Toggle label={t('alpha_toggle')} checked={ch.alphaEnabled} onChange={(v) => update({ alphaEnabled: v })} />
          </div>
        </Section>

        <Section title={t('color')}>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => update({ color: p.color, red: p.r, green: p.g, blue: p.b })}
                className="flex items-center gap-2 rounded-lg border border-ink-800 bg-ink-900/60 px-3 py-2 text-sm text-ink-200 transition hover:border-ink-600"
              >
                <span className="h-4 w-4 rounded-full border border-white/20" style={{ background: `rgb(${p.r},${p.g},${p.b})` }} />
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <ColorSlider label={t('red')} value={ch.red} onChange={(v) => update({ color: 5, red: v })} accent="#ef4444" />
            <ColorSlider label={t('green')} value={ch.green} onChange={(v) => update({ color: 5, green: v })} accent="#22c55e" />
            <ColorSlider label={t('blue')} value={ch.blue} onChange={(v) => update({ color: 5, blue: v })} accent="#3b82f6" />
          </div>
          {ch.alphaEnabled && (
            <div className="mt-4">
              <Slider label={t('alpha')} value={ch.alpha} min={0} max={255} step={1} onChange={(v) => update({ alpha: v })} />
            </div>
          )}
        </Section>
      </div>

      {/* Preview + codes */}
      <div className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
        <div className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900/60">
          <div className="border-b border-ink-800 bg-ink-900/90 px-4 py-3">
            <span className="text-sm font-medium text-ink-200">{t('live_preview')}</span>
          </div>
          <CrosshairPreview crosshair={ch} className="h-64 w-full" background="dark" />
        </div>
        <CopyField label={t('share_code')} value={shareCode} t={t} />
        <CopyField label={t('console_commands')} value={consoleCode} multiline t={t} />
      </div>
    </div>
  );
}

function randRange(min: number, max: number) { return min + Math.random() * (max - min); }
function round1(v: number) { return Math.round(v * 10) / 10; }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900/40 p-5">
      <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-ink-500">{title}</h4>
      {children}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm text-ink-200">{label}</span>
        <span className="font-mono text-sm text-accent-400">{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="slider w-full" />
    </div>
  );
}

function ColorSlider({ label, value, onChange, accent }: {
  label: string; value: number; onChange: (v: number) => void; accent: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm text-ink-200">{label}</span>
        <span className="font-mono text-sm text-accent-400">{value}</span>
      </div>
      <input type="range" min={0} max={255} step={1} value={value} onChange={(e) => onChange(parseInt(e.target.value))} className="slider w-full" style={{ accentColor: accent }} />
    </div>
  );
}

function Toggle({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
        checked
          ? 'border-accent-500/50 bg-accent-500/10 text-accent-400'
          : 'border-ink-800 bg-ink-900/60 text-ink-200 hover:text-ink-200'
      }`}
    >
      <span className={`h-4 w-4 rounded border transition ${checked ? 'border-accent-500 bg-accent-500' : 'border-ink-600 bg-transparent'}`} />
      {label}
    </button>
  );
}

function CopyField({ label, value, multiline, t }: {
  label: string; value: string; multiline?: boolean; t: (k: string) => string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wider text-ink-500">{label}</span>
      <code className={`block w-full rounded-lg border border-ink-800 bg-ink-950 px-3 py-2 font-mono text-sm text-accent-400 ${multiline ? 'min-h-[180px] whitespace-pre-line' : 'whitespace-pre-wrap break-all'}`}>
        {value}
      </code>
      <button onClick={handleCopy} className="w-full rounded-lg border border-ink-700 bg-ink-800 px-4 py-2.5 text-sm font-medium text-ink-200 transition hover:bg-ink-700 hover:text-ink-100">
        {copied ? t('copied') : t('copy')}
      </button>
    </div>
  );
}
