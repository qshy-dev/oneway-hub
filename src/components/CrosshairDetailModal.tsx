import { useState } from 'react';
import { decodeCrosshairShareCode } from 'csgo-sharecode';
import { X, ZoomIn, Copy, Check } from 'lucide-react';
import { CrosshairPreview } from './CrosshairPreview';
import { buildConVars } from '@/lib/crosshairCommands';
import { useI18n } from '@/i18n';

interface Props {
  player: string;
  code: string;
  onClose: () => void;
}

export function CrosshairDetailModal({ player, code, onClose }: Props) {
  const { t } = useI18n();
  const [zoomed, setZoomed] = useState(false);
  const [copiedField, setCopiedField] = useState<'code' | 'console' | null>(null);

  let ch = null;
  try {
    ch = decodeCrosshairShareCode(code);
  } catch {
    // invalid
  }

  const copy = (value: string, field: 'code' | 'console') => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    });
  };

  return (
    <div
      className="animate-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-modal-in w-full max-w-md rounded-2xl border border-ink-700 bg-ink-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink-100">{t('crosshair_details')}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-ink-200"
            aria-label={t('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-3 text-sm font-semibold text-accent-400">{player}</p>

        <div className="mb-4 flex justify-center">
          <button
            onClick={() => setZoomed(true)}
            className="group relative rounded-xl border border-ink-800 bg-ink-850 p-2 transition hover:border-accent-500/50"
            title={t('zoom_hint')}
          >
            {ch ? (
              <CrosshairPreview
                crosshair={ch}
                className="h-40 w-40 rounded-lg"
                background="dark"
              />
            ) : (
              <div className="flex h-40 w-40 items-center justify-center text-sm text-ink-500">
                Invalid code
              </div>
            )}
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink-950/0 opacity-0 transition group-hover:bg-ink-950/30 group-hover:opacity-100">
              <ZoomIn className="h-6 w-6 text-ink-100" />
            </span>
          </button>
        </div>

        <div className="mb-3">
          <label className="mb-1.5 block text-xs uppercase tracking-wider text-ink-500">
            {t('share_code_label')}
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-ink-800 bg-ink-950 px-3 py-2 font-mono text-sm text-ink-200">
              {code}
            </code>
            <button
              onClick={() => copy(code, 'code')}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm font-medium text-ink-200 transition hover:bg-ink-700"
            >
              {copiedField === 'code' ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {ch && (
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-ink-500">
              {t('console_commands')}
            </label>
            <div className="relative">
              <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-ink-800 bg-ink-950 p-3 font-mono text-xs text-ink-300">
                {buildConVars(ch)}
              </pre>
              <button
                onClick={() => copy(buildConVars(ch), 'console')}
                className="absolute right-2 top-2 flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800/90 px-2.5 py-1.5 text-xs font-medium text-ink-200 backdrop-blur transition hover:bg-ink-700"
              >
                {copiedField === 'console' ? (
                  <Check className="h-3.5 w-3.5 text-green-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {zoomed && ch && (
        <div
          className="animate-backdrop-in fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/95 p-8 backdrop-blur-sm"
          onClick={() => setZoomed(false)}
        >
          <button
            onClick={() => setZoomed(false)}
            className="absolute right-6 top-6 rounded-lg p-2 text-ink-300 transition hover:bg-ink-800 hover:text-ink-100"
            aria-label={t('close')}
          >
            <X className="h-6 w-6" />
          </button>
          <CrosshairPreview
            crosshair={ch}
            className="h-[min(80vh,80vw)] w-[min(80vh,80vw)] max-w-3xl max-h-3xl"
            background="dark"
          />
        </div>
      )}
    </div>
  );
}
