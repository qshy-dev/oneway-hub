import { useState, useLayoutEffect, useRef, useEffect } from 'react';
import { Crosshair as CrosshairIcon, Dices, Gift, ArrowRight, Info, Map, CheckCircle2, Loader2, Circle, ChevronDown, Gavel, BarChart3, LogIn, UserPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '@/i18n';
import { useTypewriter } from '@/lib/useTypewriter';

type RoadmapStatus = 'done' | 'wip' | 'planned';
type HomeSection = 'roulette' | 'giveaways' | 'auction' | 'statistics';

export function Home({ onNavigate, active, onLogoClick, restartKey }: { onNavigate: (s: HomeSection) => void; active: boolean; onLogoClick: () => void; restartKey: number }) {
  const { t } = useI18n();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null);
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

  const { display, done } = useTypewriter(t('site_title'), { typoChance: 20, speed: 95, restartKey });

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
    { label: t('home_roadmap_item_8'), status: 'wip' },
    { label: t('home_roadmap_item_9'), status: 'planned' },
    { label: t('home_roadmap_item_10'), status: 'planned' },
    { label: t('home_roadmap_item_11'), status: 'planned' },
    { label: t('home_roadmap_item_12'), status: 'planned' },
    { label: t('home_roadmap_item_13'), status: 'planned' },
    { label: t('home_roadmap_item_14'), status: 'planned' },
    { label: t('home_roadmap_item_15'), status: 'planned' },
    { label: t('home_roadmap_item_16'), status: 'planned' },
  ];

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
          <div className="relative mb-8 flex h-24 w-24 items-center justify-center">
            <div className="pointer-events-none absolute -inset-2 rounded-full bg-accent-500/20 blur-2xl" />
            <button
              onClick={handleLogo}
              className="parallax parallax-logo group relative flex h-24 w-24 items-center justify-center rounded-3xl border border-ink-700 bg-ink-900"
              aria-label={t('site_title')}
            >
              <CrosshairIcon className="h-12 w-12 text-accent-500 transition-transform duration-700 ease-out group-hover:scale-110" strokeWidth={1.5} style={{ transform: `rotate(${logoSpin}deg)` }} />
            </button>
          </div>

          {/* Title */}
          <h1 className="max-w-2xl text-4xl font-extrabold leading-tight tracking-tight text-ink-100 sm:text-5xl">
            {display}
            <span className="ml-0.5 inline-block w-[2px] animate-pulse bg-accent-500 align-middle h-[0.9em]" style={{ opacity: done ? 0 : 1 }} />
          </h1>
          <p className="mt-4 max-w-xl text-base text-ink-400 sm:text-lg">{t('home_hero_sub')}</p>

          {/* Login / Register buttons */}
          <div className="mt-8 flex w-full max-w-3xl items-start gap-3">
            <div className="flex flex-1 justify-end">
              <button
                onClick={() => setAuthModal('login')}
                className="parallax parallax-btn group flex items-center justify-center gap-2 rounded-xl border border-ink-700 bg-ink-900 px-4 py-2.5 text-sm font-bold text-ink-200 transition hover:border-accent-500/50 hover:bg-ink-800"
              >
                <LogIn className="h-4 w-4" />
                {t('home_login')}
              </button>
            </div>
            <div className="flex flex-1 justify-start">
              <button
                onClick={() => setAuthModal('register')}
                className="parallax parallax-btn group flex items-center justify-center gap-2 rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-bold text-ink-950 transition hover:bg-accent-400"
              >
                <UserPlus className="h-4 w-4" />
                {t('home_register')}
              </button>
            </div>
          </div>

          {/* Feature cards — 2 visible, infinite horizontal scroll with arrows */}
          <div className="relative mt-5 w-full max-w-3xl">
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
          </div>

          {/* About */}
          <div className="mt-5 w-full max-w-3xl">
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
          </div>

          {/* Roadmap */}
          <div className="mt-6 w-full max-w-3xl">
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
                      <div className="mb-4 flex flex-wrap gap-4">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-ink-400"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> {t('home_roadmap_done')}</span>
                        <span className="flex items-center gap-1.5 text-xs font-medium text-ink-400"><Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" /> {t('home_roadmap_wip')}</span>
                        <span className="flex items-center gap-1.5 text-xs font-medium text-ink-400"><Circle className="h-3.5 w-3.5 text-ink-500" /> {t('home_roadmap_planned')}</span>
                      </div>
                      <ul className="flex flex-col gap-2.5">
                        {roadmapItems.map((item, i) => (
                          <li key={i} className="flex items-start gap-3 rounded-lg border border-ink-800/60 bg-ink-950/40 px-3 py-2.5">
                            {item.status === 'done' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />}
                            {item.status === 'wip' && <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-amber-400" />}
                            {item.status === 'planned' && <Circle className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" />}
                            <span className={`text-left text-sm ${item.status === 'planned' ? 'text-ink-500' : 'text-ink-300'}`}>{item.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Auth modal placeholder */}
      <AnimatePresence>
        {authModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setAuthModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-ink-800 bg-ink-900 p-6"
            >
              <h3 className="mb-4 text-lg font-bold text-ink-100">
                {authModal === 'login' ? t('auth_login_title') : t('auth_register_title')}
              </h3>
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-ink-800 bg-ink-950/50 px-6 py-10 text-center">
                <LogIn className="h-8 w-8 text-accent-400" />
                <p className="text-sm font-semibold text-ink-200">{t('auth_coming_soon')}</p>
                <p className="max-w-xs text-xs text-ink-500">{t('auth_coming_soon_desc')}</p>
              </div>
              <button
                onClick={() => setAuthModal(null)}
                className="mt-4 w-full rounded-xl border border-ink-700 bg-ink-800 px-4 py-2.5 text-sm font-semibold text-ink-300 transition hover:bg-ink-700"
              >
                {t('close')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
