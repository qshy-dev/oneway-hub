import { useMemo, useState } from 'react';
import { Crosshair as CrosshairIcon, Dices, Settings as SettingsIcon, Gift, PanelLeftClose, PanelLeftOpen, GalleryHorizontal, Disc } from 'lucide-react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import { Roulette } from '@/components/Roulette';
import { Settings } from '@/components/Settings';
import { Giveaways } from '@/components/giveaways/Giveaways';
import { Home } from '@/components/Home';
import { SiteSettingsModal } from '@/components/SiteSettingsModal';
import { CursorGlow } from '@/components/CursorGlow';
import { I18nProvider, useI18n } from '@/i18n';
import { useSettings, SettingsProvider } from '@/lib/settings';
import { useParallax } from '@/lib/useParallax';
import { UserCrosshairsProvider, useUserCrosshairsCtx } from '@/lib/userCrosshairsContext';
import { type ProCrosshair } from '@/data/proCrosshairs';
import { type Crosshair } from 'csgo-sharecode';

type Section = 'home' | 'roulette' | 'giveaways';
type RouletteTab = 'roulette' | 'settings';
type RouletteMode = 'horizontal' | 'wheel';
interface WinRecord { player: string; code: string; }

function AppInner() {
  const { t } = useI18n();
  const { prefs } = useSettings();
  const { rows } = useUserCrosshairsCtx();
  const [section, setSection] = useState<Section>('home');
  const [collapsed, setCollapsed] = useState(true);
  const [rouletteTab, setRouletteTab] = useState<RouletteTab>('roulette');
  const [rouletteMode, setRouletteMode] = useState<RouletteMode>('horizontal');
  const [history, setHistory] = useState<WinRecord[]>([]);
  const [siteSettingsOpen, setSiteSettingsOpen] = useState(false);

  useParallax();

  const handleWin = (player: string, code: string, _crosshair: Crosshair) => {
    setHistory((h) => [{ player, code }, ...h].slice(0, 20));
  };

  const items = useMemo<ProCrosshair[]>(() => {
    const active = rows
      .filter((r) => !r.archived && r.include_in_roulette)
      .map((r) => ({ player: r.player, code: r.code }));
    const own: ProCrosshair[] =
      prefs.includeOwn && prefs.ownCode
        ? [{ player: t('your_crosshair'), code: prefs.ownCode }]
        : [];
    return [...active, ...own];
  }, [rows, prefs.includeOwn, prefs.ownCode, t]);

  const sidebarWidth = collapsed ? 'w-[68px]' : 'w-60';

  return (
    <div className="relative flex min-h-screen bg-ink-950 text-ink-100">
      <div className="site-grid" />
      <CursorGlow />
      {/* Sidebar — in flow so it pushes content, no overlap */}
      <aside
        className={`sticky top-0 flex h-screen shrink-0 flex-col overflow-hidden border-r border-ink-800/60 bg-ink-950/60 backdrop-blur-xl transition-[width] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${sidebarWidth}`}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center border-b border-ink-800/60 px-4">
          <button
            onClick={() => setSection('home')}
            className="group flex items-center gap-3 rounded-lg transition-transform duration-150 active:scale-90"
            title={t('site_title')}
          >
            <div className="parallax parallax-logo shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-700 bg-ink-900 transition-transform duration-500 ease-out group-hover:rotate-180 group-hover:scale-110 group-active:rotate-0 group-active:scale-95">
                <CrosshairIcon className="h-5 w-5 text-accent-500 transition-colors duration-300 group-hover:text-accent-400" strokeWidth={2} />
              </div>
            </div>
            <h1 className={`min-w-0 overflow-hidden whitespace-nowrap text-base font-extrabold leading-none tracking-tight transition-[max-width,opacity] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? 'max-w-0 opacity-0' : 'max-w-[180px] opacity-100'}`}>
              {t('site_title')}
            </h1>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-1.5 p-3">
          <SidebarItem
            icon={<Dices className="h-5 w-5" />}
            label={t('section_roulette')}
            active={section === 'roulette'}
            collapsed={collapsed}
            onClick={() => setSection('roulette')}
          />
          <SidebarItem
            icon={<Gift className="h-5 w-5" />}
            label={t('section_giveaways')}
            active={section === 'giveaways'}
            collapsed={collapsed}
            onClick={() => setSection('giveaways')}
          />
        </nav>

        {/* Site settings */}
        <div className="px-3 pb-3">
          <SidebarItem
            icon={<SettingsIcon className="h-5 w-5" />}
            label={t('settings_button')}
            active={false}
            collapsed={collapsed}
            onClick={() => setSiteSettingsOpen(true)}
          />
        </div>

        {/* Collapse toggle */}
        <div className="flex h-[57px] shrink-0 items-center border-t border-ink-800/60 px-3">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-500 transition hover:bg-ink-900 hover:text-ink-200"
            title={collapsed ? t('expand_sidebar') : t('collapse_sidebar')}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5 shrink-0" /> : <PanelLeftClose className="h-5 w-5 shrink-0" />}
            <span className={`min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? 'max-w-0 opacity-0' : 'max-w-[160px] opacity-100'}`}>
              {t('collapse_sidebar')}
            </span>
          </button>
        </div>
      </aside>

      {/* Main — takes remaining space; content centers within it */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-ink-800/60 bg-ink-950/60 px-6 backdrop-blur-xl">
          <h2 className="text-lg font-bold text-ink-200">
            {section === 'roulette'
              ? t('section_roulette')
              : section === 'giveaways'
                ? t('section_giveaways')
                : ''}
          </h2>

          {/* Centered mode switcher — absolute so it centers relative to the main content area, which shifts with the sidebar animation. Visible in both roulette and settings tabs; clicking a mode returns to the roulette. Active state is cleared when settings is open. */}
          {section === 'roulette' && (
            <div className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 gap-1 rounded-xl border border-ink-800 bg-ink-900/50">
              <ModeButton
                active={rouletteTab === 'roulette' && rouletteMode === 'horizontal'}
                onClick={() => { setRouletteMode('horizontal'); setRouletteTab('roulette'); }}
                icon={<GalleryHorizontal className="h-4 w-4" />}
                label={t('mode_horizontal')}
              />
              <ModeButton
                active={rouletteTab === 'roulette' && rouletteMode === 'wheel'}
                onClick={() => { setRouletteMode('wheel'); setRouletteTab('roulette'); }}
                icon={<Disc className="h-4 w-4" />}
                label={t('mode_wheel')}
              />
            </div>
          )}

          {/* Roulette settings button — same visual style as the mode buttons */}
          {section === 'roulette' && (
            <div className="inline-flex gap-1 rounded-xl border border-ink-800 bg-ink-900/50">
              <ModeButton
                active={rouletteTab === 'settings'}
                onClick={() => setRouletteTab(rouletteTab === 'settings' ? 'roulette' : 'settings')}
                icon={<SettingsIcon className="h-4 w-4" />}
                label={t('tab_settings')}
              />
            </div>
          )}
        </header>

        {/* Content — all sections stay mounted (hidden when inactive) so state is preserved across switches */}
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8 min-h-0">
          <div className={section === 'home' ? 'block' : 'hidden'}>
            <Home onNavigate={setSection} />
          </div>

          <div className={section === 'roulette' ? 'flex flex-1 flex-col min-h-0' : 'hidden'}>
            <div className={rouletteTab === 'roulette' ? 'flex flex-1 flex-col min-h-0' : 'hidden'}>
              <Roulette
                items={items}
                onWin={handleWin}
                history={history}
                includeRandom={prefs.includeRandom}
                mode={rouletteMode}
              />
            </div>
            <div className={rouletteTab === 'settings' ? 'block' : 'hidden'}>
              <Settings />
            </div>
          </div>

          <div className={section === 'giveaways' ? 'block' : 'hidden'}>
            <Giveaways />
          </div>
        </main>

        {/* Footer */}
        <footer className="flex h-[57px] shrink-0 items-center border-t border-ink-800/60 bg-ink-950/60 px-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-1 text-center text-sm">
            <span className="text-ink-600">
              {t('made_for')}{' '}
              <span className="font-semibold text-ink-400">onewaywater</span>
            </span>
            <span className="text-ink-700">·</span>
            <span className="text-ink-600">
              {t('created_by')}{' '}
              <a
                href="https://guns.lol/qshy"
                target="_blank"
                rel="noreferrer"
                className="parallax parallax-btn font-semibold text-accent-400 transition hover:text-accent-300"
              >
                @qshyou
              </a>{' '}
              · 2026
            </span>
          </div>
        </footer>
      </div>

      {siteSettingsOpen && <SiteSettingsModal onClose={() => setSiteSettingsOpen(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <SettingsProvider>
        <UserCrosshairsProvider>
          <AppInner />
          <SpeedInsights />
          <Analytics />
        </UserCrosshairsProvider>
      </SettingsProvider>
    </I18nProvider>
  );
}

function SidebarItem({ icon, label, active, collapsed, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; collapsed: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
        active
          ? 'bg-accent-500/10 text-accent-300'
          : 'text-ink-400 hover:bg-ink-900 hover:text-ink-100'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className={`min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? 'max-w-0 opacity-0' : 'max-w-[160px] opacity-100'}`}>{label}</span>
    </button>
  );
}

function ModeButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? 'bg-ink-100 text-ink-950'
          : 'text-ink-400 hover:text-ink-100'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
