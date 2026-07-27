import { X, SwatchBook, Palette, Globe } from 'lucide-react';
import { useI18n, type Lang } from '@/i18n';
import { useSettings } from '@/lib/settings';

const DEFAULT_COLOR = '#9146ff';
const PRESET_COLORS = [
  '#9146ff', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
];

export function SiteSettingsModal({ onClose }: { onClose: () => void }) {
  const { t, lang, setLang } = useI18n();
  const { prefs, setAccentColor } = useSettings();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-ink-700 bg-ink-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink-100">{t('site_settings')}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Language */}
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <Globe className="h-5 w-5 text-accent-400" />
            <h4 className="text-sm font-bold text-ink-100">{t('lang_label')}</h4>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-ink-800 bg-ink-950 p-1">
            {(['ru', 'en'] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold uppercase transition ${
                  lang === l
                    ? 'bg-ink-700 text-ink-100'
                    : 'text-ink-500 hover:text-ink-300'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Site color */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <SwatchBook className="h-5 w-5 text-accent-400" />
            <h4 className="text-sm font-bold text-ink-100">{t('site_color')}</h4>
          </div>
          <p className="mb-4 text-xs text-ink-500">{t('site_color_sub')}</p>
          <div className="flex flex-wrap items-center gap-3">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setAccentColor(c)}
                className={`h-9 w-9 rounded-full border-2 transition ${
                  prefs.accentColor === c
                    ? 'border-ink-100 scale-110'
                    : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <label
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-xs font-medium text-ink-300 transition hover:bg-ink-700"
              title={t('custom_color')}
            >
              <span
                className="h-4 w-4 rounded-full border border-ink-600"
                style={{ backgroundColor: prefs.accentColor }}
              />
              <Palette className="h-4 w-4" />
              <span className="whitespace-nowrap">{t('custom_color')}</span>
              <input
                type="color"
                value={prefs.accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="sr-only"
              />
            </label>
            <button
              onClick={() => setAccentColor(DEFAULT_COLOR)}
              className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-xs font-medium text-ink-300 transition hover:bg-ink-700"
            >
              {t('reset_color')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
