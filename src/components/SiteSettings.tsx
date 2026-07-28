import { SwatchBook, Palette, Globe, Moon, Sun, Check } from 'lucide-react';
import { useI18n, type Lang } from '@/i18n';
import { useSettings, type Theme } from '@/lib/settings';

const DEFAULT_COLOR = '#9146ff';
const PRESET_COLORS = [
  '#9146ff', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
];

const LANG_FLAGS: Record<Lang, string> = {
  ru: '🇷🇺',
  en: '🇬🇧',
};

export function SiteSettings() {
  const { t, lang, setLang } = useI18n();
  const { prefs, setAccentColor, setTheme } = useSettings();

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="rounded-2xl border border-ink-800 bg-ink-900/40 p-6">
        {/* Language */}
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <Globe className="h-5 w-5 text-accent-400" />
            <h4 className="text-sm font-bold text-ink-100">{t('lang_label')}</h4>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(['ru', 'en'] as Lang[]).map((l) => {
              const active = lang === l;
              return (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`group relative flex items-center gap-3 rounded-xl border p-4 transition ${
                    active
                      ? 'border-accent-500/60 bg-accent-500/10'
                      : 'border-ink-800 bg-ink-950/50 hover:border-ink-700 hover:bg-ink-900/60'
                  }`}
                >
                  <span className="text-2xl">{LANG_FLAGS[l]}</span>
                  <div className="flex flex-col items-start">
                    <span className={`text-sm font-bold ${active ? 'text-accent-400' : 'text-ink-200'}`}>
                      {t(`lang_${l}` as 'lang_ru' | 'lang_en')}
                    </span>
                    <span className="text-xs font-medium uppercase tracking-wide text-ink-600">{l}</span>
                  </div>
                  {active && (
                    <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent-500">
                      <Check className="h-3 w-3 text-ink-950" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Theme */}
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            {prefs.theme === 'dark' ? <Moon className="h-5 w-5 text-accent-400" /> : <Sun className="h-5 w-5 text-accent-400" />}
            <h4 className="text-sm font-bold text-ink-100">{t('theme_label')}</h4>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(['light', 'dark'] as Theme[]).map((th) => {
              const active = prefs.theme === th;
              return (
                <button
                  key={th}
                  onClick={() => setTheme(th)}
                  className={`group relative flex items-center gap-3 rounded-xl border p-4 transition ${
                    active
                      ? 'border-accent-500/60 bg-accent-500/10'
                      : 'border-ink-800 bg-ink-950/50 hover:border-ink-700 hover:bg-ink-900/60'
                  }`}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-700 bg-ink-900">
                    {th === 'dark' ? <Moon className="h-4 w-4 text-ink-300" /> : <Sun className="h-4 w-4 text-ink-300" />}
                  </span>
                  <div className="flex flex-col items-start">
                    <span className={`text-sm font-bold ${active ? 'text-accent-400' : 'text-ink-200'}`}>
                      {th === 'dark' ? t('theme_dark') : t('theme_light')}
                    </span>
                  </div>
                  {active && (
                    <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent-500">
                      <Check className="h-3 w-3 text-ink-950" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
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
