import { useState } from 'react';
import { Crosshair as CrosshairIcon, Dices, Gift, ArrowRight, Info, Map, CheckCircle2, Loader2, Circle, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '@/i18n';
import { useTypewriter } from '@/lib/useTypewriter';

type RoadmapStatus = 'done' | 'wip' | 'planned';

export function Home({ onNavigate }: { onNavigate: (s: 'roulette' | 'giveaways') => void }) {
  const { t } = useI18n();
  const { display: typedTitle, done: titleDone } = useTypewriter(t('site_title'), { speed: 110, typoChance: 18 });
  const [aboutOpen, setAboutOpen] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [logoSpin, setLogoSpin] = useState(0);

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
    <div className="flex flex-col items-center text-center">
      <div className="relative mb-8 flex h-24 w-24 items-center justify-center">
        <div className="pointer-events-none absolute -inset-2 rounded-full bg-accent-500/20 blur-2xl" />
        <button
          onClick={() => setLogoSpin((v) => v + 360)}
          className="parallax parallax-logo group relative flex h-24 w-24 items-center justify-center rounded-3xl border border-ink-700 bg-ink-900"
          aria-label={t('site_title')}
        >
          <CrosshairIcon
            className="h-12 w-12 text-accent-500 transition-transform duration-700 ease-out group-hover:scale-110"
            strokeWidth={1.5}
            style={{ transform: `rotate(${logoSpin}deg)` }}
          />
        </button>
      </div>

      <h1 className="max-w-2xl text-4xl font-extrabold leading-tight tracking-tight text-ink-100 sm:text-5xl">
        {typedTitle}
        <span className="ml-0.5 inline-block w-[2px] animate-pulse bg-accent-500 align-middle h-[0.9em]" style={{ opacity: titleDone ? 0 : 1 }} />
      </h1>
      <p className="mt-4 max-w-xl text-base text-ink-400 sm:text-lg">
        {t('home_hero_sub')}
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => onNavigate('roulette')}
          className="parallax parallax-btn group flex items-center gap-2 rounded-xl bg-accent-500 px-6 py-3 text-sm font-bold text-ink-950 transition hover:bg-accent-400"
        >
          <Dices className="h-4 w-4" />
          {t('section_roulette')}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </button>
        <button
          onClick={() => onNavigate('giveaways')}
          className="parallax parallax-btn group flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-900 px-6 py-3 text-sm font-bold text-ink-200 transition hover:border-ink-600 hover:bg-ink-800"
        >
          <Gift className="h-4 w-4" />
          {t('home_btn_giveaways')}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </button>
      </div>

      <div className="mt-10 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        <FeatureCard icon={<Dices className="h-5 w-5" />} title={t('section_roulette')} desc={t('home_feature_roulette')} />
        <FeatureCard icon={<Gift className="h-5 w-5" />} title={t('home_feature_giveaways_title')} desc={t('home_feature_giveaways')} />
      </div>

      {/* About — collapsible */}
      <div className="mt-8 w-full max-w-3xl">
        <div className="parallax parallax-card overflow-hidden rounded-2xl border border-ink-800 bg-ink-900/40">
          <button
            onClick={() => setAboutOpen((v) => !v)}
            className="flex w-full items-center gap-3 px-6 py-4 text-left transition hover:bg-ink-800/30"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-ink-700 bg-ink-850 text-accent-400">
              <Info className="h-4 w-4" />
            </div>
            <h3 className="flex-1 text-base font-bold text-ink-100">{t('home_about_title')}</h3>
            <ChevronDown className={`h-5 w-5 shrink-0 text-ink-500 transition-transform duration-300 ${aboutOpen ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence initial={false}>
            {aboutOpen && (
              <motion.div
                key="about-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <p className="px-6 pt-2 pb-6 text-sm leading-relaxed text-ink-400">{t('home_about_desc')}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Roadmap — collapsible */}
      <div className="mt-6 w-full max-w-3xl">
        <div className="parallax parallax-card overflow-hidden rounded-2xl border border-ink-800 bg-ink-900/40">
          <button
            onClick={() => setRoadmapOpen((v) => !v)}
            className="flex w-full items-center gap-3 px-6 py-4 text-left transition hover:bg-ink-800/30"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-ink-700 bg-ink-850 text-accent-400">
              <Map className="h-4 w-4" />
            </div>
            <h3 className="flex-1 text-base font-bold text-ink-100">{t('home_roadmap_title')}</h3>
            <ChevronDown className={`h-5 w-5 shrink-0 text-ink-500 transition-transform duration-300 ${roadmapOpen ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence initial={false}>
            {roadmapOpen && (
              <motion.div
                key="roadmap-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="px-6 pt-2 pb-6">
                  <div className="mb-4 flex flex-wrap gap-4">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-ink-400">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> {t('home_roadmap_done')}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-ink-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" /> {t('home_roadmap_wip')}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-ink-400">
                      <Circle className="h-3.5 w-3.5 text-ink-500" /> {t('home_roadmap_planned')}
                    </span>
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
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="parallax parallax-card rounded-2xl border border-ink-800 bg-ink-900/40 p-5 text-left">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-ink-700 bg-ink-850 text-accent-400">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-ink-100">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-ink-500">{desc}</p>
    </div>
  );
}
