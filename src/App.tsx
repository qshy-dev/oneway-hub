import React, { useMemo, useState, useCallback, useRef } from 'react';
import { Crosshair as CrosshairIcon, Dices, Settings as SettingsIcon, Gift, PanelLeftClose, PanelLeftOpen, GalleryHorizontal, Disc, Gavel, BarChart3, UserCircle } from 'lucide-react';
import { Roulette } from '@/components/Roulette';
import { Settings } from '@/components/Settings';
import { Giveaways } from '@/components/giveaways/Giveaways';
import { Home } from '@/components/Home';
import { SiteSettings } from '@/components/SiteSettings';
import { Auction } from '@/components/auction/Auction';
import { Profile } from '@/components/Profile';
import { Statistics } from '@/components/statistics/Statistics';
import { CursorGlow } from '@/components/CursorGlow';
import { I18nProvider, useI18n } from '@/i18n';
import { useSettings, SettingsProvider } from '@/lib/settings';
import { useParallax } from '@/lib/useParallax';
import { UserCrosshairsProvider, useUserCrosshairsCtx } from '@/lib/userCrosshairsContext';
import { AuthProvider, useAuth } from '@/lib/auth';
import { type ProCrosshair } from '@/data/proCrosshairs';
import { type Crosshair } from 'csgo-sharecode';

type Section = 'home' | 'profile' | 'roulette' | 'giveaways' | 'auction' | 'statistics' | 'settings';
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
  const [auctionTab, setAuctionTab] = useState<'auction' | 'wheel'>('auction');
  const [homeRestart, setHomeRestart] = useState(0);
  const [logoSpin, setLogoSpin] = useState(0);
  const wheelDirtyRef = useRef(false);
  const [pendingTabSwitch, setPendingTabSwitch] = useState<'auction' | 'wheel' | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  const requestAuctionTab = (next: 'auction' | 'wheel') => {
    if (next === auctionTab) return;
    if (auctionTab === 'wheel' && wheelDirtyRef.current) {
      setPendingTabSwitch(next);
      return;
    }
    setAuctionTab(next);
  };

  useParallax();

  const restartHome = useCallback(() => {
    setHomeRestart((v) => v + 1);
    setSection('home');
  }, []);

  const handleSidebarLogo = useCallback(() => {
    setLogoSpin((v) => v + 360);
    restartHome();
  }, [restartHome]);

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
        className={`sticky top-0 flex h-screen shrink-0 flex-col overflow-hidden border-r border-ink-800/40 bg-ink-950/30 backdrop-blur-md transition-[width] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${sidebarWidth}`}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center border-b border-ink-800/60 px-3">
          <button
            onClick={handleSidebarLogo}
            className="group flex items-center gap-3 rounded-lg transition-transform duration-150 active:scale-90"
            title={t('site_title')}
          >
            <div className="parallax parallax-logo shrink-0">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-700 bg-ink-900 transition-transform duration-700 ease-out"
                style={{ transform: `rotate(${logoSpin}deg)` }}
              >
                <CrosshairIcon className="h-5 w-5 text-accent-500 transition-transform duration-500 group-hover:scale-110" strokeWidth={2} />
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
            icon={<UserCircle className="h-5 w-5" />}
            label={t('section_profile')}
            active={section === 'profile'}
            collapsed={collapsed}
            onClick={() => { setViewingUserId(null); setSection('profile'); }}
          />
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
          <SidebarItem
            icon={<Gavel className="h-5 w-5" />}
            label={t('section_auction')}
            active={section === 'auction'}
            collapsed={collapsed}
            onClick={() => setSection('auction')}
          />
          <SidebarItem
            icon={<BarChart3 className="h-5 w-5" />}
            label={t('section_statistics')}
            active={section === 'statistics'}
            collapsed={collapsed}
            onClick={() => setSection('statistics')}
          />
        </nav>

        {/* Site settings */}
        <div className="px-3 pb-3">
          <SidebarItem
            icon={<SettingsIcon className="h-5 w-5" />}
            label={t('settings_button')}
            active={section === 'settings'}
            collapsed={collapsed}
            onClick={() => setSection('settings')}
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
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-ink-800/40 bg-ink-950/30 px-6 backdrop-blur-md">
          <h2 className="text-lg font-bold text-ink-200">
            {section === 'profile'
              ? (viewingUserId ? t('profile_title') : t('profile_title'))
              : section === 'roulette'
                ? t('section_roulette')
                : section === 'giveaways'
                  ? t('section_giveaways')
                    : section === 'auction'
                      ? t('section_auction')
                        : section === 'statistics'
                          ? t('section_statistics')
                          : section === 'settings'
                            ? t('site_settings')
                            : ''}
          </h2>

          {/* Centered mode switcher for roulette */}
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

          {/* Auction tab switcher */}
          {section === 'auction' && (
            <div className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 gap-1 rounded-xl border border-ink-800 bg-ink-900/50">
              <ModeButton
                active={auctionTab === 'auction'}
                onClick={() => requestAuctionTab('auction')}
                icon={<Gavel className="h-4 w-4" />}
                label={t('auction_tab_auction')}
              />
              <ModeButton
                active={auctionTab === 'wheel'}
                onClick={() => requestAuctionTab('wheel')}
                icon={<Disc className="h-4 w-4" />}
                label={t('auction_tab_wheel')}
              />
            </div>
          )}

          {/* Roulette settings button */}
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
          <div className={section === 'profile' ? 'flex flex-1 flex-col min-h-0' : 'hidden'}>
            <Profile userId={viewingUserId} />
          </div>

          <div className={section === 'home' ? 'flex flex-1 flex-col min-h-0' : 'hidden'}>
            <Home key="home" restartKey={homeRestart} onNavigate={(s) => setSection(s as Section)} active={section === 'home'} onLogoClick={restartHome} />
          </div>

          <div className={section === 'roulette' ? 'flex flex-1 flex-col min-h-0' : 'hidden'}>
            <div className={rouletteTab === 'roulette' ? 'flex flex-1 flex-col min-h-0' : 'hidden'}>
              <Roulette
                items={items}
                onWin={handleWin}
                history={history}
                includeRandom={prefs.includeRandom}
                mode={rouletteMode}
                sidebarCollapsed={collapsed}
              />
            </div>
            <div className={rouletteTab === 'settings' ? 'block' : 'hidden'}>
              <Settings />
            </div>
          </div>

          <div className={section === 'giveaways' ? 'block' : 'hidden'}>
            <Giveaways onViewProfile={(uid) => { setViewingUserId(uid); setSection('profile'); }} />
          </div>

          <div className={section === 'auction' ? 'flex flex-1 flex-col min-h-0' : 'hidden'}>
            <Auction tab={auctionTab} sidebarCollapsed={collapsed} wheelDirtyRef={wheelDirtyRef} />
          </div>

          {pendingTabSwitch && (
            <div
              className="animate-backdrop-in fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
              onClick={() => setPendingTabSwitch(null)}
            >
              <div
                className="animate-modal-in relative w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="mb-2 text-center text-lg font-bold text-ink-100">{t('switch_mode_title')}</h3>
                <p className="mb-6 text-center text-sm text-ink-400">{t('switch_mode_desc')}</p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => { wheelDirtyRef.current = false; setAuctionTab(pendingTabSwitch); setPendingTabSwitch(null); }}
                    className="w-full rounded-lg bg-accent-500 px-4 py-3 text-sm font-bold text-ink-100 shadow-lg transition hover:bg-accent-400"
                  >
                    {t('confirm')}
                  </button>
                  <button
                    onClick={() => setPendingTabSwitch(null)}
                    className="w-full rounded-lg border border-ink-700 bg-ink-800 px-4 py-3 text-sm font-medium text-ink-300 transition hover:bg-ink-700 hover:text-ink-100"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className={section === 'statistics' ? 'block' : 'hidden'}>
            <Statistics />
          </div>

          <div className={section === 'settings' ? 'block' : 'hidden'}>
            <SiteSettings />
          </div>
        </main>

        {/* Footer */}
        <footer className="flex h-[57px] shrink-0 items-center border-t border-ink-800/40 bg-ink-950/30 px-3 backdrop-blur-md">
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

    </div>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App crashed:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#f87171', fontFamily: 'monospace', fontSize: 14, whiteSpace: 'pre-wrap' }}>
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>App crashed:</h2>
          <div>{this.state.error.message}</div>
          <div style={{ marginTop: 16, opacity: 0.7 }}>{this.state.error.stack}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <SettingsProvider>
          <AuthProvider>
            <UserCrosshairsProvider>
              <AppInner />
            </UserCrosshairsProvider>
          </AuthProvider>
        </SettingsProvider>
      </I18nProvider>
    </ErrorBoundary>
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
          ? 'bg-accent-500 text-white shadow-md shadow-accent-500/30'
          : 'text-ink-400 hover:text-ink-100 hover:bg-ink-800/50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
