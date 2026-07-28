import { useState, useLayoutEffect, useRef, useEffect, useMemo } from 'react';
import { Crosshair as CrosshairIcon, Dices, Gift, ArrowRight, Info, Map, CheckCircle2, Loader2, Circle, ChevronDown, Gavel, BarChart3, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { TwitchIcon } from '@/components/TwitchIcon';
import { useI18n } from '@/i18n';
import { useTypewriter } from '@/lib/useTypewriter';
import { useAuth } from '@/lib/auth';

type RoadmapStatus = 'done' | 'wip' | 'planned';
type HomeSection = 'roulette' | 'giveaways' | 'auction' | 'statistics' | 'profile';

export function Home({ onNavigate, active, onLogoClick, restartKey }: { onNavigate: (s: HomeSection) => void; active: boolean; onLogoClick: () => void; restartKey: number }) {
  const { t } = useI18n();
  const { profile, loading: authLoading, signInWithTwitch, signOut } = useAuth();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [roadmapFilters, setRoadmapFilters] = useState<Record<RoadmapStatus, boolean>>({ done: false, wip: true, planned: true });
  const [roadmapPage, setRoadmapPage] = useState(0);
  const [logoSpin, setLogoSpin] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollPaused = useRef(false);
  const initialScrollSet = useRef(false);
  const [containerW, setContainerW] = useState(0);
  const cardW = Math.max(0, (containerW - 16) / 2);
  const singleSetWidth = 4 * cardW + 64;
  // RAF-driven smooth scroll state
  const targetScroll = useRef(0);
  const manualRaf = useRef<number>(0);

  const { display, done, thinking } = useTypewriter(t('site_title'), { typoChance: 20, speed: 95, restartKey });

  const handleLogo = () => {
    setLogoSpin((v) => v + 360);
    onLogoClick();
  };

  const featureCards = [
    { icon: <Dices className="h-5 w-5" />, title: t('section_roulette'), desc: t('home_feature_roulette'), section: 'roulette' as const },
    { icon: <Gift className="h-5 w-5" />, title: t('home_feature_giveaways_title'), desc: t('home_feature_giveaways'), section: 'giveaways' as const },
    { icon: <Gavel className="h-5 w-5" />, title: t('home_feature_auction_title'), desc: t('home_feature_auction'), section: 'auction' as const },
    { icon: <BarChart3 className="h-5 w-5" />, title: t('section_statistics'), desc: t('home_feature_statistics'), section: 'statistics' as const },
  ];

  const scrollByCards = (dir: number) => {
    const el = scrollRef.current;
    if (!el || containerW === 0) return;
    autoScrollPaused.current = true;
    const step = cardW + 16;
    // Advance the logical target by one card
    targetScroll.current += dir * step;
    // Normalise target into the middle set range before animating
    if (targetScroll.current >= singleSetWidth * 2) {
      const shift = singleSetWidth;
      targetScroll.current -= shift;
      el.scrollLeft -= shift;
    } else if (targetScroll.current < singleSetWidth) {
      const shift = singleSetWidth;
      targetScroll.current += shift;
      el.scrollLeft += shift;
    }
    // Cancel any in-flight manual animation and start a new one
    cancelAnimationFrame(manualRaf.current);
    const duration = 320;
    const startPos = el.scrollLeft;
    const delta = targetScroll.current - startPos;
    const startTime = performance.now();
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      el.scrollLeft = startPos + delta * easeOut(progress);
      if (progress < 1) {
        manualRaf.current = requestAnimationFrame(animate);
      } else {
        el.scrollLeft = targetScroll.current;
        setTimeout(() => { autoScrollPaused.current = false; }, 1200);
      }
    };
    manualRaf.current = requestAnimationFrame(animate);
  };

  // Measure container width for infinite scroll calculations
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setContainerW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Set initial scroll position to start of middle set
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || containerW === 0 || initialScrollSet.current) return;
    el.scrollLeft = singleSetWidth;
    targetScroll.current = singleSetWidth;
    initialScrollSet.current = true;
  }, [containerW, singleSetWidth]);

  // Auto-scroll: continuous right with seamless infinite wrap
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || containerW === 0) return;
    let raf: number;
    const tick = () => {
      if (!autoScrollPaused.current) {
        el.scrollLeft += 0.15;
        targetScroll.current = el.scrollLeft;
        if (el.scrollLeft >= singleSetWidth * 2) {
          el.scrollLeft -= singleSetWidth;
          targetScroll.current = el.scrollLeft;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, containerW, singleSetWidth]);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [naturalHeight, setNaturalHeight] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(false);
  const isFirstRender = useRef(true);

  const fitEnabled = active && !aboutOpen && !roadmapOpen;

  useLayoutEffect(() => {
    if (!fitEnabled) {
      setScale(1);
      return;
    }
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    const doMeasure = () => {
      const nh = content.offsetHeight;
      setNaturalHeight(nh);
      const avail = container.clientHeight;
      setScale(avail < nh ? avail / nh : 1);
    };
    if (isFirstRender.current) {
      doMeasure();
      isFirstRender.current = false;
      requestAnimationFrame(() => setTransitionEnabled(true));
      return;
    }
    const timeoutId = window.setTimeout(() => {
      doMeasure();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 350);
    return () => clearTimeout(timeoutId);
  }, [fitEnabled]);

  const roadmapItems: { label: string; status: RoadmapStatus }[] = [
    { label: t('home_roadmap_item_1'), status: 'done' },
    { label: t('home_roadmap_item_2'), status: 'done' },
    { label: t('home_roadmap_item_3'), status: 'done' },
    { label: t('home_roadmap_item_4'), status: 'done' },
    { label: t('home_roadmap_item_5'), status: 'done' },
    { label: t('home_roadmap_item_6'), status: 'done' },
    { label: t('home_roadmap_item_7'), status: 'done' },
    { label: t('home_roadmap_item_8'), status: 'done' },
    { label: t('home_roadmap_item_9'), status: 'done' },
    { label: t('home_roadmap_item_10'), status: 'done' },
    { label: t('home_roadmap_item_11'), status: 'done' },
    { label: t('home_roadmap_item_12'), status: 'done' },
    { label: t('home_roadmap_item_13'), status: 'done' },
    { label: t('home_roadmap_item_14'), status: 'done' },
    { label: t('home_roadmap_item_15'), status: 'done' },
    { label: t('home_roadmap_item_16'), status: 'wip' },
    { label: t('home_roadmap_item_17'), status: 'wip' },
    { label: t('home_roadmap_item_18'), status: 'planned' },
    { label: t('home_roadmap_item_19'), status: 'planned' },
    { label: t('home_roadmap_item_20'), status: 'planned' },
    { label: t('home_roadmap_item_21'), status: 'planned' },
    { label: t('home_roadmap_item_22'), status: 'planned' },
  ];

  const ROADMAP_PAGE_SIZE = 10;
  const filteredRoadmap = useMemo(() => roadmapItems.filter((item) => roadmapFilters[item.status]), [roadmapItems, roadmapFilters]);
  const roadmapPageCount = Math.max(1, Math.ceil(filteredRoadmap.length / ROADMAP_PAGE_SIZE));
  const safeRoadmapPage = Math.min(roadmapPage, roadmapPageCount - 1);
  const roadmapPageItems = filteredRoadmap.slice(safeRoadmapPage * ROADMAP_PAGE_SIZE, safeRoadmapPage * ROADMAP_PAGE_SIZE + ROADMAP_PAGE_SIZE);
  const toggleRoadmapFilter = (status: RoadmapStatus) => { setRoadmapFilters((f) => ({ ...f, [status]: !f[status] })); setRoadmapPage(0); };

  return (
    <div ref={containerRef} className="flex flex-1 flex-col items-center justify-center min-h-0">
      {/* Beta badge — top-right corner */}
      <div className="pointer-events-auto absolute right-6 top-20 z-30">
        <span className="group relative inline-flex">
          <span className="inline-flex items-center rounded-full border border-accent-500/30 bg-accent-500/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-accent-400 transition hover:border-accent-500/60 hover:bg-accent-500/20">
            {t('home_beta')}
          </span>
          <span className="pointer-events-none absolute right-0 top-full mt-2 whitespace-nowrap rounded-lg border border-ink-700 bg-ink-900 px-3 py-1.5 text-xs font-medium text-ink-300 opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
            {t('home_beta_tooltip')}
          </span>
        </span>
      </div>

      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          width: '100%',
          marginBottom: fitEnabled && naturalHeight > 0 && scale < 1 ? -(naturalHeight * (1 - scale)) : 0,
          transition: transitionEnabled ? 'transform 600ms cubic-bezier(0.22, 1, 0.36, 1), margin-bottom 600ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
        }}
      >
        <div ref={contentRef} className="flex flex-col items-center text-center">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="relative mb-8 flex h-24 w-24 items-center justify-center"
          >
            <div className="pointer-events-none absolute -inset-2 rounded-full bg-accent-500/20 blur-2xl" />
            <button
              onClick={handleLogo}
              className="parallax parallax-logo group relative flex h-24 w-24 items-center justify-center rounded-3xl border border-ink-700 bg-ink-900"
              aria-label={t('site_title')}
            >
              <CrosshairIcon className="h-12 w-12 text-accent-500 transition-transform duration-700 ease-out group-hover:scale-110" strokeWidth={1.5} style={{ transform: `rotate(${logoSpin}deg)` }} />
            </button>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
            className="max-w-2xl text-4xl font-extrabold leading-tight tracking-tight text-ink-100 sm:text-5xl"
          >
            {display}
            <span
              className={`ml-0.5 inline-block w-[2px] bg-accent-500 align-middle h-[0.9em] ${thinking ? 'animate-blink' : 'animate-pulse'}`}
              style={{ opacity: done ? 0 : 1 }}
            />
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
            className="mt-4 max-w-xl text-base text-ink-400 sm:text-lg">{t('home_hero_sub')}</motion.p>

          {/* Login / Register buttons */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.65 }}
            className="mt-8 flex w-full max-w-3xl items-start gap-3"
          >
            {authLoading ? (
              <div className="flex flex-1 items-center justify-center gap-2 text-sm text-ink-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('auth_loading')}
              </div>
            ) : profile ? (
              <div className="flex flex-1 items-center justify-center gap-3">
                {profile.twitch_avatar && (
                  <img
                    src={profile.twitch_avatar}
                    alt=""
                    onClick={() => onNavigate('profile' as HomeSection)}
                    className="h-8 w-8 cursor-pointer rounded-full border border-ink-700 transition hover:border-accent-500/50"
                  />
                )}
                <span
                  onClick={() => onNavigate('profile' as HomeSection)}
                  className="cursor-pointer text-sm font-semibold text-ink-100 transition hover:text-accent-400"
                >
                  @{profile.twitch_username ?? 'user'}
                </span>
                <button
                  onClick={signOut}
                  className="flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900 px-3 py-1.5 text-xs font-semibold text-ink-300 transition hover:border-red-500/40 hover:text-red-400"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {t('auth_sign_out')}
                </button>
              </div>
            ) : (
              <div className="flex flex-1 justify-center">
                <button
                  onClick={signInWithTwitch}
                  className="parallax parallax-btn group flex items-center justify-center gap-2.5 rounded-xl bg-[#9146FF] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#7C3FE8]"
                >
                  <TwitchIcon className="h-4 w-4" />
                  {t('auth_twitch_btn')}
                </button>
              </div>
            )}
          </motion.div>

          {/* Feature cards — 2 visible, infinite horizontal scroll with arrows */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.8 }}
            className="relative mt-5 w-full max-w-3xl"
          >
            <button
              onClick={() => scrollByCards(-1)}
              className="absolute left-0 top-1/2 z-10 -translate-x-[calc(100%+8px)] -translate-y-1/2 rounded-full border border-ink-800 bg-ink-900/80 p-2 text-ink-500 backdrop-blur-sm transition hover:border-accent-500/40 hover:text-accent-400"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div
              ref={scrollRef}
              className="flex w-full overflow-x-auto py-6 [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: 'none', visibility: containerW === 0 ? 'hidden' : 'visible' }}
            >
              {[0, 1, 2].map((setIdx) => (
                <div key={setIdx} className="flex shrink-0 gap-4" style={{ width: singleSetWidth }}>
                  {featureCards.map((card) => (
                    <button
                      key={`${setIdx}-${card.section}`}
                      onClick={() => onNavigate(card.section)}
                      style={{ width: cardW }}
                      className="group relative flex shrink-0 flex-row items-center gap-3 rounded-2xl border border-ink-800 bg-ink-900/40 px-5 py-4 text-left transition duration-300 hover:border-accent-500/40 hover:bg-ink-800/50 hover:shadow-lg hover:shadow-accent-500/10"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink-700 bg-ink-850 text-accent-400 transition group-hover:scale-110 group-hover:border-accent-500/40">
                        {card.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="flex items-center gap-1.5 text-base font-bold text-ink-100">
                          {card.title}
                          <ArrowRight className="h-4 w-4 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-ink-400">{card.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            <button
              onClick={() => scrollByCards(1)}
              className="absolute right-0 top-1/2 z-10 translate-x-[calc(100%+8px)] -translate-y-1/2 rounded-full border border-ink-800 bg-ink-900/80 p-2 text-ink-500 backdrop-blur-sm transition hover:border-accent-500/40 hover:text-accent-400"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </motion.div>

          {/* About */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.95 }}
            className="mt-5 w-full max-w-3xl"
          >
            <div className="parallax parallax-card overflow-hidden rounded-2xl border border-ink-800 bg-ink-900/40">
              <button onClick={() => setAboutOpen((v) => !v)} className="flex w-full items-center gap-3 px-6 py-4 text-left transition hover:bg-ink-800/30">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-ink-700 bg-ink-850 text-accent-400">
                  <Info className="h-4 w-4" />
                </div>
                <h3 className="flex-1 text-base font-bold text-ink-100">{t('home_about_title')}</h3>
                <ChevronDown className={`h-5 w-5 shrink-0 text-ink-500 transition-transform duration-300 ${aboutOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {aboutOpen && (
                  <motion.div key="about-content" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                    <p className="px-6 pt-2 pb-6 text-sm leading-relaxed text-ink-400">{t('home_about_desc')}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Roadmap */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 1.1 }}
            className="mt-6 w-full max-w-3xl"
          >
            <div className="parallax parallax-card overflow-hidden rounded-2xl border border-ink-800 bg-ink-900/40">
              <button onClick={() => setRoadmapOpen((v) => !v)} className="flex w-full items-center gap-3 px-6 py-4 text-left transition hover:bg-ink-800/30">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-ink-700 bg-ink-850 text-accent-400">
                  <Map className="h-4 w-4" />
                </div>
                <h3 className="flex-1 text-base font-bold text-ink-100">{t('home_roadmap_title')}</h3>
                <ChevronDown className={`h-5 w-5 shrink-0 text-ink-500 transition-transform duration-300 ${roadmapOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {roadmapOpen && (
                  <motion.div key="roadmap-content" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                    <div className="px-6 pt-2 pb-6">
                      <div className="mb-4 flex flex-wrap gap-2">
                        <button
                          onClick={() => toggleRoadmapFilter('done')}
                          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${roadmapFilters.done ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : 'border-ink-800 bg-ink-950/40 text-ink-600 hover:text-ink-400'}`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> {t('home_roadmap_done')}
                        </button>
                        <button
                          onClick={() => toggleRoadmapFilter('wip')}
                          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${roadmapFilters.wip ? 'border-amber-500/50 bg-amber-500/10 text-amber-400' : 'border-ink-800 bg-ink-950/40 text-ink-600 hover:text-ink-400'}`}
                        >
                          <Loader2 className={`h-3.5 w-3.5 ${roadmapFilters.wip ? 'animate-spin' : ''}`} /> {t('home_roadmap_wip')}
                        </button>
                        <button
                          onClick={() => toggleRoadmapFilter('planned')}
                          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${roadmapFilters.planned ? 'border-accent-500/50 bg-accent-500/10 text-accent-400' : 'border-ink-800 bg-ink-950/40 text-ink-600 hover:text-ink-400'}`}
                        >
                          <Circle className="h-3.5 w-3.5" /> {t('home_roadmap_planned')}
                        </button>
                      </div>
                      <ul className="flex flex-col gap-2.5">
                        {roadmapPageItems.length === 0 ? (
                          <li className="flex h-20 items-center justify-center text-sm text-ink-600">{t('home_roadmap_done')}</li>
                        ) : roadmapPageItems.map((item, i) => (
                          <li key={i} className="flex items-start gap-3 rounded-lg border border-ink-800/60 bg-ink-950/40 px-3 py-2.5">
                            {item.status === 'done' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />}
                            {item.status === 'wip' && <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-amber-400" />}
                            {item.status === 'planned' && <Circle className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" />}
                            <span className={`text-left text-sm ${item.status === 'planned' ? 'text-ink-500' : 'text-ink-300'}`}>{item.label}</span>
                          </li>
                        ))}
                      </ul>
                      {roadmapPageCount > 1 && (
                        <div className="mt-4 flex items-center justify-between">
                          <button
                            onClick={() => setRoadmapPage((p) => Math.max(0, p - 1))}
                            disabled={safeRoadmapPage === 0}
                            className="flex h-8 items-center gap-1 rounded-lg border border-ink-800 bg-ink-900/60 px-3 text-xs font-semibold text-ink-300 transition hover:bg-ink-800 disabled:opacity-40"
                          >
                            <ChevronDown className="h-3.5 w-3.5 rotate-90" />
                          </button>
                          <span className="text-xs font-medium text-ink-500">
                            {t('home_roadmap_page', String(safeRoadmapPage + 1), String(roadmapPageCount))}
                          </span>
                          <button
                            onClick={() => setRoadmapPage((p) => Math.min(roadmapPageCount - 1, p + 1))}
                            disabled={safeRoadmapPage >= roadmapPageCount - 1}
                            className="flex h-8 items-center gap-1 rounded-lg border border-ink-800 bg-ink-900/60 px-3 text-xs font-semibold text-ink-300 transition hover:bg-ink-800 disabled:opacity-40"
                          >
                            <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>


    </div>
  );
}
